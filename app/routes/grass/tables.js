const { response } = require("express");
const express = require("express");
const router = express.Router({ mergeParams: true });
const mongodb = require("mongodb");
let ObjectID = require('mongodb').ObjectID
const axios = require('axios');
const { getAppConfig } = require("../../config/app_config");

router.post("/get", async (req, res) => {
    db = req.db;
    const thisDb = db.db("grass")
    let query;
    let table;
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;

    try {
        const { table_id } = req.body;
        response.data = req.body;

        if (table_id === null || table_id === "") {
            table_id = "OPTIONS";
        }

        query = { table_id: table_id };
        table = "table" + suffix;

        const item = await thisDb.collection(table).find(query).toArray();
        if (item.length > 0) {
            let res_json = { status: "OK", };
            res_json.message = "Table Found";
            res_json.table = item;
            res.send({ res_json })
        } else {
            let res_json = { status: "FAILED", };
            res_json.message = "No Table Found";
            res_json.table = {};
            res.send({ res_json })
        }
    } catch (e) {
        await logError({
            thisDb,
            type: "other",
            action: "tables/get",
            error: e,
            table: table,
            payload: req.body,
            query,
        });
        let res_json = {
            status: "FAILED",
        }
        res_json.message = "Error in Table Data.";
        res.res_json = res_json;
        res_json.table = {};
        res.send({ res_jon });
    }

});

router.post("/update", async (req, res) => {
    db = req.db;
    const thisDb = db.db("grass")
    let query;
    let table;
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;

    try {
        const { code, table_id, data } = req.body;
        response.data = req.body;

        var errMess = "";
        if (code === null || code === "") {
            errMess = "Table Code Missing";
        }
        if (data === null || data === "") {
            errMess += " Table Data Missing";
        }
        if (table_id === null || table_id === "") {
            table_id = "OPTIONS";
        }

        if (errMess !== "") {
            await logError({
                thisDb,
                type: "validation",
                action: "users/import",
                error: errMess,
                payload: req.body,
            });
            let res_json = {
                status: "FAILED",
            }
            res_json.message = errMess;
            res.res_json = res_json;
            res.send({ res_json });
        } else {
            query = { table_id: table_id };
            table = "table" + suffix;
            const item = await thisDb.collection(table).find(query).toArray();
            var options = {};
            var newvalues = {};
            if (item.length > 0) {
                //  console.log("Updating")
                if (code == "99") {
                    newvalues = {
                        $set: {
                            as_groups: data,
                            updated: new Date(Date.now()),
                            unix_timestamp: Date.now()
                        }
                    };
                }
                if (code == "22") {
                    newvalues = {
                        $set: {
                            as_pos: data,
                            updated: new Date(Date.now()),
                            unix_timestamp: Date.now()
                        }
                    };
                }
                if (code == "23") {
                    newvalues = {
                        $set: {
                            as_lie: data,
                            updated: new Date(Date.now()),
                            unix_timestamp: Date.now()
                        }
                    };
                }
                if (code == "24") {
                    newvalues = {
                        $set: {
                            as_clubs: data,
                            updated: new Date(Date.now()),
                            unix_timestamp: Date.now()
                        }
                    };
                }
                if (code == "25") {
                    newvalues = {
                        $set: {
                            as_oos: data,
                            updated: new Date(Date.now()),
                            unix_timestamp: Date.now()
                        }
                    };
                }
            } else {
                if (code == "99") {
                    newvalues = {
                        $set: {
                            table_id: table_id,
                            as_groups: data,
                            updated: new Date(Date.now()),
                            unix_timestamp: Date.now()
                        }
                    };
                }
                if (code == "22") {
                    newvalues = {
                        $set: {
                            table_id: table_id,
                            as_pos: data,
                            created: new Date(Date.now()),
                            updated: new Date(Date.now()),
                            unix_timestamp: Date.now()
                        }
                    };
                }
                if (code == "23") {
                    newvalues = {
                        $set: {
                            table_id: table_id,
                            as_lie: data,
                            created: new Date(Date.now()),
                            updated: new Date(Date.now()),
                            unix_timestamp: Date.now()
                        }
                    };
                }
                if (code == "24") {
                    newvalues = {
                        $set: {
                            table_id: table_id,
                            as_clubs: data,
                            created: new Date(Date.now()),
                            updated: new Date(Date.now()),
                            unix_timestamp: Date.now()
                        }
                    };
                }
                if (code == "25") {
                    newvalues = {
                        $set: {
                            table_id: table_id,
                            as_oos: data,
                            created: new Date(Date.now()),
                            updated: new Date(Date.now()),
                            unix_timestamp: Date.now()
                        }
                    };
                }
            };
            options = { upsert: true };

            const result = await thisDb.collection("table").updateOne(query, newvalues, options);
            let res_json = {
                status: "OK",
            }
            res.send({ res_json });
        }
    } catch (e) {
        await logError({
            thisDb,
            type: "validation",
            action: "users/import",
            error: errMess,
            payload: req.body,
            table: table,
            query,
        });
        let res_json = {
            status: "FAILED",
        }
        res_json.message = "Error in Fetching data.";
        res.res_json = res_json;
        res.status(400).send({ message: "Error in Fetching data.", data: e });
    }
});

module.exports = router;
