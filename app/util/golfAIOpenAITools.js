const {
    getPlayerOverview,
    comparePlayerPeriods,
    getRound,
    getHole
} = require("./golfAITools");

const GOLF_AI_TOOLS = [
    {
        type: "function",
        name: "get_player_overview",
        description:
            "Get the player's overall golf performance report, including " +
            "scoring, GIR, putting, fairways, scrambling, penalties, " +
            "available telemetry, data quality and recent trend.",
        strict: true,
        parameters: {
            type: "object",
            properties: {
                trend_round_count: {
                    type: ["integer", "null"],
                    minimum: 1,
                    maximum: 20,
                    description:
                        "Number of recent rounds to compare with the " +
                        "immediately preceding rounds. Use null for the default."
                }
            },
            required: ["trend_round_count"],
            additionalProperties: false
        }
    },

    {
        type: "function",
        name: "compare_player_periods",
        description:
            "Compare the player's golf performance between two periods. " +
            "Use last_n to compare the most recent N rounds with the " +
            "preceding N rounds, or date_range for explicit periods.",
        strict: true,
        parameters: {
            type: "object",
            properties: {
                mode: {
                    type: "string",
                    enum: ["last_n", "date_range"]
                },

                count: {
                    type: ["integer", "null"],
                    minimum: 1,
                    maximum: 50,
                    description:
                        "Number of rounds when mode is last_n. " +
                        "Use null for date_range."
                },

                current: {
                    anyOf: [
                        {
                            type: "object",
                            properties: {
                                date_from: {
                                    type: "string"
                                },
                                date_to: {
                                    type: "string"
                                }
                            },
                            required: ["date_from", "date_to"],
                            additionalProperties: false
                        },
                        {
                            type: "null"
                        }
                    ]
                },

                previous: {
                    anyOf: [
                        {
                            type: "object",
                            properties: {
                                date_from: {
                                    type: "string"
                                },
                                date_to: {
                                    type: "string"
                                }
                            },
                            required: ["date_from", "date_to"],
                            additionalProperties: false
                        },
                        {
                            type: "null"
                        }
                    ]
                }
            },

            required: ["mode", "count", "current", "previous"],

            additionalProperties: false
        }
    },

    {
        type: "function",
        name: "get_round",
        description:
            "Get one of the player's golf rounds with canonical round " +
            "performance metrics and compact hole summaries. Use this when " +
            "investigating a particular round. It does not return raw shots.",
        strict: true,
        parameters: {
            type: "object",
            properties: {
                mode: {
                    type: "string",
                    enum: ["latest", "round_id"]
                },

                round_id: {
                    type: ["string", "null"],
                    description:
                        "Round ID when mode is round_id. " +
                        "Use null when requesting the latest round."
                }
            },

            required: ["mode", "round_id"],

            additionalProperties: false
        }
    },

    {
        type: "function",
        name: "get_hole",
        description:
            "Get detailed analysis for one hole from one of the player's " +
            "rounds, including shot-level information. Use this only when " +
            "hole-level detail is needed.",
        strict: true,
        parameters: {
            type: "object",
            properties: {
                hole: {
                    type: "integer",
                    minimum: 1,
                    maximum: 18
                },

                round_id: {
                    type: ["string", "null"],
                    description:
                        "Specific round ID, or null to use the latest round."
                }
            },

            required: ["hole", "round_id"],

            additionalProperties: false
        }
    }
];

function parseToolArguments(toolCall) {
    if (!toolCall || typeof toolCall.arguments !== "string") {
        throw new Error("Invalid AI tool call arguments.");
    }

    let args;

    try {
        args = JSON.parse(toolCall.arguments);
    } catch (error) {
        throw new Error("AI tool arguments are not valid JSON.");
    }

    if (args === null || typeof args !== "object" || Array.isArray(args)) {
        throw new Error("AI tool arguments must be an object.");
    }

    return args;
}

function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateDateRange(value, fieldName) {
    if (!isPlainObject(value)) {
        throw new Error(
            fieldName + " must be an object containing date_from and date_to."
        );
    }

    if (
        typeof value.date_from !== "string" ||
        value.date_from.trim() === "" ||
        typeof value.date_to !== "string" ||
        value.date_to.trim() === ""
    ) {
        throw new Error(
            fieldName + " must contain string date_from and date_to values."
        );
    }

    const dateFrom = new Date(value.date_from);
    const dateTo = new Date(value.date_to);

    if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
        throw new Error(fieldName + " contains an invalid date.");
    }

    if (dateFrom.getTime() > dateTo.getTime()) {
        throw new Error(fieldName + ".date_from must not be after date_to.");
    }
}

function validateComparePlayerPeriodsArguments(args) {
    if (args.mode !== "last_n" && args.mode !== "date_range") {
        throw new Error(
            "compare_player_periods mode must be last_n or date_range."
        );
    }

    if (args.mode === "last_n") {
        if (
            !Number.isInteger(args.count) ||
            args.count < 1 ||
            args.count > 50
        ) {
            throw new Error(
                "compare_player_periods count must be an integer from 1 to 50 when mode is last_n."
            );
        }

        if (args.current !== null || args.previous !== null) {
            throw new Error(
                "compare_player_periods current and previous must be null when mode is last_n."
            );
        }

        return;
    }

    if (args.count !== null) {
        throw new Error(
            "compare_player_periods count must be null when mode is date_range."
        );
    }

    validateDateRange(args.current, "current");
    validateDateRange(args.previous, "previous");
}

async function executeGolfAITool(toolCall, serverContext) {
    if (!toolCall || typeof toolCall.name !== "string") {
        throw new Error("Invalid AI tool call.");
    }

    if (
        !serverContext ||
        !serverContext.thisDb ||
        !serverContext.collectionName ||
        !serverContext.userId ||
        !serverContext.analyticsContext
    ) {
        throw new Error("Invalid golf AI server context.");
    }

    const args = parseToolArguments(toolCall);

    const thisDb = serverContext.thisDb;
    const collectionName = serverContext.collectionName;
    const userId = serverContext.userId;
    const analyticsContext = serverContext.analyticsContext;

    switch (toolCall.name) {
        case "get_player_overview":
            return getPlayerOverview(
                thisDb,
                collectionName,
                userId,
                analyticsContext,
                {
                    trendRoundCount:
                        args.trend_round_count === null
                            ? undefined
                            : args.trend_round_count
                }
            );

        case "compare_player_periods":
            validateComparePlayerPeriodsArguments(args);

            return comparePlayerPeriods(
                thisDb,
                collectionName,
                userId,
                analyticsContext,
                {
                    mode: args.mode,

                    count: args.count === null ? undefined : args.count,

                    current: args.current === null ? undefined : args.current,

                    previous: args.previous === null ? undefined : args.previous
                }
            );

        case "get_round":
            return getRound(thisDb, collectionName, userId, analyticsContext, {
                mode: args.mode,

                round_id: args.round_id === null ? undefined : args.round_id
            });

        case "get_hole":
            return getHole(thisDb, collectionName, userId, analyticsContext, {
                hole: args.hole,

                round_id: args.round_id === null ? undefined : args.round_id
            });

        default:
            throw new Error("Unknown golf AI tool: " + toolCall.name);
    }
}

module.exports = {
    GOLF_AI_TOOLS,
    executeGolfAITool
};
