const mongoose = require("mongoose");
const MONGOURI = process.env.DATABASE_URL;

const InitiateMongoServer = async () => {
    try {
        await mongoose.connect(MONGOURI);
    } catch (e) {
        console.log(e);
        throw e;
    }
};

module.exports = InitiateMongoServer;
