const winston = require('winston');
require('winston-mongodb');
const winston_mongo_options = {
    db: process.env.WINSTON_MONGODB_URL,
    collection: "grass-log",
    tryReconnect: true,
    options: { useNewUrlParser: true, useUnifiedTopology: true }
    // expireAfterSeconds: 2592000
}
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json({
        timestamp: true
    }),
    // defaultMeta: { service: 'user-service' },
    transports: [
        // - Write all logs with level `error` and below to `error.log`
        // - Write all logs with level `info` and below to `combined.log`
        // new winston.transports.File({ filename: 'error.log', level: 'error', timestamp: true }),
        // new winston.transports.File({ filename: 'combined.log', timestamp: true }),
        new winston.transports.MongoDB(winston_mongo_options)
    ],
});
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.json(),
    }));
}

module.exports = logger
