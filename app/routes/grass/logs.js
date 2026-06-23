const express = require("express");
const router = express.Router({ mergeParams: true });
const mongodb = require("mongodb");
let ObjectID = require('mongodb').ObjectID
const axios = require('axios');
const { getAppConfig } = require("../../config/app_config");
const { logError } = require("../../logs/errorLogger");

router.get("/user", async (req, res) => {
    let query;
    let table;
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;
    db = req.db;
    const thisDb = db.db("grass");
    try {
        const user = req.query.id;


        var errMess = "";

        if (user == null || user == "") {
            errMess = "Account Email Not Sent";
        }

        if (errMess !== "") {
            await logError({
                thisDb,
                type: "validation",
                action: "logs/user",
                error: errMess,
                payload: req.body,
            });
            let res_json = {
                status: "FAILED",
            }
            res_json.message = errMess;
            res.send({ res_json });
        } else {
            // let query = { user_email: user };
            query = { $or: [{ user_email: user }, { owner: user }] };
            table = "logs" + suffix;
            let mysort = { unix_timestamp: 1 };
            const logs = await thisDb.collection(table).find(query).sort(mysort).toArray();
            if (logs.length > 0) {
                let res_json = { status: "OK", }
                res_json.message = "Logs For Account Found";
                res_json.user_email = user;
                res_json.logs = logs;
                res.res_json = res_json;
                res.send({ res_json });
            } else {
                let res_json = { status: "ERROR", };
                res_json.message = "No Log Details Found";
                res_json.user_email = course;
                res.send({ res_json })
            }
        }
    } catch (e) {
        await logError({
            thisDb,
            type: "other",
            action: "logs/user",
            error: e,
            query,
            payload: req.query,
            table: table,
        });
        let res_json = {
            status: "FAILED",
        }
        res_json.message = "Error in getting logs for Account.";
        res.res_json = res_json;
        res_json.user_email = user;
        res.status(400).send({ message: res_json.message, data: e });
    }
});
module.exports = router;
