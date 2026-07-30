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

    let res_json = { status: fields.status ?? "FAILED" };
    // return_json.status = fields.status ?? "FAILED";
    res_json.data = fields.data ?? {};
    res_json.user_email = fields.user_email ?? "";
    res_json.user = fields.user ?? {};
    res_json.message = errMess;
    res.res_json = res_json;

    return res.status(statusCode).send(res_json);
}

module.exports = { sendError };