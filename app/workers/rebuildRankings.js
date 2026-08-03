const { rebuildRankingDocuments } = require("../util/rankingRound");
const { getAppConfig } = require("../config/app_config");

/**
 * Rebuilds the overall ranking.
 *
 * @param {import("mongodb").Db} thisDb
 * @returns {Promise<void>}
 */
async function rebuildOverallRanking(thisDb) {
    if (!thisDb) {
        throw new Error("MongoDB database connection was not provided.");
    }

    const dbConn = thisDb.db("grass");

    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;

    console.log(
        `[ranking] Overall ranking rebuild started at ${new Date().toISOString()}`
    );

    await rebuildRankingDocuments({
        thisDb,
        suffix,
        criteria: {}
    });

    console.log(
        `[ranking] Overall ranking rebuild completed at ${new Date().toISOString()}`
    );
}

module.exports = {
    rebuildOverallRanking
};