const cron = require("node-cron");
const archiveCollection = require("./app/workers/archiveWorker");

const collections = [

    {
        sourceCollection: "error_logs",
        archiveCollection: "error_logs_archive",
        dateField: "created_at",
        retentionDays: 30
    },

    {
        sourceCollection: "logs",
        archiveCollection: "logs_archive",
        dateField: "created_at",
        retentionDays: 60
    }

];

module.exports = function (db) {

    // every day at 02:00

    console.log("schedule creation");
    cron.schedule("0 2 * * *", async () => {

        console.log("Archive job started");

        for (const c of collections) {

            try {

                const count = await archiveCollection(db, c);

                console.log(
                    `${c.sourceCollection}: archived ${count} documents`
                );

            } catch (err) {

                console.error(
                    `${c.sourceCollection}:`,
                    err.message
                );

            }

        }

        console.log("Archive job finished");

    });

};