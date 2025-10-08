const logger = require("../logs/winston_logger");
const log = function (req, res, next) {
    next();
    let check = req.baseUrl + req.path;
    // if (!check.includes('upgame')) return;
    logger.info('Path ' + req.originalUrl, { metadata: { path: req.originalUrl, req_body: req.body, params: req.params, query: req.query, result: res.res_json } });
}
module.exports = log;
