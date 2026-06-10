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
    let table = "tourns" + suffix;

    try {
        const data = req.body;

        if (!data.season) {
            let res_json = {
                status: "FAILED",
            }
            res_json.message = "No season sent.";
            res.res_json = res_json;
            res_json.tourns = [];

            await logError({
                thisDb,
                type: "validation",
                action: "tourns/get",
                error: res_json.message,
                table: table,
                payload: req.body,
            });

            res.send({ res_jon });
        }

        query = { season: data.season };
        if (data.tourncode) {
            query.tourncode = data.tourncode;
        }

        const item = await thisDb.collection(table).find(query).toArray();
        if (item.length > 0) {
            let res_json = { status: "OK", };
            res_json.message = "Tournament(s) Found";
            res_json.tourns = item;
            res.send({ res_json })
        } else {
            let res_json = { status: "FAILED", };
            res_json.message = "No Tournmament Found";
            res_json.table = [];
            res.send({ res_json })
        }
    } catch (e) {
        await logError({
            thisDb,
            type: "other",
            action: "tourns/get",
            error: e,
            table: table,
            payload: req.body,
            query,
        });
        let res_json = {
            status: "FAILED",
        }
        res_json.message = "Error in Tournament Data.";
        res.res_json = res_json;
        res_json.tourns = [];
        res.send({ res_jon });
    }

});

router.post("/delete", async (req, res) => {
    const db = req.db;
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;
    const thisDb = db.db("grass");
    const table = "tourns" + suffix;
    let errMess = "";

    const data = req.body;

    try {
        if (!data.tour_code) {
            errMess = "Database code not sent.";
        }

        if (!data.season) {
            errMess = "Season code not sent.";
        }

        if (!data.tourncode) {
            errMess = "Tournament code not sent.";
        }

        if (!errMess) {
            await logError({
                thisDb,
                type: "validation",
                action: "tourns/delete",
                error: errMess,
                payload: req.body,
            });
            let res_json = {status: "FAILED"};

            res_json.message = errMess;

            res.send({ res_json });
            return;
        }

        const season = data.season;
        const tourncode = data.tourncode;
        const tour_id = await getTourId(data.tour_code, thisDb, suffix);

        const query = { tour_id: tour_id, season: season, tourncode, tourncode };

        const resp = await thisDb.collection(table).findOneAndDelete(query);
        if (resp) {
            logDocumentChange({
                thisDb,
                table: table,
                channel: "tourns/delete",
                resp,
                newData: {},
                tourn_id: _id,
                tourncode: tourncode,
                season: season,
            }).catch(err => {
                console.error("Change log failed:", err)
            });
        }

        res.status(200).send({status: "OK", message: resp ? "Record deleted." : "No record found to delete."});
    } catch (e) {
        await logError({
            thisDb,
            type: "other",
            action: "tourns/delete",
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
    const db = req.db;
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;
    const thisDb = db.db("grass");
    let result = {};
    let pcount = 0;
    let fcount = 0;
    let messages = [];
    let query = "";
    let table = "";
    let payload;

    try {
        const data = req.body;
        if (data?.tourns) {
            for (var tourn of data.tourns) {
                payload = tourn;
                result = await processData(tourn, result, thisDb, suffix, query, table);
            }
            res.status(200).send({status: "OK", processed: result?.pcount, failed: result?.fcount, messages: result?.messages})
        } else {
            result = await processData(data, result, thisDb, suffix, query, table);
            res.status(200).send({status: "OK", processed: result?.pcount, failed: result?.fcount, messages: result?.messages})
        }
    } catch (e) {
        await logError({
            thisDb,
            type: "other",
            action: "tourns/update",
            error: e,
            query,
            payload: tourn,
            table: table
        });

        let res_json = {status: "FAILED"};

        res_json.message = "Error in Fetching data.";
        res.res_json = res_json;

        res.status(400).send({ message: "Error in Fetching data.", data: e });
    }

    async function processData(data, res, thisDb, suffix, query, table) {
        let obj_keys = [];
        
        const tourn_obj = {};

        if (res?.pcount && res?.pcount > 0) {
            res.pcount++;
        } else {
            res = {
                pcount: 1,
                fcount: 0,
                messages: []
            };
        }

        if (typeof data === "object") {
            obj_keys = Object.keys(data);
        } else {
            await logError({
                thisDb,
                type: "validation",
                action: "tourns/update",
                error: "Invalid data sent",
                payload: data,
            });
            res.fcount++;
            res.messages.push({message: "Invalid data sent"});
            return res;
        }

        for (const key of obj_keys) {
            const value = data[key];
            if (typeof value !== "object") {
                tourn_obj[key] = typeof value === "string" ? value.replace(/\|'/g, "'") : value;
            } else {
                /* const other_data = value;
                const other_keys = Object.keys(other_data);
                if (other_keys.length > 0) {
                    for (const okey of other_keys) {
                        const ovalue = other_data[okey];
                        other_obj[okey] = typeof ovalue === "string" ? ovalue.replace(/\|'/g, "'") : ovalue;
                    }
                } */
            }
        }
        
        var errMess = "";

        const tourn_code = tourn_obj.tourncode;
        const season = tourn_obj.season;
        const tour_id = await getTourId(tourn_obj.tour_code, thisDb, suffix);
        tourn_obj.tour_id = tour_id;

        if (tourn_code === null || tourn_code === "") {
            errMess = "Tournament code is missing";
        }

        if (season === null || season === "") {
            errMess = "Season code is missing";
        }

        if (errMess !== "") {
            await logError({
                thisDb,
                type: "validation",
                action: "tourns/update",
                error: errMess,
                payload: data,
            });
            res.fcount++;
            res.messages.push({message: errMess});
            return res;
        } else {
            table = "tourns" + suffix;

            query = { tour_id: tour_id, season: season, tourncode: tourn_code };
            const tournsDb = thisDb.collection(table);

            let tourns = await tournsDb.find(query).toArray();

            let old_values = {};
            const setFields = {};
            const comparisons = [];
            let result;
            if (tourns.length > 0) {
                old_values = tourns[0];
            }

            for (const [key, value] of Object.entries(tourn_obj)) {
                if (key !== "tourncode" && key !== "season" && key != "tour_id") {
                    if (old_values[key] == null || old_values[key] != value) {
                        setFields[key] = value;
                        comparisons.push({
                            $ne: [`$${key}`, value]
                        });
                    }
                }
            }

            let tourn_changes = false;
            // check if we do have somethig to update
            if (Object.keys(setFields).length === 0) {
                res.fcount++;
                res.messages.push("Nothing to change");
                return res;
            } else {
                // Update/insert main record
                result = await tournsDb.updateOne(
                    query,
                    [
                        {
                            $set: {
                                ...setFields, // only set fields sent by form
                                updated: {
                                    $cond: [
                                        { $or: comparisons }, // only update "updated" timestamp if something changed
                                        "$$NOW",
                                        "$updated"
                                    ]
                                },
                                created: {
                                    $ifNull: ["$created", "$$NOW"] // if record does not exist, add field created;
                                }
                            }
                        }
                    ],
                    { upsert: true }
                );

                if (result.matchedCount === 0 && !result.upsertedId) {
                    // Failed
                    res.fcount++;
                    res.messages.push({message: "No Tournament Document found/inserted"});
                    return res;
                } else {
                    tourn_changes = (result.modifiedCount > 0 || result.upsertedId);
                }
            }

            // update/insert tour info
            let _id;
            
            if (old_values?._id) {
                _id = old_values._id;
            } else {
                if (result.upsertedId) {
                    _id = result.upsertedId;
                } else {
// same email with 2 different memberID, it happens almost at the same time so read the table again to get old_values.
                    tourns = await tournsDb.find(query).toArray();
                    if (tourns.length > 0) {
                        old_values = tourns[0];
                    }
                    if (old_values?._id) {
                        _id = old_values._id;
                    } else {
                        _id = tourncode;
                    }
                }
            }

            endImport(thisDb, old_values, tourn_obj, true);
            return res;
        }
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

router.post("/entry", async (req, res) => {
    const db = req.db;
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;
    const thisDb = db.db("grass");
    let result = {};
    let pcount = 0;
    let fcount = 0;
    let messages = [];
    let query = "";
    let table = "";
    let payload;

    try {
        const data = req.body;
        if (data?.entries) {
            for (var entry of data.entries) {
                payload = entry;
                result = await processData(payload, result, thisDb, suffix, query, table);
            }
            res.status(200).send({status: "OK", processed: result?.pcount, failed: result?.fcount, messages: result?.messages})
        } else {
            result = await processData(data, result, thisDb, suffix, query, table);
            res.status(200).send({status: "OK", processed: result?.pcount, failed: result?.fcount, messages: result?.messages})
        }
    } catch(e) {
        await logError({
            thisDb,
            type: "other",
            action: "tourns/entry",
            error: e,
            query,
            payload: payload,
            table: table
        });

        let res_json = {status: "FAILED"};

        res_json.message = "Error in Fetching data.";
        res.res_json = res_json;

        res.status(400).send({ message: "Error in Fetching data.", data: e });
    }

    async function processData(data, res, thisDb, suffix, query, table) {
        let obj_keys = [];
        
        const entry_obj = {};

        if (res?.pcount && res?.pcount > 0) {
            res.pcount++;
        } else {
            res = {
                pcount: 1,
                fcount: 0,
                messages: []
            };
        }

        if (typeof data === "object") {
            obj_keys = Object.keys(data);
        } else {
            await logError({
                thisDb,
                type: "validation",
                action: "tourns/entry",
                error: "Invalid data sent",
                payload: data,
            });
            res.fcount++;
            res.messages.push({message: "Invalid data sent"});
            return res;
        }

        for (const key of obj_keys) {
            const value = data[key];
            if (typeof value !== "object") {
                entry_obj[key] = typeof value === "string" ? value.replace(/\|'/g, "'") : value;
            } else {
                /* const other_data = value;
                const other_keys = Object.keys(other_data);
                if (other_keys.length > 0) {
                    for (const okey of other_keys) {
                        const ovalue = other_data[okey];
                        other_obj[okey] = typeof ovalue === "string" ? ovalue.replace(/\|'/g, "'") : ovalue;
                    }
                } */
            }
        }
        
        var errMess = "";

        const tourn_code = entry_obj.tourncode;
        const season = tourn_obj.season;
        const tour_id = await getTourId(entry_obj.tour_code, thisDb, suffix);
        entry_obj.tour_id = tour_id;

        const player_id = await getPlayerId($tour_id, entry_obj.user_email, thisDb, suffix);
        entry_obj.user_id = player_id;

        if (tourn_code === null || tourn_code === "") {
            errMess = "Tournament code is missing";
        }

        if (season === null || season === "") {
            errMess = "Season code is missing";
        }

        if (player_id === null || player_id === "") {
            errMess = "Player not sent";
        }

        if (errMess !== "") {
            await logError({
                thisDb,
                type: "validation",
                action: "tourns/entry",
                error: errMess,
                payload: data,
            });
            res.fcount++;
            res.messages.push({message: errMess});
            return res;
        } else {
            table = "tourns" + suffix;

            query = { tour_id: tour_id, season: season, tourncode: tourn_code };
            const tournsDb = thisDb.collection(table);

            let tourn = await tournsDb.findOne(query, {projection: { entries: 1}});

            let old_values = {};
            const setFields = {};
            const comparisons = [];
            let result;
            if (!tourn) {
                errMess = "Tournament not found";
                await logError({
                    thisDb,
                    type: "validation",
                    action: "tourns/entry",
                    error: errMess,
                    payload: data,
                });
                res.fcount++;
                res.messages.push({message: errMess});
                return res;
            }
            old_values = Array.isArray(tourn.entries) ? tourn.entries.find(entry => entry.player_id === player_id) : {};

            for (const [key, value] of Object.entries(entry_obj)) {
                if (key !== "tourncode" && key !== "season" && key != "tour_id") {
                    if (old_values[`entries.$.${key}`] == null || old_values[`entries.$.${key}`] != value) {
                        setFields[`entries.$.${key}`] = value;
                        comparisons.push({
                            $ne: [`$${key}`, value]
                        });
                    }
                }
            }

            if (Object.keys(old_values) > 0) {
                if (Object.keys(setFields).length <= 0) {
                    res.fcount++;
                    res.messages.push("Nothing to change");
                    return res;
                }
                setFields.updated_at = new Date();
                $query["entries.$.player_id"] = player_id;

                result = await tournsDb.updateOne(query, {$set: setFields});
            } else {
                result = await tournsDb.updateOne(query, {
                    $push: { 
                        entries: {
                            ...entry_obj
                        }
                    },
                    $set: {
                        update_at: "$$NOW"
                    }
                });
            }

            if (result.matchedCount === 0 && !result.upsertedId) {
                // Failed
                res.fcount++;
                res.messages.push({message: "No Tournament Document found/inserted"});
                return res;
            } 

            endImport(thisDb, old_values, entry_obj, true);
            return res;
        }
    }

    function endImport(thisDb, old_obj, new_obj, changed) {
        Promise.resolve()
            .then(async () => {
                const tourncode = old_obj?.tourncode ?? new_obj?.tourncode;
                const season = old_obj?.season ?? new_obj?.season;
                const tour_id = old_obj?.tour_id ?? new_obj?.tour_id;

                let table = "tourns" + suffix;

                const _id = old_obj._id;

                if (changed) {
                    await logDocumentChange({
                        thisDb,
                        table: table,
                        channel: "tourns/entry",
                        old_obj,
                        newData: new_obj,
                        tourn_id: _id,
                        tourncode: tourncode
                        player_id: new_obj.player_id
                    });
                }
            })
            .catch(err => {
                console.error("Change log failed:", err);
            });
    }
});


async function getTournId(tour_id, season, tourncode, thisDb, table) {
    const tournsDb = thisDb.collection(table);

    const query = {tour_id: tour_id, season: season, tourncode: tourncode};

    const result = await tournsDb.findOne(query);

    return result?._id ?? season + tourncode;
}

async function getTourId(tour_code, thisDb, suffix) {
    const toursDb = thisDb.collection("tours" + suffix);

    const query = {tour: tour_code};

    const result = await toursDb.findOne(query);

    return result?._id ?? tour_code;
}

module.exports = router;
