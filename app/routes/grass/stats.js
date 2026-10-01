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
    compareAggregates
} = require("../../util/golfAnalytics");

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

        const rounds = await getPlayerRounds(
            thisDb,
            "myrounds" + suffix,
            new ObjectID(data.user_id),
            data.criteria
        );

        const analyses = rounds.map(function (round) {
            return analyseRound(round, analyticsContext);
        });

        const aggregate = aggregateRounds(analyses);

        res.send({
            aggregate: aggregate
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
