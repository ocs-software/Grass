const BATCH_SIZE = 1000;

async function archiveCollection(thisDb, config) {

    const db = thisDb.db("grass");
    const {
        sourceCollection,
        archiveCollection,
        dateField,
        retentionDays
    } = config;

    const cutoff = new Date(
        Date.now() - (retentionDays * 24 * 60 * 60 * 1000)
    );

    let archived = 0;

    while (true) {

        const docs = await db.collection(sourceCollection)
            .find({
                [dateField]: {
                    $lt: cutoff
                }
            })
            .sort({
                [dateField]: 1
            })
            .limit(BATCH_SIZE)
            .toArray();

        if (!docs.length)
            break;

        const archivedAt = new Date();

        const bulk = docs.map(doc => ({

            updateOne: {

                filter: {
                    _id: doc._id
                },

                update: {
                    $setOnInsert: {
                        ...doc,
                        archived_at: archivedAt
                    }
                },

                upsert: true
            }

        }));

        await db.collection(archiveCollection)
            .bulkWrite(bulk, {
                ordered: false
            });

        await db.collection(sourceCollection)
            .deleteMany({
                _id: {
                    $in: docs.map(d => d._id)
                }
            });

        archived += docs.length;
    }

    return archived;
}

module.exports = archiveCollection;