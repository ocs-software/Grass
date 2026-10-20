/**
 * Establishes the Mongoose connection used by middleware that depends on
 * Mongoose models. The connection string is supplied through DATABASE_URL.
 */
const mongoose = require("mongoose");
const MONGOURI = process.env.DATABASE_URL;

/**
 * Opens the configured Mongoose connection. Connection errors are re-thrown
 * so application startup/callers can handle the failure.
 */
const InitiateMongoServer = async () => {
    try {
        await mongoose.connect(MONGOURI);
    } catch (e) {
        console.log(e);
        throw e;
    }
};

module.exports = InitiateMongoServer;
