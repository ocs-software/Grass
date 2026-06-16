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
        if (data.round) {
            query.my_round = data.my_round;
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

    try {
        if (!data.user_id) {
            errMess = "User ID not sent.";
        }

        if (!data.my_round) {
            errMess = "Round ID not sent.";
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

        const query = {my_round: data.my_round, user_id: new ObjectID(data.user_id) };

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

        if (user_id === null || user_id === "") {
            errMess = "User ID is missing";
        }

        if (my_round === null || my_round === "") {
            errMess = "Round ID is missing";
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
        } else {
            query = { my_round: my_round, user_id: new ObjectID(user_id) };
            const collectionDb = thisDb.collection(table);

            result = await collectionDb.updateOne(
                query,
                [
                    {
                        $set: {
                            ...data, // only set fields sent by form
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
            } 
        }
        res.status(200).send({status: "OK", processed: result?.pcount, failed: result?.fcount, messages: result?.messages});
    } catch (e) {
        await logError({
            thisDb,
            type: "other",
            action: "myrounds/update",
            error: e,
            query,
            payload: data,
            table: table
        });

        let res_json = {status: "FAILED"};

        res_json.message = "Error in Fetching data.";
        res.res_json = res_json;

        res.status(400).send({ message: "Error in Fetching data.", data: e });
    }

    function endImport(thisDb, old_obj, new_obj, changed) {
        Promise.resolve()
            .then(async () => {
                const tourncode = old_obj?.tourncode ?? new_obj?.tourncode;
                const season = old_obj?.season ?? new_obj?.season;
                const tour_id = old_obj?.tour_id ?? new_obj?.tour_id;

                let table = "tourns" + suffix;

                const _id = old_obj?._id ?? await getTournId(tour_id, season, tourncode, thisDb, table);

                if (changed) {
                    await logDocumentChange({
                        thisDb,
                        table: table,
                        channel: "tourns/update",
                        old_obj,
                        newData: new_obj,
                        tourn_id: _id,
                        tourncode: tourncode
                    });
                }
            })
            .catch(err => {
                console.error("Change log failed:", err);
            });
    }
});


module.exports = router;
