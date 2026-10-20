const express = require("express");
const router = express.Router({ mergeParams: true });
const { getAppConfig } = require("../../config/app_config");
const { sendError } = require("../../util/commonFunctions");

/**
 * Searches the configured course collection using MongoDB text search.
 *
 * The search term is supplied through the `q` query-string parameter. The
 * response intentionally excludes internal course metadata and converts each
 * course's persisted `hole_data` JSON string back into an object before it is
 * returned to the caller.
 */
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
            return await sendError(res, 200, {
                thisDb,
                errMess: "No Courses Found.",
                type: "validation",
                action: "search",
                payload: req.query,
                query: query,
                table: table,
                functionName: "search"
            });
        }
    } catch (e) {
        return await sendError(res, 400, {
            thisDb,
            errMess: e.message || "Error in getting courses.",
            type: "other",
            action: "search",
            error: e,
            payload: req.query,
            functionName: "search"
        });
    }

});

/**
 * Returns all user documents from the environment-specific users collection.
 *
 * This is a legacy search endpoint: it does not apply an additional filter in
 * this route and therefore relies on the surrounding API/middleware controls
 * to determine who may call it.
 */
router.get("/users", async (req, res) => {
    db = req.db;
    const thisDb = db.db("grass");
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
        return await sendError(res, 400, {
            thisDb,
            errMess: e.message || "Error in getting users.",
            type: "other",
            action: "search/users",
            error: e,
            functionName: "search/users"
        });
    }
});

/**
 * POST variant of the legacy user-list search endpoint.
 *
 * Its current behaviour mirrors GET /users and returns the complete users
 * collection; the request body is not currently used to narrow the query.
 */
router.post("/users", async (req, res) => {
    db = req.db;
    const thisDb = db.db("grass");
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
        return await sendError(res, 400, {
            thisDb,
            errMess: e.message || "Error in getting users.",
            type: "other",
            action: "search/users",
            error: e,
            functionName: "search/users"
        });
    }

});
module.exports = router;
