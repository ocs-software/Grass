const { response } = require("express");
const express = require("express");
const router = express.Router({ mergeParams: true });
const mongodb = require("mongodb");
let ObjectID = require('mongodb').ObjectID
const axios = require('axios');
const { getAppConfig } = require("../../config/app_config");
const { sendError } = require("../../util/commonFunctions");
const { logDocumentChange } = require("../../logs/changeLogger");
const { enqueueRankingRebuild, rebuildRankingDocuments } = require("../../util/rankingRound");

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

        if (!data.user_id) {
            return await sendError(res, 201, {
                thisDb,
                errMess: "User ID not sent.",
                type: "validation",
                action: "myrounds/get",
                payload: data,
                functionName: "myrounds/get"
            });
        }

        if (!data.token) {
            return await sendError(res, 202, {
                thisDb,
                errMess: "Token not sent.",
                type: "validation",
                action: "myrounds/get",
                payload: data,
                functionName: "myrounds/get"
            });
        }

        const user = await thisDb.collection("users" + suffix).findOne({_id: new ObjectID(data.user_id)});

        if (!user) {
            return await sendError(res, 204, {
                thisDb,
                errMess: "User not found.",
                type: "validation",
                action: "myrounds/get",
                user: data.user_id,
                payload: data
            });
        }

        if (data.token != user.token) {
            return await sendError(res, 203, {
                thisDb,
                errMess: "Token sent does not match with user.",
                type: "validation",
                action: "myrounds/get",
                user: data.user_id,
                payload: data
            });
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
        return await sendError(res, 400, {
            thisDb,
            errMess: e.message || "Error in getting myrounds data.",
            type: "other",
            action: "myrounds/get",
            error: e,
            payload: req.body,
            table: table,
            query: query,
            functionName: "myrounds/get"
        });
    }

});

router.post("/delete", async (req, res) => {
    // delete rounds record.
    const db = req.db;
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;
    const thisDb = db.db("grass");
    const table = "myrounds" + suffix;

    const data = req.body;

    let query = "";

    try {
        if (!data.user_id) {
            return await sendError(res, 201, {
                thisDb,
                errMess: "User ID not sent.",
                type: "validation",
                action: "myrounds/delete",
                payload: data,
                functionName: "myrounds/delete"
            });
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
                if (!data.my_round.id) {
                    return await sendError(res, 206, {
                        thisDb,
                        errMess: "Round ID not sent.",
                        type: "validation",
                        action: "myrounds/delete",
                        payload: data,
                        functionName: "myrounds/delete"
                    });
                }
            } else {
                return await sendError(res, 206, {
                    thisDb,
                    errMess: "Round ID not sent.",
                    type: "validation",
                    action: "myrounds/delete",
                    payload: data,
                    functionName: "myrounds/delete"
                });
            }
        }

        if (errMess == "" && !data.my_round.id) {
            return await sendError(res, 206, {
                thisDb,
                errMess: "Round ID not sent.",
                type: "validation",
                action: "myrounds/delete",
                payload: data,
                functionName: "myrounds/delete"
            });
        }

        if (!data.token) {
            return await sendError(res, 202, {
                thisDb,
                errMess: "Token not sent.",
                type: "validation",
                action: "myrounds/delete",
                payload: data,
                functionName: "myrounds/delete"
            });
        }

        const user = await thisDb.collection("users" + suffix).findOne({_id: new ObjectID(data.user_id)});

        if (!user) {
            return await sendError(res, 204, {
                thisDb,
                errMess: "User not found",
                type: "validation",
                action: "myrounds/delete",
                payload: data,
                functionName: "myrounds/delete"
            });
        }

        if (user && data.token != user.token) {
            return await sendError(res, 203, {
                thisDb,
                errMess: "Token sent does not match with user.",
                type: "validation",
                action: "myrounds/delete",
                payload: data,
                functionName: "myrounds/delete"
            });
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
                my_round: data.my_round,
                user_id: data.user_id,
            }).catch(err => {
                console.error("Change log failed:", err)
            });
            await deleteStats(data.user_id, data.my_round.id, thisDb, suffix);
        }

        res.status(200).send({status: "OK", message: resp ? "Record deleted." : "No record found to delete."});
    } catch (e) {
        return await sendError(res, 400, {
            thisDb,
            errMess: e.message || "Error in deleting myrounds data.",
            type: "other",
            action: "myrounds/delete",
            error: e,
            payload: req.body,
            table: table,
            query: query,
            functionName: "myrounds/delete"
        });
    }

    async function deleteStats(user_id, round_id, thisDb, suffix, completed) {
        const table = "stats" + suffix;

        const query = {user_id: user_id, round_id: round_id};

        await thisDb.collection(table).deleteMany(query);

        if (completed) {
            // TODO: use this when we are going to escalate and have more than one instance.
            //       It needs a worker(cron job) so only runs in one of the instances and keeps the ranking daily.
            // await enqueueRankingRebuild({thisDb, suffix, criteria: {}}); 
            await rebuildRankingDocuments({thisDb, suffix, criteria: {}});
        }
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
            return await sendError(res, 207, {
                thisDb,
                errMess: "Invalid data sent.",
                type: "validation",
                action: "myrounds/update",
                payload: data,
                functionName: "myrounds/update"
            });
        }

        const user_id = data.user_id;
        const my_round = data.my_round;
        const round_id = my_round.id;

        if (user_id === null || user_id === "") {
            return await sendError(res, 201, {
                thisDb,
                errMess: "User ID not sent.",
                type: "validation",
                action: "myrounds/update",
                payload: data,
                functionName: "myrounds/update"
            });
        }

        if (round_id === null || round_id === "") {
            return await sendError(res, 206, {
                thisDb,
                errMess: "Round ID not sent.",
                type: "validation",
                action: "myrounds/update",
                payload: data,
                functionName: "myrounds/update"
            });
        }

        if (!data.token) {
            return await sendError(res, 202, {
                thisDb,
                errMess: "Token not sent.",
                type: "validation",
                action: "myrounds/delete",
                payload: data,
                functionName: "myrounds/delete"
            });
        }

        const user = await thisDb.collection("users" + suffix).findOne({_id: new ObjectID(data.user_id)});

        if (user === null) {
            return await sendError(res, 204, {
                thisDb,
                errMess: "User not found",
                type: "validation",
                action: "myrounds/delete",
                payload: data,
                functionName: "myrounds/delete"
            });
        } else {
            if (data.token != user.token) {
                return await sendError(res, 203, {
                    thisDb,
                    errMess: "Token sent does not match with user.",
                    type: "validation",
                    action: "myrounds/update",
                    payload: data,
                    functionName: "myrounds/update"
                });
            }
        }

        const setFields = {};
        for (const [key, value] of Object.entries(my_round)) {
            if (key != "user_id" && key != "id" && key != "_id" && key != "token") {
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
            return await sendError(res, 204, {
                thisDb,
                errMess: "My Round not updated/inserted.",
                type: "other",
                action: "myrounds/update",
                payload: req.body,
                table: table,
                query: query,
                functionName: "myrounds/update"
            });
        } else {
            updateStats(data, thisDb, suffix);
        }
        res.status(200).send({status: "OK", data: data});
    } catch (e) {
        return await sendError(res, 400, {
            thisDb,
            errMess: e.message || "Error in updating myrounds data.",
            type: "other",
            action: "myrounds/update",
            error: e,
            payload: req.body,
            table: table,
            query: query,
            functionName: "myrounds/update"
        });
    }

    async function updateStats(data, thisDb, suffix) {
        const table = "stats" + suffix;

        const collectionDb = thisDb.collection(table);

        const query = {user_id: data.user_id, round_id: data.my_round.id};
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
                    await saveStat(thisDb, suffix, setFields, query, data.user_id, false);
                    setFields = {};
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
            await saveStat(thisDb, suffix, setFields, query, data.user_id, my_round.complete);
        }
    }

    async function saveStat(thisDb, suffix, setFields, query, user_id, completed) {
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

        if (completed) {
            // TODO: use this when we are going to escalate and have more than one instance.
            //       It needs a worker(cron job) so only runs in one of the instances and keeps the ranking daily.
            // await enqueueRankingRebuild({thisDb, suffix, criteria: {}}); 
            await rebuildRankingDocuments({thisDb, suffix, criteria: {}});
        }
    }
});

module.exports = router;
