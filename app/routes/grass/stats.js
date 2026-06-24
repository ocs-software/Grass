const { response } = require("express");
const express = require("express");
const router = express.Router({ mergeParams: true });
const mongodb = require("mongodb");
let ObjectID = require('mongodb').ObjectID
const axios = require('axios');
const { getAppConfig } = require("../../config/app_config");
const { logError } = require("../../logs/errorLogger");
const { logDocumentChange } = require("../../logs/changeLogger");
const { rankingRound } = require("../../util/rankingRound");

router.post("/get", async (req, res) => {
    db = req.db;
    const thisDb = db.db("grass")
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;
    const data = req.body;

    try {
        const res_json = {};
        let errMess = "";

        if (!data.user_id) {
            errMess = "Player ID not sent.";
            return res.send(createErrorObj(errMess, {thisDb,
                type: "validation",
                action: "stats/get",
                error: errMess,
                payload: req.body}));
        }

        if (!data.token) {
            errMess = "Token not sent.";
            return res.send(createErrorObj(errMess, {thisDb,
                type: "validation",
                action: "stats/get",
                error: errMess,
                payload: req.body}));
        }

        const user = await thisDb.collection("users" + suffix).findOne({_id: new ObjectID(data.user_id)});

        if (!user) {
            errMess = "User not found."
            return res.send(createErrorObj(errMess, {thisDb,
                type: "validation",
                action: "stats/get",
                error: errMess,
                payload: req.body}));
        }

        if (data.token != user.token) {
            errMess = "Token sent does not match with user.";
            return res.send(createErrorObj(errMess, {thisDb,
                type: "validation",
                action: "stats/get",
                error: errMess,
                payload: req.body}));
        }
        const criteria = data.criteria || {};
        const scoreField = data.fieldSelected || "total_score";

        if (!criteria ||
            typeof criteria !== "object" ||
            Array.isArray(criteria) ||
            Object.keys(criteria).length < 1
        ) {
            errMess = "No filter sent. This operation can only be done with something to filter for.";
            return res.send(createErrorObj(errMess, {thisDb,
                type: "validation",
                action: "stats/get",
                error: errMess,
                payload: req.body}));
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
        const resultError = createErrorObj((e.message ? e.message : "Error in creating stats report."), {thisDb,
            type: "other",
            action: "stats/get",
            error: e,
            payload: data});

        res.status(400).send(resultError);
    }

    async function createErrorObj(errMess, {fields}) {
        const res_json = {};
        res_json.status = "FAILED";
        res_json.message = errMess;
        res_json.myrounds = [];

        await logError({fields});
        
        return res_json;
    }
});


module.exports = router;