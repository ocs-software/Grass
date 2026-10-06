const express = require("express");
const router = express.Router({ mergeParams: true });
let ObjectID = require("mongodb").ObjectID;
const { getAppConfig } = require("../../config/app_config");
const { logDocumentChange } = require("../../logs/changeLogger");
const {
    getPlayerReportOnTheFly,
    getPlayerLastNReport
} = require("../../util/rankingRound");
const { sendError } = require("../../util/commonFunctions");
const {
    analyseRound,
    aggregateRounds,
    buildAnalyticsContext,
    getPlayerRounds,
    compareAggregates,
    buildPlayerAnalyticsReport
} = require("../../util/golfAnalytics");

const { executeGolfAITool } = require("../../util/golfAIOpenAITools");

const { askGolfAI } = require("../../util/golfAIClient");

router.post("/get", async (req, res) => {
    db = req.db;
    const thisDb = db.db("grass");
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;
    const data = req.body;

    try {
        if (!data.user_id) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "User ID not sent.",
                type: "validation",
                action: "stats/get",
                payload: data,
                functionName: "stats/get"
            });
        }

        if (!data.token) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Token not sent.",
                type: "validation",
                action: "stats/get",
                payload: data,
                functionName: "stats/get"
            });
        }

        const user = await thisDb
            .collection("users" + suffix)
            .findOne({ _id: new ObjectID(data.user_id) });

        if (!user) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "User not found.",
                type: "validation",
                action: "stats/get",
                user: data.user_id,
                payload: data
            });
        }

        if (data.token != user.token) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Token sent does not match with user.",
                type: "validation",
                action: "stats/get",
                user: data.user_id,
                payload: data
            });
        }
        const criteria = data.criteria || {};
        const peerCriteria = data.peerCriteria || {};
        const stat = data.fieldSelected || "total_score";

        if (
            !criteria ||
            (typeof criteria !== "object" &&
                Array.isArray(criteria) &&
                Object.keys(criteria).length < 1)
        ) {
            return await sendError(res, 200, {
                thisDb,
                errMess:
                    "No filter sent. This operation can only be done with something to filter for.",
                type: "validation",
                action: "stats/get",
                payload: data,
                functionName: "stats/get"
            });
        }

        const report = await getPlayerReportOnTheFly({
            thisDb,
            suffix,
            userId: data.user_id,
            criteria,
            peerCriteria,
            stat
        });

        logDocumentChange({
            thisDb,
            table: "",
            channel: "stats/get",
            resp: report,
            newData: {},
            my_round: "",
            user_id: data.user_id
        }).catch((err) => {
            console.error("Change log failed:", err);
        });

        res.send(report);
    } catch (e) {
        return await sendError(res, 400, {
            thisDb,
            errMess: e.message || "Error in creating stats report.",
            type: "other",
            action: "stats/get",
            error: e,
            payload: data,
            functionName: "stats/get"
        });
    }
});

router.post("/average", async (req, res) => {
    db = req.db;
    const thisDb = db.db("grass");
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;
    const data = req.body;

    try {
        const userId = data.user_id;
        const token = data.token;
        const club = data.club_used;
        let stat = data.stat;
        let qos = data.qos;
        let lastRecords = data.lastRecords;

        if (!userId) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "User ID not sent.",
                type: "validation",
                action: "stats/average",
                payload: data,
                functionName: "stats/average"
            });
        }

        if (!token) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Token not sent.",
                type: "validation",
                action: "stats/average",
                payload: data,
                functionName: "stats/average"
            });
        }

        const user = await thisDb
            .collection("users" + suffix)
            .findOne({ _id: new ObjectID(userId) });

        if (!user) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "User not found.",
                type: "validation",
                action: "stats/average",
                user: userId,
                payload: data
            });
        }

        if (token != user.token) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Token sent does not match with user.",
                type: "validation",
                action: "stats/average",
                user: userId,
                payload: data
            });
        }

        if (!club) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Club not sent.",
                type: "validation",
                action: "stats/average",
                payload: data,
                functionName: "stats/average"
            });
        }

        const item = await thisDb
            .collection("table")
            .findOne({ table_id: "OPTIONS" });

        if (!item) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Table OPTIONS not found.",
                type: "validation",
                action: "stats/average",
                user: userId,
                payload: data
            });
        }

        const clubRec = item.as_clubs.find(
            (itemClub) => itemClub.code == club
        )?.code;

        if (clubRec != club) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Club sent not found at table OPTIONS.",
                type: "validation",
                action: "stats/average",
                user: userId,
                payload: data
            });
        }

        if (!stat) {
            stat = "distance";
        }

        if (!qos) {
            qos = 3;
        }

        if (!lastRecords) {
            lastRecords = 10;
        }

        return await getPlayerLastNReport({
            thisDb,
            suffix,
            userId,
            criteria: { club_used: club, qos: qos },
            stat,
            lastRecords
        });
    } catch (e) {
        return await sendError(res, 400, {
            thisDb,
            errMess: e.message || "Error in creating stats report.",
            type: "other",
            action: "stats/average",
            error: e,
            payload: data,
            functionName: "stats/average"
        });
    }
});

router.post("/ai/golf", async (req, res) => {
    db = req.db;

    const thisDb = db.db("grass");
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;
    const data = req.body;

    try {
        if (!data.user_id) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "User ID not sent.",
                type: "validation",
                action: "stats/ai/golf",
                payload: data,
                functionName: "stats/ai/golf"
            });
        }

        if (!data.token) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Token not sent.",
                type: "validation",
                action: "stats/ai/golf",
                payload: data,
                functionName: "stats/ai/golf"
            });
        }

        if (
            typeof data.question !== "string" ||
            data.question.trim().length === 0
        ) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Question not sent.",
                type: "validation",
                action: "stats/ai/golf",
                payload: data,
                functionName: "stats/ai/golf"
            });
        }

        /*
         * Keep the first production limit deliberately conservative.
         * This prevents accidental or abusive very large prompts.
         */
        if (data.question.trim().length > 1000) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Question is too long.",
                type: "validation",
                action: "stats/ai/golf",
                payload: {
                    user_id: data.user_id
                },
                functionName: "stats/ai/golf"
            });
        }

        let userObjectId;

        try {
            userObjectId = new ObjectID(data.user_id);
        } catch (error) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Invalid User ID.",
                type: "validation",
                action: "stats/ai/golf",
                payload: {
                    user_id: data.user_id
                },
                functionName: "stats/ai/golf"
            });
        }

        const user = await thisDb.collection("users" + suffix).findOne({
            _id: userObjectId
        });

        if (!user) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "User not found.",
                type: "validation",
                action: "stats/ai/golf",
                user: data.user_id,
                payload: {
                    user_id: data.user_id
                },
                functionName: "stats/ai/golf"
            });
        }

        if (data.token != user.token) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Token sent does not match with user.",
                type: "validation",
                action: "stats/ai/golf",
                user: data.user_id,
                payload: {
                    user_id: data.user_id
                },
                functionName: "stats/ai/golf"
            });
        }

        const table = await thisDb.collection("table").findOne({
            as_oos: { $exists: true }
        });

        if (!table) {
            return await sendError(res, 400, {
                thisDb,
                errMess: "Golf analytics options table not found.",
                type: "other",
                action: "stats/ai/golf",
                user: data.user_id,
                functionName: "stats/ai/golf"
            });
        }

        const analyticsContext = buildAnalyticsContext(table);

        const AI_REQUEST_TIMEOUT_MS = 90000;

        let timeoutId;

        const timeoutPromise = new Promise(function (_, reject) {
            timeoutId = setTimeout(function () {
                const error = new Error("Golf AI request timed out.");

                error.code = "GOLF_AI_TIMEOUT";

                reject(error);
            }, AI_REQUEST_TIMEOUT_MS);
        });

        let result;

        try {
            result = await Promise.race([
                askGolfAI(data.question.trim(), {
                    thisDb,
                    collectionName: "myrounds" + suffix,
                    userId: user._id,
                    analyticsContext
                }),
                timeoutPromise
            ]);
        } finally {
            clearTimeout(timeoutId);
        }

        return res.json({
            answer: result.content || "",
            visuals: Array.isArray(result.visuals) ? result.visuals : [],
            suggestions: []
        });
    } catch (e) {
        if (e && e.code === "GOLF_AI_TIMEOUT") {
            return await sendError(res, 504, {
                thisDb,
                errMess:
                    "Golf AI is taking too long to respond. Please try again.",
                type: "timeout",
                action: "stats/ai/golf",
                user: data.user_id,
                payload: {
                    user_id: data.user_id
                },
                functionName: "stats/ai/golf"
            });
        }

        return await sendError(res, 400, {
            thisDb,
            errMess: e.message || "Error processing golf AI request.",
            type: "other",
            action: "stats/ai/golf",
            error: e,

            /*
             * Do not put the token or full question into error
             * logging through the request payload.
             */
            payload: {
                user_id: data.user_id
            },

            functionName: "stats/ai/golf"
        });
    }
});

router.post("/test-analytics", async (req, res) => {
    db = req.db;
    const thisDb = db.db("grass");
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;
    const data = req.body;

    try {
        if (!data.user_id) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "User ID not sent.",
                type: "validation",
                action: "stats/test-analytics",
                payload: data
            });
        }

        if (!data.token) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Token not sent.",
                type: "validation",
                action: "stats/test-analytics",
                payload: data
            });
        }

        const user = await thisDb.collection("users" + suffix).findOne({
            _id: new ObjectID(data.user_id)
        });

        if (!user) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "User not found.",
                type: "validation",
                action: "stats/test-analytics",
                user: data.user_id,
                payload: data
            });
        }

        if (data.token != user.token) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Token sent does not match with user.",
                type: "validation",
                action: "stats/test-analytics",
                user: data.user_id,
                payload: data
            });
        }

        const table = await thisDb.collection("table").findOne({
            as_oos: { $exists: true }
        });

        const analyticsContext = buildAnalyticsContext(table);
        const result = await askGolfAI(data.question, {
            thisDb,
            collectionName: "myrounds" + suffix,
            userId: user._id,
            analyticsContext
        });

        return res.json({
            result
        });
    } catch (e) {
        return await sendError(res, 400, {
            thisDb,
            errMess: e.message || "Error testing golf analytics.",
            type: "other",
            action: "stats/test-analytics",
            error: e,
            payload: data,
            functionName: "stats/test-analytics"
        });
    }
});

module.exports = router;
