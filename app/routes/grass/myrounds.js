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
    let query;
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;
    let table = "myrounds" + suffix;

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

        if (data.token != user.token) {
            errMess = "Token sent does not match with user.";
        }

        if (errMess != "") {
            res_json.status = "FAILED";
            res_json.message = errMess;
            res.res_json = res_json;
            res_json.myrounds = [];

            await logError({
                thisDb,
                type: "validation",
                action: "tourns/get",
                error: res_json.message,
                table: table,
                payload: req.body,
            });

            res.send({ res_jon });
            return;
        }

        query = { user_id: new ObjectID(data.user_id) };
        if (data.my_round) {
            if (typeof data.my_round === "object") {
                query.id = data.my_round.id;
            } else {
                query.id = data.my_round;
            }
        }

        if (data.id_course) {
            query.id_course = data.id_course;
        }

        if (data.id_courseTeeType) {
            query.id_courseTeeType = data.id_courseTeeType;
        }

        if (data.id_courseTeeColor) {
            query.id_courseTeeColor = data.id_courseTeeColor;
        }

        if (data.hole) {
            query.hole = data.hole;
        }

        const item = await thisDb.collection(table).find(query).toArray();
        if (item.length > 0) {
            let res_json = { status: "OK", };
            res_json.message = "Rounds(s) Found";
            res_json.myrounds = item;
            res.send({ res_json })
        } else {
            let res_json = { status: "FAILED", };
            res_json.message = "No round Found";
            res_json.myrounds = [];
            res.send({ res_json })
        }
    } catch (e) {
        await logError({
            thisDb,
            type: "other",
            action: "myrounds/get",
            error: e,
            table: table,
            payload: req.body,
            query,
        });
        let res_json = {
            status: "FAILED",
        }
        res_json.message = "Error in MyRounds Data.";
        res.res_json = res_json;
        res_json.myrounds = [];
        res.send({ res_jon });
    }

});

router.post("/delete", async (req, res) => {
    // delete rounds record.
    const db = req.db;
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;
    const thisDb = db.db("grass");
    const table = "myrounds" + suffix;
    let errMess = "";

    const data = req.body;

    let query = "";

    try {
        if (!data.user_id) {
            errMess = "User ID not sent.";
        }

        if (data.round_id) {
            if (data.my_round) {
                if (!data.my_round.id) {
                    data.my_round.id = data.round_id;
                }
            } else {
                data.my_round = {};
                data.my_round.id = data.round_id;
            }
        } else {
            if (data.my_round) {
                if (!data.my_round?.id) {
                    errMess = "Round ID not sent.";
                }
            } else {
                errMess = "Round ID not sent.";
            }
        }

        if (!data.my_round?.id) {
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
                action: "myrounds/delete",
                error: errMess,
                payload: req.body,
            });
            let res_json = {status: "FAILED"};

            res_json.message = errMess;

            res.send({ res_json });
            return;
        }

        const query = {id: data.my_round.id, user_id: new ObjectID(data.user_id) };

        const resp = await thisDb.collection(table).findOneAndDelete(query);
        if (resp) {
            logDocumentChange({
                thisDb,
                table: table,
                channel: "myrounds/delete",
                resp,
                newData: {},
                my_round: my_round,
                user_id: data.user_id,
            }).catch(err => {
                console.error("Change log failed:", err)
            });
            await deleteStats(data.user_id, data.my_round.id);
        }

        res.status(200).send({status: "OK", message: resp ? "Record deleted." : "No record found to delete."});
    } catch (e) {
        await logError({
            thisDb,
            type: "other",
            action: "myrounds/delete",
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

    async function deleteStats(user_id, round_id, thisDb, suffix) {
        const table = "stats" + suffix;

        const query = {user_id: user_id, round_id: round_id};

        await thisDb.collection(table).deleteMany(query);
    }
});

router.post("/update", async (req, res) => {
    // insert/update MyRounds record.
    const db = req.db;
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;
    const thisDb = db.db("grass");
    let query = "";
    let table = "myrounds" + suffix;
    let payload;

    try {
        const data = req.body;
        let obj_keys = [];
        
        if (typeof data !== "object") {
            await logError({
                thisDb,
                type: "validation",
                action: "myrounds/update",
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
        const my_round = data.my_round;
        const round_id = my_round.id;

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
                action: "myrounds/update",
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
            for (const [key, value] of Object.entries(my_round)) {
                if (key != "user_id" && key != "id" && key != "token") {
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
                    action: "myrounds/update",
                    error: "My Round not updated/inserted.",
                    query,
                    payload: data,
                    table: table
                });

                let res_json = {status: "FAILED"};

                res_json.message = "My Round not updated/inserted.";
                res.res_json = res_json;

                res.status(400).send({ message: "My Round not updated/inserted.", data: data });
                return;
            } else {
                updateStats(data, thisDb, suffix);
            }
        }
        res.status(200).send({status: "OK", data: data});
    } catch (e) {
        await logError({
            thisDb,
            type: "other",
            action: "myrounds/update",
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

    async function updateStats(data, thisDb, suffix) {
        const table = "stats" + suffix;

        const collectionDb = thisDb.collection(table);

        const query = {user_id: data.user_id, id: data.my_round.id};
        if (data.id_course != null) {
            query.id_course = data.id_course;
        }
        if (data.id_courseTeeType != null) {
            query.id_course = data.id_courseTeeType;
        }
        if (data.id_courseTeeColor != null) {
            query.id_course = data.id_courseTeeType;
        }

        const my_round = data.my_round;

        let old_hole = 0;
        let setFields = {};
        let stat_saved = {};

        for (const stats of my_round.hole_stats) {
            if (stats.hole != old_hole) {
                if (old_hole != 0) {
                    await saveStat(thisDb, suffix, setFields, query);
                }
                query.hole = stats.hole;
                stat_saved = await collectionDb.findOne(query);
                old_hole = stats.hole;
            }

            if (setFields.strokes == null) {
                setFields.strokes = [];
            }
            setFields.strokes.push(stats);
        }

        if (Object.keys(setFields).length > 0) {
            await saveStat(thisDb, suffix, setFields, query);
        }
    }

    async function saveStat(thisDb, suffix, setFields, query) {
        const statsDB = thisDb.collection("stats" + suffix);
        const tablesDB = thisDb.collection("table");

        for (const field of Object.keys(query)) {
            delete setFields[field];
        }

        await statsDB.updateOne(query, 
            {
                $set: {
                    ...setFields,
                    updated_at: new Date()
                },
                $setOnInsert: {
                    ...query,
                    created_at: new Date()
                }
            },
            { upsert: true }
        );
    }
});

module.exports = router;
