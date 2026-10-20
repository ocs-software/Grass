/**
 * Persists structured application errors to the environment-specific
 * error_logs collection. Potentially sensitive contextual objects are
 * sanitised before they are stored.
 */
const { getAppConfig } = require("../config/app_config");
const { sanitizeLogValue } = require("./logSanitizer");

/**
 * Writes an application error and optional diagnostic context to MongoDB.
 *
 * `thisDb` is supplied by the calling route so the logger uses the same
 * database context as the failed operation.
 */
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
