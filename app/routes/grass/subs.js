const { response } = require("express");
const express = require("express");
const router = express.Router({ mergeParams: true });
const mongodb = require("mongodb");
let ObjectID = require('mongodb').ObjectID
const axios = require('axios');

router.get("/user", async (req, res) => {
    try {
        const user = req.query.id;

        db = req.db;
        const thisDb = db.db("grass");

        var errMess = "";

        if (user == null || user == "") {
            errMess = "Account Email Not Sent";
        }

        if (errMess !== "") {
            let res_json = {
                status: "FAILED",
            }
            res_json.message = errMess;
            res.send({ res_json });
        }
        else {
            // let query = { user_email: user };
            let query = { $or: [{ user_email: user }, { owner: user }] };
            let mysort = { unix_timestamp: 1 };
            thisDb.collection("logs").find(query).sort(mysort).toArray(function (err, logs) {
                if (err) {
                    console.log(err)
                    let res_json = { status: "FAILED", };
                    res_json.message = "Fetching Logs For Account";
                    res_json.user_email = user;
                    res.send({ res_json });
                } else {
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
            });
        }
    } catch (e) {
        console.log(e)
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
