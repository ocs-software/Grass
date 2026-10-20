const { response } = require("express");
const express = require("express");
const router = express.Router({ mergeParams: true });
const { getAppConfig } = require("../../config/app_config");
const { sendError } = require("../../util/commonFunctions");

/**
 * Retrieves an application lookup-table document by `table_id`.
 *
 * Lookup data contains shared definitions used throughout Grass, including
 * positions, lies, clubs, outcomes and other option lists. The environment
 * suffix selects the collection used by the current deployment.
 */
router.post("/get", async (req, res) => {
    db = req.db;
    const thisDb = db.db("grass")
    let query;
    let table;
    const result = {};
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;

    try {
        let { table_id } = req.body;
        result.data = req.body;

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
        return await sendError(res, 400, {
            thisDb,
            errMess: e.message || "Error in getting tables.",
            type: "other",
            action: "tables/get",
            error: e,
            payload: req.body,
            functionName: "tables/get"
        });
    }

});

/**
 * Updates one section of the shared OPTIONS lookup table.
 *
 * `code` identifies which lookup array is replaced (for example positions,
 * lies, clubs or outcomes). The operation uses an upsert so the table can be
 * created when it does not already exist, while update timestamps are refreshed
 * on every write.
 */
router.post("/update", async (req, res) => {
    db = req.db;
    const thisDb = db.db("grass")
    let query;
    let table;
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;

    try {
        const { code, data } = req.body;
        let { table_id } = req.body;
        response.data = req.body;

        if (code === null || code === "") {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Table Code Missing.",
                type: "validation",
                action: "tables/update",
                payload: req.body,
                table: table,
                functionName: "tables/update"
            });
        }
        if (data === null || data === "") {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Table data Missing.",
                type: "validation",
                action: "tables/update",
                payload: req.body,
                table: table,
                functionName: "tables/update"
            });
        }
        if (table_id === null || table_id === "") {
            table_id = "OPTIONS";
        }

        query = { table_id: table_id };
        table = "table" + suffix;
        await thisDb.collection(table).find(query).toArray();
        var options = {};
        var newvalues = {};

        /*
         * Translate the API's numeric table code into the corresponding field
         * in the OPTIONS document. Only the selected lookup section is replaced.
         */
        const updateFields = {
            updated: new Date(),
            unix_timestamp: new Date().getTime()
        };
        //  console.log("Updating")
        if (code == "99") {
            updateFields.as_groups = data;
        }
        if (code == "22") {
            updateFields.as_pos = data;
        }
        if (code == "23") {
            updateFields.as_lie = data;
        }
        if (code == "24") {
            updateFields.as_clubs = data;
        }
        if (code == "25") {
            updateFields.as_oos = data;
        }
        if (code == "26") {
            updateFields.as_dos = data;
        }
        if (code == "27") {
            updateFields.as_tos = data;
        }
        if (code == "28") {
            updateFields.as_units = data;
        }

        newvalues = {
            $set: updateFields,
            $setOnInsert: {
                create: new Date()
            }
        }
        options = { upsert: true };

        await thisDb.collection(table).updateOne(query, newvalues, options);
        let res_json = {
            status: "OK",
        }
        res.send({ res_json });
    } catch (e) {
        return await sendError(res, 400, {
            thisDb,
            errMess: e.message || "Error in updating tables.",
            type: "other",
            action: "tables/update",
            error: e,
            payload: JSON.stringify(req.body),
            functionName: "tables/update"
        });
    }
});

module.exports = router;
