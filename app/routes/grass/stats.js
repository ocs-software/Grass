const { response } = require("express");
const express = require("express");
const router = express.Router({ mergeParams: true });
const mongodb = require("mongodb");
let ObjectID = require('mongodb').ObjectID
const axios = require('axios');
const { getAppConfig } = require("../../config/app_config");
const { logDocumentChange } = require("../../logs/changeLogger");
const { getPlayerReportOnTheFly } = require("../../util/rankingRound");
const { sendError } = require("../../util/commonFunctions");

router.post("/get", async (req, res) => {
    db = req.db;
    const thisDb = db.db("grass")
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;
    const data = req.body;

    try {
        const res_json = {};

        if (!data.user_id) {
            return await sendError(res, 400, {
                thisDb,
                errMess: "User ID not sent.",
                type: "validation",
                action: "stats/get",
                payload: data,
                functionName: "stats/get"
            });
        }

        if (!data.token) {
            return await sendError(res, 400, {
                thisDb,
                errMess: "Token not sent.",
                type: "validation",
                action: "stats/get",
                payload: data,
                functionName: "stats/get"
            });
        }

        const user = await thisDb.collection("users" + suffix).findOne({_id: new ObjectID(data.user_id)});

        if (!user) {
            return await sendError(res, 404, {
                thisDb,
                errMess: "User not found.",
                type: "validation",
                action: "stats/get",
                user: data.user_id,
                payload: data
            });
        }

        if (data.token != user.token) {
            return await sendError(res, 404, {
                thisDb,
                errMess: "Token sent does not match with user.",
                type: "validation",
                action: "stats/get",
                user: data.user_id,
                payload: data
            });
        }
        const criteria = data.criteria || {};
        const scoreField = data.fieldSelected || "total_score";

        if (!criteria ||
            typeof criteria !== "object" ||
            Array.isArray(criteria) ||
            Object.keys(criteria).length < 1
        ) {
            errMess = "";
            return await sendError(res, 400, {
                thisDb,
                errMess: "No filter sent. This operation can only be done with something to filter for.",
                type: "validation",
                action: "stats/get",
                payload: data,
                functionName: "stats/get"
            });
        }

        if (data.fieldSelected) {
            fieldSelected = data.fieldSelected;
        }

        const report = await getPlayerReportOnTheFly({
                thisDb,
                suffix,
                userId: data.user_id,
                criteria,
                scoreField: fieldSelected
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

module.exports = router;