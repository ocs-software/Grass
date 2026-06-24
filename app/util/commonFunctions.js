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

    return res.status(statusCode).send({
        status: "FAILED",
        message: errMess
    });
}

module.exports = {sendError};