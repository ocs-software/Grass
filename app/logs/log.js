/**
 * General HTTP request logger.
 *
 * Request/response data is sanitised before being passed to Winston so
 * credentials are not persisted in the MongoDB log transport. Sanitisation
 * operates on copies and does not modify the live Express request/response.
 */
const logger = require("../logs/winston_logger");
const { sanitizeLogValue, sanitizeLogUrl } = require("./logSanitizer");

/**
 * Records request metadata after allowing the middleware chain to continue.
 */
const log = function (req, res, next) {
    next();

    const safePath = sanitizeLogUrl(req.originalUrl);

    logger.info("Path " + safePath, {
        metadata: {
            path: safePath,
            req_body: sanitizeLogValue(req.body),
            params: sanitizeLogValue(req.params),
            query: sanitizeLogValue(req.query),
            result: sanitizeLogValue(res.data)
        }
    });
};

module.exports = log;
