const logger = require("../logs/winston_logger");
const { sanitizeLogValue, sanitizeLogUrl } = require("./logSanitizer");

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
