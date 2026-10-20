const { logError } = require("../logs/errorLogger");

/**
 * Central error-response helper used by Grass routes. The diagnostic fields are
 * written through logError() first (where sensitive values are sanitised), then
 * a stable FAILED-style response is returned to the caller. A logging failure
 * must not prevent the original HTTP error response from being sent.
 */
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

    let res_json = { status: fields.status ?? "FAILED" };
    // return_json.status = fields.status ?? "FAILED";
    res_json.data = fields.data ?? {};
    res_json.user_email = fields.user_email ?? "";
    res_json.user = fields.user ?? {};
    res_json.message = errMess;

    return res.status(statusCode).send(res_json);
}

module.exports = { sendError };