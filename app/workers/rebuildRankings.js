
require('dotenv').config()
const MongoClient = require('mongodb').MongoClient;
const { rebuildRankingDocuments } = require("../util/rankingRound");
const { getAppConfig } = require("../config/app_config");

async function main() {
    const database_url = process.env.DATABASE_URL
    const db = {
        url: database_url
    }
    const client = await MongoClient.connect(db.url);

    try {
        const appConfig = getAppConfig();
        const suffix = appConfig.suffix;
        const thisDb = client.db(appConfig.database_name);

        await rebuildRankingDocuments({
            thisDb,
            suffix,
            criteria: {}
        });

        console.log("Overall ranking rebuilt.");
    } finally {
        await client.close();
    }
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });