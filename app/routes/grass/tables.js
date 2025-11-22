const { response } = require("express");
const express = require("express");
const router = express.Router({ mergeParams: true });
const mongodb = require("mongodb");
let ObjectID = require('mongodb').ObjectID
const axios = require('axios');

router.post("/update", async (req, res) => {
    try {
        const { code, table_id, data } = req.body;
        response.data = req.body;

        db = req.db;
        const thisDb = db.db("grass")

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
            let res_json = {
                status: "FAILED",
            }
            res_json.message = errMess;
            res.res_json = res_json;
            res.send({ res_json });
        }
        else {
            // let query = { table_id: 'OPTIONS' };
            let query = { table_id: table_id };
            thisDb.collection("table").find(query).toArray(function (err, item) {
                if (err) {
                    console.log(err)
                    let res_json = { status: "FAILED", };
                    res_json.message = "An error getting table record";
                    res.send({ res_json });
                } else {
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
                        // console.log("creating")
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
                }
                // console.log(options);
                // console.log(newvalues);
                thisDb.collection("table").updateOne(query, newvalues, options, function (err, result) {
                    if (err) {
                        return res.status(500).json({
                            status: "FAILED",
                            message: "Error Updating Table",
                            error: err
                        });
                    } else {
                        let res_json = {
                            status: "OK",
                        }
                        res.send({ res_json });
                    }
                });
            });
        }
    } catch (e) {
        console.log(e)
        let res_json = {
            status: "FAILED",
        }
        res_json.message = "Error in Fetching data.";
        res.res_json = res_json;
        res.status(400).send({ message: "Error in Fetching data.", data: e });
    }
});

module.exports = router;
