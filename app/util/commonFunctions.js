const { logError } = require("../logs/errorLogger");

async function sendError(res, statusCode, fields = {}) {
    const errMess = fields.errMess || fields.message || "Unknown error";

    try {
        await logError({
            ...fields,
            errMess
        });
    } catch (logErr) {
        console.error("Failed to write error log:", logErr);
    }

    const return_json = {};
    return_json.status = fields.status ?? "FAILED";
    return_json.data = fields.data ?? {};
    return_json.user_email = fields.user_email ?? "";
    return_json.user = fields.user ?? {};
    return_json.message = errMess;

    return res.status(statusCode).send(return_json);
}

module.exports = {sendError};