const logger = require("../logs/winston_logger");
const log = function (req, res, next) {
    next();
    logger.info('Path ' + req.originalUrl, { metadata: { path: req.originalUrl, req_body: req.body, params: req.params, query: req.query, result: res.data } });
}
module.exports = log;
