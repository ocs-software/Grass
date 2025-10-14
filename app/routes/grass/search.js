const { response } = require("express");
const express = require("express");
const router = express.Router({ mergeParams: true });
const mongodb = require("mongodb");

router.get("/", async (req, res) => {
    try {
        const queries = req.query.q;

        db = req.db;
        const thisDb = db.db("grass");

        var errMess = "";

        /*
        var c_name = req.query.name;
        var v_name = req.query.v_name;
        var v_postcode = req.v_postcode;
        var v_country = req.v_country;
        console.log(c_name);
        console.log(v_name);
        console.log(v_postcode);
        console.log(v_country);
        */

        if (errMess !== "") {
            let res_json = {
                status: "FAILED",
            }
            res_json.message = errMess;
            res.send({ res_json });
        }
        else {
            // "$text" does full word matches and NOT partial
            // var f_match = "{ $or: [";
            /*
            var f_match = "";
            var f_add = false;
            if (c_name != '' && c_name != null && c_name != "undefined") {
                var f_cname = ' { "name": {$regex: new RegExp(' + c_name + ', "i") }';
                f_match += f_cname;
                f_add = true;
            }
            if (v_name != '' && v_name != null && v_name != "undefined") {
                if (f_add) {
                    f_match += ' , ';
                }
                // var f_vname = ' { "venue_name": {\'$regex\': new RegExp(' + v_name + ', "i") }';
                var f_vname = ' { "venue_name": {\'$regex\': ' + v_name + ', \'$options\': "i") }';
                f_match += f_vname;
                f_add = true;
            }
            if (v_postcode != '' && v_postcode != null && v_postcode != "undefined") {
                if (f_add) {
                    f_match += ' , ';
                }
                var f_postcode = '  { "venue_postcode": {$regex: new RegExp(' + v_postcode + ', "i") }';
                f_match += f_postcode;
                f_add = true;
            }
            if (v_country != '' && v_country != null && v_country != "undefined") {
                if (f_add) {
                    f_match += ' , ';
                }
                var f_country = ' { "venue_country": {$regex: new RegExp(' + v_country + ', "i") }';
                f_match += f_country;
            }

            // f_match += "] }";

            var r_venue = new RegExp(v_name, "i");
            const projectFields = {
                '_id': 0,
                'venue': 0,
                'owner': 0,
                'course': 0
            };
            */
            let agg_query = [
                /*
                { '$match': { venue_name: { $regex: r_venue } } },
                // { '$match': { 'name': { $regex: new RegExp(v_name, "i") } } },
                // { '$match': { 'name': {$regex: new RegExp(c_name, "i") }, 'venue_name': new RegExp(v_name), 'venue_postcode': new RegExp(v_postcode), 'venue_country': new RegExp(v_country) } },
                // { '$match': f_match },
                {
                    '$project': {
                        projectFields
                    }
                }
                    */
                { '$match': { '$text': { $search: queries } } },
                {
                    '$project': {
                        '_id': 0,
                        'venue': 0,
                        'owner': 0,
                        // 'course': 0,
                        'created': 0,
                        'updated': 0,
                        'unix_timestamp': 0
                    }
                }];
            // thisDb.collection("courses").find(agg_query).toArray(function (err, item) {
            // thisDb.collection("courses").find({ venue_name: { regex: r_venue } }).toArray(function (err, item) {
            // thisDb.collection("courses").find({ "venue_name": { "$regex": v_name, "$options": 'i' } }).toArray(function (err, item) {
            thisDb.collection("courses").aggregate(agg_query).toArray(function (err, item) {
                if (err) {
                    console.log(err)
                    let res_json = { status: "FAILED", };
                    res_json.message = "Fetching Course Details";
                    res.send({ res_json });
                } else {
                    if (item.length > 0) {
                        let res_json = { status: "OK", };
                        res_json.message = "Courses Found";
                        // res_json.courses = item;
                        res_json.courses = {};
                        for (var i = 0; i < item.length; i++) {
                            res_json.courses[i] = item[i];
                            res_json.courses[i].hole_data = JSON.parse(item[i].hole_data);
                        }
                        res.send({ res_json })
                    } else {
                        let res_json = { status: "FAILED", };
                        res_json.message = "No Courses Found";
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
        res_json.message = "Error in Course Data.";
        res.res_json = res_json;
        res.send({ res_jon });
    }

});

router.post("/users", async (req, res) => {
    try {
        // const queries = req.query.q;

        db = req.db;
        const thisDb = db.db("grass");

        var errMess = "";

        if (errMess !== "") {
            let res_json = {
                status: "FAILED",
            }
            res_json.message = errMess;
            res.send({ res_json });
        }
        else {
            thisDb.collection("users").find().toArray(function (err, item) {
                if (err) {
                    console.log(err)
                    let res_json = { status: "FAILED", };
                    res_json.message = "Fetching Users Details";
                    res.send({ res_json });
                } else {
                    if (item.length > 0) {
                        let res_json = { status: "OK", };
                        res_json.message = "Users Found";
                        res_json.users = item;
                        res.send({ res_json })
                    } else {
                        let res_json = { status: "FAILED", };
                        res_json.message = "No Users Found";
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
        res_json.message = "Error in Users Data.";
        res.res_json = res_json;
        res.send({ res_jon });
    }

});
module.exports = router;
