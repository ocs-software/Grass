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

        // const comparisonSize = 3;

        const rounds = await getPlayerRounds(
            thisDb,
            "myrounds" + suffix,
            new ObjectID(data.user_id),
            {
                last_n: 1
            }
        );

        if (!rounds.length) {
            return res.status(404).send({
                error: "No rounds found"
            });
        }

        /* if (rounds.length < comparisonSize * 2) {
            return res.status(400).send({
                error: "Not enough rounds for comparison",
                required: comparisonSize * 2,
                available: rounds.length
            });
        }

        const previousRounds = rounds.slice(0, comparisonSize);

        const currentRounds = rounds.slice(comparisonSize);

        const previousAnalyses = previousRounds.map(function (playerRound) {
            return analyseRound(playerRound, analyticsContext);
        });

        const currentAnalyses = currentRounds.map(function (playerRound) {
            return analyseRound(playerRound, analyticsContext);
        });

        const previousOverview = aggregateRounds(previousAnalyses);

        const currentOverview = aggregateRounds(currentAnalyses);

        const comparison = compareAggregates(currentOverview, previousOverview); */

        /* res.send({
            analyticsContext: analyticsContext,

            previous: previousOverview,

            current: currentOverview,

            comparison: comparison,

            roundIds: {
                previous: previousAnalyses.map(function (analysis) {
                    return analysis.roundId;
                }),

                current: currentAnalyses.map(function (analysis) {
                    return analysis.roundId;
                })
            }
        }); */

        const analysis = analyseRound(rounds[0], analyticsContext);

        res.send({
            analyticsContext: analyticsContext,
            roundId: analysis.roundId,
            date: analysis.date,
            clubs: analysis.clubs
        });

        /* const roundAnalyses = rounds.map(function (playerRound) {
            return analyseRound(playerRound, analyticsContext);
        });

        const overview = aggregateRounds(roundAnalyses);

        res.send({
            analyticsContext: analyticsContext,
            overview: overview,
            rounds: roundAnalyses.map(function (analysis) {
                return {
                    roundId: analysis.roundId,
                    date: analysis.date,
                    complete: analysis.complete,
                    holesPlayed: analysis.holesPlayed,
                    scoring: analysis.scoring,
                    gir: analysis.gir,
                    putting: analysis.putting,
                    fairways: analysis.fairways,
                    scrambling: analysis.scrambling,
                    penalties: analysis.penalties
                };
            })
        }); */
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
