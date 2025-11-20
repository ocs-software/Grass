const { response } = require("express");
const express = require("express");
const router = express.Router({ mergeParams: true });
const mongodb = require("mongodb");
let ObjectID = require('mongodb').ObjectID
const axios = require('axios');

router.post("/update", async (req, res) => {
    try {
        console.log("Hello");
        const { code, data } = req.body;
        response.data = req.body;

        console.log(code);
        console.log(data);
        db = req.db;
        const thisDb = db.db("grass")

        var errMess = "";
        if (code === null || code === "") {
            errMess = "Table Code Missing";
        }
        if (data === null || data === "") {
            errMess += " Table Data Missing";
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
            let query = { table_id: 'OPTIONS' };
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
                        console.log("Updating")
                        if (code == "21") {
                            newvalues = {
                                $set: {
                                    code_21: data,
                                    updated: new Date(Date.now()),
                                    unix_timestamp: Date.now()
                                }
                            };
                        }
                        if (code == "22") {
                            newvalues = {
                                $set: {
                                    code_22: data,
                                    updated: new Date(Date.now()),
                                    unix_timestamp: Date.now()
                                }
                            };
                        }
                        if (code == "23") {
                            newvalues = {
                                $set: {
                                    code_23: data,
                                    updated: new Date(Date.now()),
                                    unix_timestamp: Date.now()
                                }
                            };
                        }
                        if (code == "24") {
                            newvalues = {
                                $set: {
                                    code_24: data,
                                    updated: new Date(Date.now()),
                                    unix_timestamp: Date.now()
                                }
                            };
                        }
                        if (code == "25") {
                            newvalues = {
                                $set: {
                                    code_25: data,
                                    updated: new Date(Date.now()),
                                    unix_timestamp: Date.now()
                                }
                            };
                        }
                    } else {
                        console.log("creating")
                        if (code == "21") {
                            newvalues = {
                                $set: {
                                    table_id: 'OPTIONS',
                                    code_21: data,
                                    created: new Date(Date.now()),
                                    updated: new Date(Date.now()),
                                    unix_timestamp: Date.now()
                                }
                            };
                        }
                        if (code == "22") {
                            newvalues = {
                                $set: {
                                    table_id: 'OPTIONS',
                                    code_22: data,
                                    created: new Date(Date.now()),
                                    updated: new Date(Date.now()),
                                    unix_timestamp: Date.now()
                                }
                            };
                        }
                        if (code == "23") {
                            newvalues = {
                                $set: {
                                    table_id: 'OPTIONS',
                                    code_23: data,
                                    created: new Date(Date.now()),
                                    updated: new Date(Date.now()),
                                    unix_timestamp: Date.now()
                                }
                            };
                        }
                        if (code == "24") {
                            newvalues = {
                                $set: {
                                    table_id: 'OPTIONS',
                                    code_24: data,
                                    created: new Date(Date.now()),
                                    updated: new Date(Date.now()),
                                    unix_timestamp: Date.now()
                                }
                            };
                        }
                        if (code == "25") {
                            newvalues = {
                                $set: {
                                    table_id: 'OPTIONS',
                                    code_25: data,
                                    created: new Date(Date.now()),
                                    updated: new Date(Date.now()),
                                    unix_timestamp: Date.now()
                                }
                            };
                        }
                    };
                    options = { upsert: true };
                }
                console.log(options);
                console.log(newvalues);
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
