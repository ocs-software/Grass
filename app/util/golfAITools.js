const {
    analyseRound,
    aggregateRounds,
    compareAggregates,
    getPlayerRounds,
    buildAnalyticsContext,
    buildPlayerAnalyticsReport
} = require("./golfAnalytics");

async function getPlayerOverview(
    thisDb,
    collectionName,
    userId,
    analyticsContext,
    options
) {
    options = options || {};

    const criteria = options.criteria || {};

    const trendRoundCount =
        Number(options.trendRoundCount) > 0
            ? Number(options.trendRoundCount)
            : 3;

    const rounds = await getPlayerRounds(
        thisDb,
        collectionName,
        userId,
        criteria
    );

    const analyses = rounds.map(function (round) {
        return analyseRound(round, analyticsContext);
    });

    const aggregate = aggregateRounds(analyses);

    /*
     * Trend calculation.
     *
     * getPlayerRounds() currently returns the rounds in
     * chronological order, so the last N rounds are the
     * current period and the N immediately before those
     * are the comparison period.
     */
    const currentRounds = rounds.slice(-trendRoundCount);

    const previousRounds = rounds.slice(
        -(trendRoundCount * 2),
        -trendRoundCount
    );

    let comparison = null;

    if (
        currentRounds.length === trendRoundCount &&
        previousRounds.length === trendRoundCount
    ) {
        const currentAnalyses = currentRounds.map(function (round) {
            return analyseRound(round, analyticsContext);
        });

        const previousAnalyses = previousRounds.map(function (round) {
            return analyseRound(round, analyticsContext);
        });

        const currentAggregate = aggregateRounds(currentAnalyses);

        const previousAggregate = aggregateRounds(previousAnalyses);

        comparison = compareAggregates(currentAggregate, previousAggregate);
    }

    return buildPlayerAnalyticsReport(aggregate, comparison);
}

async function comparePlayerPeriods(
    thisDb,
    collectionName,
    userId,
    analyticsContext,
    options
) {
    options = options || {};

    const mode = options.mode;

    let currentCriteria;
    let previousCriteria;

    if (mode === "last_n") {
        const count = Number(options.count);

        if (!Number.isInteger(count) || count <= 0 || count > 50) {
            throw new Error("count must be an integer between 1 and 50");
        }

        /*
         * Fetch enough rounds for both periods.
         */
        const rounds = await getPlayerRounds(
            thisDb,
            collectionName,
            userId,
            {}
        );

        const currentRounds = rounds.slice(-count);

        const previousRounds = rounds.slice(-(count * 2), -count);

        if (currentRounds.length < count || previousRounds.length < count) {
            return {
                available: false,
                reason: "Not enough rounds for two complete comparison periods.",
                requestedRoundsPerPeriod: count,
                availableRounds: rounds.length
            };
        }

        const currentAggregate = aggregateRounds(
            currentRounds.map(function (round) {
                return analyseRound(round, analyticsContext);
            })
        );

        const previousAggregate = aggregateRounds(
            previousRounds.map(function (round) {
                return analyseRound(round, analyticsContext);
            })
        );

        return {
            available: true,
            mode: "last_n",
            comparison: compareAggregates(currentAggregate, previousAggregate)
        };
    }

    if (mode === "date_range") {
        if (!options.current || !options.previous) {
            throw new Error("current and previous date ranges are required");
        }

        currentCriteria = {
            date_from: options.current.date_from,
            date_to: options.current.date_to
        };

        previousCriteria = {
            date_from: options.previous.date_from,
            date_to: options.previous.date_to
        };

        const currentRounds = await getPlayerRounds(
            thisDb,
            collectionName,
            userId,
            currentCriteria
        );

        const previousRounds = await getPlayerRounds(
            thisDb,
            collectionName,
            userId,
            previousCriteria
        );

        if (currentRounds.length === 0 || previousRounds.length === 0) {
            return {
                available: false,
                reason: "One or both date ranges contain no rounds.",
                sample: {
                    currentRounds: currentRounds.length,
                    previousRounds: previousRounds.length
                }
            };
        }

        const currentAggregate = aggregateRounds(
            currentRounds.map(function (round) {
                return analyseRound(round, analyticsContext);
            })
        );

        const previousAggregate = aggregateRounds(
            previousRounds.map(function (round) {
                return analyseRound(round, analyticsContext);
            })
        );

        return {
            available: true,
            mode: "date_range",

            periods: {
                current: {
                    date_from: options.current.date_from,
                    date_to: options.current.date_to
                },

                previous: {
                    date_from: options.previous.date_from,
                    date_to: options.previous.date_to
                }
            },

            comparison: compareAggregates(currentAggregate, previousAggregate)
        };
    }

    throw new Error("Unsupported comparison mode");
}

async function getRound(
    thisDb,
    collectionName,
    userId,
    analyticsContext,
    options
) {
    options = options || {};

    const mode = options.mode || "latest";

    const rounds = await getPlayerRounds(thisDb, collectionName, userId, {});

    if (rounds.length === 0) {
        return {
            available: false,
            reason: "No rounds are available for this player."
        };
    }

    let round = null;

    if (mode === "latest") {
        round = rounds[rounds.length - 1];
    } else if (mode === "round_id") {
        if (!options.round_id) {
            throw new Error("round_id is required");
        }

        round = rounds.find(function (item) {
            return String(item._id) === String(options.round_id);
        });

        if (!round) {
            return {
                available: false,
                reason: "The requested round was not found."
            };
        }
    } else {
        throw new Error("Unsupported round mode");
    }

    const analysis = analyseRound(round, analyticsContext);

    return {
        available: true,

        round: {
            id: String(round._id),

            created_at: round.created_at || null,

            course: round.course || null,

            holesPlayed: analysis.holesPlayed,

            complete18: analysis.holesPlayed === 18
        },

        analysis: analysis
    };
}

async function getHole(
    thisDb,
    collectionName,
    userId,
    analyticsContext,
    options
) {
    options = options || {};

    const holeNumber = Number(options.hole);

    if (!Number.isInteger(holeNumber) || holeNumber < 1 || holeNumber > 18) {
        throw new Error("hole must be an integer between 1 and 18");
    }

    const roundResult = await getRound(
        thisDb,
        collectionName,
        userId,
        analyticsContext,
        {
            mode: options.round_id ? "round_id" : "latest",

            round_id: options.round_id
        }
    );

    if (!roundResult.available) {
        return roundResult;
    }

    const hole = roundResult.analysis.holes.find(function (item) {
        return Number(item.hole) === holeNumber;
    });

    if (!hole) {
        return {
            available: false,
            reason: "The requested hole was not found in this round.",
            roundId: roundResult.round.id,
            hole: holeNumber
        };
    }

    return {
        available: true,

        round: {
            id: roundResult.round.id,
            created_at: roundResult.round.created_at
        },

        hole: hole
    };
}

module.exports = {
    getPlayerOverview,
    comparePlayerPeriods,
    getRound,
    getHole
};
