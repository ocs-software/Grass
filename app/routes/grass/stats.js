const { response } = require("express");
const express = require("express");
const router = express.Router({ mergeParams: true });
const mongodb = require("mongodb");
let ObjectID = require('mongodb').ObjectID
const axios = require('axios');
const { getAppConfig } = require("../../config/app_config");
const { logError } = require("../../logs/errorLogger");
const { logDocumentChange } = require("../../logs/changeLogger");

router.post("/get", async (req, res) => {
    db = req.db;
    const thisDb = db.db("grass")
    let query = "";
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;
    let table = "stats" + suffix;

    try {
        const data = req.body;

        const res_json = {};
        let errMess = "";

        if (!data.user_id) {
            errMess = "Player ID not sent.";
        }

        if (!data.token) {
            errMess = "Token not sent.";
        }

        const user = await thisDb.collection("users" + suffix).findOne({_id: new ObjectID(data.user_id)});

        if (!user) {
            errMess = "User not found."
        }

        if (user && data.token != user.token) {
            errMess = "Token sent does not match with user.";
        }

        if (errMess != "") {
            res_json.status = "FAILED";
            res_json.message = errMess;
            res.res_json = res_json;
            res_json.stats = [];

            await logError({
                thisDb,
                type: "validation",
                action: "stats/get",
                error: res_json.message,
                table: table,
                payload: req.body,
            });

            res.send({ res_jon });
            return;
        }

        query = {user_id: user._id};

        if (data.filter) {
            for (const [key, value] of Object.entries(filter)) {
                query[key] = value;
            }
        }

        const aggregate = [];

        aggregate.push({$match: {
            query
        }});

        aggregate.push({
            $facet: {
                player: [
                    { $match: { user_id: user._id }},
                    { $group: {
                        _id: "$user_id",
                        average: { $avg: "$score" },
                        rounds: { $sum: 1 }
                    }}
                ],
                overall: [
                    { $group: 
                        {
                            _id: "null",
                            average: { $avg: "$score" },
                            rounds: { $sum: 1 }
                        }
                    }
                ],
                ranking: [
                    {
                        $group: {
                            _id: "$user_id",
                            average: { $avg: "$score" },
                            rounds: { $sum: 1 }
                        }
                    },
                    {
                        $setWindowFields: {
                            sortBy: { average: 1 },
                            output: {
                                rank: { $rank: {} }
                            }
                        }
                    },
                    {
                        $match: {
                            _id: user._id
                        }
                    }
                ]
            }
        };

        const item = await thisDb.collection(table).find(query).toArray();
        if (item.length > 0) {
            let res_json = { status: "OK", };
            res_json.message = "Rounds(s) Found";
            res_json.stats = item;
            res.send({ res_json })
        } else {
            let res_json = { status: "FAILED", };
            res_json.message = "No round Found";
            res_json.stats = [];
            res.send({ res_json })
        }
    } catch (e) {
        await logError({
            thisDb,
            type: "other",
            action: "stats/get",
            error: e,
            table: table,
            payload: req.body,
            query,
        });
        let res_json = {
            status: "FAILED",
        }
        res_json.message = "Error in stats Data.";
        res.res_json = res_json;
        res_json.stats = [];
        res.send({ res_jon });
    }

});

router.post("/delete", async (req, res) => {
    // delete rounds record.
    const db = req.db;
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;
    const thisDb = db.db("grass");
    const table = "stats" + suffix;
    let errMess = "";

    const data = req.body;

    try {
        if (!data.user_id) {
            errMess = "User ID not sent.";
        }

        if (!data.round_id.id) {
            errMess = "Round ID not sent.";
        }

        if (!data.token) {
            errMess = "Token not sent.";
        }

        const user = await thisDb.collection("users" + suffix).findOne({_id: new ObjectID(data.user_id)});

        if (!user) {
            errMess = "User not found."
        }

        if (data.token != user.token) {
            errMess = "Token sent does not match with user.";
        }

        if (!errMess) {
            await logError({
                thisDb,
                type: "validation",
                action: "stats/delete",
                error: errMess,
                payload: req.body,
            });
            let res_json = {status: "FAILED"};

            res_json.message = errMess;

            res.send({ res_json });
            return;
        }

        const query = {id: data.round_id.id, user_id: new ObjectID(data.user_id) };

        const resp = await thisDb.collection(table).findOneAndDelete(query);
        if (resp) {
            logDocumentChange({
                thisDb,
                table: table,
                channel: "stats/delete",
                resp,
                newData: {},
                round_id: round_id,
                user_id: data.user_id,
            }).catch(err => {
                console.error("Change log failed:", err)
            });
        }

        res.status(200).send({status: "OK", message: resp ? "Record deleted." : "No record found to delete."});
    } catch (e) {
        await logError({
            thisDb,
            type: "other",
            action: "stats/delete",
            error: e,
            query,
            payload: data,
            table: table
        });

        let res_json = {status: "FAILED"};

        res_json.message = "Error in Deleting data.";
        res.res_json = res_json;

        res.status(400).send({ message: "Error in Deleting data.", data: e });
    }
});

router.post("/update", async (req, res) => {
    // insert/update stats record.
    const db = req.db;
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;
    const thisDb = db.db("grass");
    let query = "";
    let table = "stats" + suffix;
    let payload;

    try {
        const data = req.body;
        let obj_keys = [];
        
        if (typeof data !== "object") {
            await logError({
                thisDb,
                type: "validation",
                action: "stats/update",
                error: "Invalid data sent",
                payload: data,
            });
            let res_json = {status: "FAILED"};

            res_json.message = "Invalid data sent.";
            res.res_json = res_json;

            res.status(400).send({ message: "Invalid data sent.", data: data });
            return;
        }
        
        var errMess = "";

        const user_id = data.user_id;
        const round_id = data.round_id;
        const hole = data.hole;

        if (user_id === null || user_id === "") {
            errMess = "User ID is missing";
        }

        if (round_id === null || round_id === "") {
            errMess = "Round ID is missing";
        }

        if (!data.token) {
            errMess = "Token not sent.";
        }

        const user = await thisDb.collection("users" + suffix).findOne({_id: new ObjectID(data.user_id)});

        if (user === null) {
            errMess = "User not found."
        } else {
            if (data.token != user.token) {
                errMess = "Token sent does not match with user.";
            }
        }

        if (errMess !== "") {
            await logError({
                thisDb,
                type: "validation",
                action: "stats/update",
                error: errMess,
                payload: data,
            });
            let res_json = {status: "FAILED"};

            res_json.message = errMess;
            res.res_json = res_json;

            res.status(400).send({ message: errMess, data: data });
            return;
        } else {
            const setFields = {};
            for (const [key, value] of Object.entries(round_id)) {
                if (key != "user_id" && key != "round_id" && key != "token" && key != "_id") {
                    setFields[key] = value;
                }
            }
            query = { id: round_id, user_id: new ObjectID(user_id) };
            const collectionDb = thisDb.collection(table);

            result = await collectionDb.updateOne(
                query,
                [
                    {
                        $set: {
                            ...setFields, // only set fields sent by form
                            updated_at: new Date(),
                            created_at: {
                                $ifNull: ["$created_at", "$$NOW"] // if record does not exist, add field created;
                            }
                        }
                    }
                ],
                { upsert: true }
            );

            if (result.matchedCount === 0 && !result.upsertedId) {
                await logError({
                    thisDb,
                    type: "other",
                    action: "stats/update",
                    error: "Stats not updated/inserted.",
                    query,
                    payload: data,
                    table: table
                });

                let res_json = {status: "FAILED"};

                res_json.message = "Stats not updated/inserted.";
                res.res_json = res_json;

                res.status(400).send({ message: "Stats not updated/inserted.", data: data });
                return;
            }
        }
        res.status(200).send({status: "OK", data: data});
    } catch (e) {
        await logError({
            thisDb,
            type: "other",
            action: "stats/update",
            error: e,
            query,
            payload: req.body,
            table: table
        });

        let res_json = {status: "FAILED"};

        res_json.message = "Error in Fetching data.";
        res.res_json = res_json;

        res.status(400).send({ message: "Error in Fetching data.", data: e });
    }
});

module.exports = router;