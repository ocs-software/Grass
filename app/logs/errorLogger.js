const { getAppConfig } = require("../config/app_config");
const { sanitizeLogValue } = require("./logSanitizer");

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
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;

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

    if (query !== undefined) {
        errorDoc.query = sanitizeLogValue(query);
    }

    if (payload !== undefined) {
        errorDoc.payload = sanitizeLogValue(payload);
    }

    if (user !== undefined) {
        errorDoc.user = sanitizeLogValue(user);
    }

    if (extra !== undefined) {
        errorDoc.extra = sanitizeLogValue(extra);
    }

    if (table !== undefined) {
        errorDoc.table = table;
    }

    if (functionName !== undefined) {
        errorDoc.functionName = functionName;
    }

    await thisDb.collection("error_logs" + suffix).insertOne(errorDoc);
}

module.exports = { logError };
