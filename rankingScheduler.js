const cron = require("node-cron");
const { rebuildOverallRanking } = require("./app/workers/rebuildRankings");

/**
 * Starts the scheduled ranking rebuild.
 *
 * @param {import("mongodb").Db} thisDb
 * @param {Object} options
 * @param {string} options.schedule
 * @param {string} options.timezone
 */
function startRankingScheduler(
    thisDb,
    {
        schedule = "0 3 * * *",
        timezone = "Europe/London"
    } = {}
) {
    if (!thisDb) {
        throw new Error(
            "Cannot start ranking scheduler without a database connection."
        );
    }

    if (!cron.validate(schedule)) {
        throw new Error(`Invalid ranking cron expression: ${schedule}`);
    }

    const task = cron.schedule(
        schedule,
        async () => {
            try {
                await rebuildOverallRanking(thisDb);
            } catch (error) {
                console.error(
                    "[ranking] Scheduled rebuild failed:",
                    error
                );
            }
        },
        {
            timezone,
            noOverlap: true,
            name: "overall-ranking-rebuild"
        }
    );

    console.log(
        `[ranking] Scheduler enabled: "${schedule}" (${timezone})`
    );

    return task;
}

module.exports = {
    startRankingScheduler
};