const { response } = require("express");
const express = require("express");
const router = express.Router({ mergeParams: true });
const mongodb = require("mongodb");
const { getAppConfig } = require("../../config/app_config");

router.get("/", async (req, res) => {

    db = req.db;
    const thisDb = db.db("grass");
    let query;
    let table;
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;

    try {
        const queries = req.query.q;

        query = [
            { '$match': { '$text': { $search: queries } } },
            {
                '$project': {
                    '_id': 0,
                    'venue': 0,
                    'owner': 0,
                    'created': 0,
                    'updated': 0,
                    'unix_timestamp': 0
                }
            }
        ];

        table = "courses" + suffix;
        const item = await thisDb.collection(table).aggregate(query).toArray();
        if (item.length > 0) {
            let res_json = { status: "OK", };
            res_json.message = "Courses Found";
            res_json.courses = {};
            for (var i = 0; i < item.length; i++) {
                res_json.courses[i] = item[i];
                res_json.courses[i].hole_data = JSON.parse(item[i].hole_data);
            }
            res.send({ res_json })
        } else {
            let res_json = { status: "FAILED", };
            res_json.message = "No Courses Found";
            await logError({
                thisDb,
                type: "validation",
                action: "search",
                error: res_json.message,
                query,
                payload: req.query,
                table: table,
            });
            res.send({ res_json })
        }
    } catch (e) {
        await logError({
            thisDb,
            type: "other",
            action: "search",
            error: e,
            query,
            payload: req.query,
            table: table,
        });
        let res_json = {
            status: "FAILED",
        }
        res_json.message = "Error in Course Data.";
        res.res_json = res_json;
        res.send({ res_jon });
    }

});

router.get("/users", async (req, res) => {
    db = req.db;
    const thisDb = db.db("grass");
    let query;
    let table;
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;

    try {
       table = "users" + suffix;
       const item = await  thisDb.collection(table).find().toArray();
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
    } catch (e) {
        await logError({
            thisDb,
            type: "other",
            action: "search/users(get)",
            error: e,
            table: table,
        });
        let res_json = {
            status: "FAILED",
        }
        res_json.message = "Error in Users Data.";
        res.res_json = res_json;
        res.send({ res_jon });
    }
});

router.post("/users", async (req, res) => {
    db = req.db;
    const thisDb = db.db("grass");
    let query;
    let table;
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;

    try {
        table = "users" + suffix;
        const item = await thisDb.collection(table).find().toArray();
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
    } catch (e) {
        await logError({
            thisDb,
            type: "other",
            action: "search/users(post)",
            error: e,
            table: table,
        });
        let res_json = {
            status: "FAILED",
        }
        res_json.message = "Error in Users Data.";
        res.res_json = res_json;
        res.send({ res_jon });
    }

});
module.exports = router;
