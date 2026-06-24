const { getAppConfig } = require("../config/app_config");

async function logError({
    thisDb,
    errMess,
    type = "other",
    action = "unknown",
    error,

    query,
    payload,
    user,
    extra,
    table,
    functionName
}) {
    if (!thisDb) {
        console.error("logError missing thisDb");
        return;
    }

    const errorDoc = {
        type,
        action,
        message: errMess || "Unknown error",
        created_at: new Date()
    };

    if (error) {
        errorDoc.error = error.message || String(error);
        errorDoc.stack = error.stack || null;
    }

    if (query !== undefined) errorDoc.query = query;
    if (payload !== undefined) errorDoc.payload = payload;
    if (user !== undefined) errorDoc.user = user;
    if (extra !== undefined) errorDoc.extra = extra;
    if (table !== undefined) errorDoc.table = table;
    if (functionName !== undefined) errorDoc.functionName = functionName;

    await thisDb.collection("error_logs").insertOne(errorDoc);
}

module.exports = { logError };