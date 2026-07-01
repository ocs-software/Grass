const crypto = require("crypto");
let ObjectID = require('mongodb').ObjectID;
const { getAppConfig } = require("../config/app_config");

function normalizeCriteria(criteria = {}) {
    const { rootMatch, holeStatsMatch } = buildMatch(criteria);

    return {
        rootMatch,
        holeStatsMatch,
        normalizedCriteria: {
            rootMatch,
            holeStatsMatch
        }
    };
}
/**
 * Make object stringify stable so same criteria always creates same hash.
 */
 
function stableStringify(obj) {
    if (!obj || typeof obj !== "object") {
        return JSON.stringify(obj);
    }

    if (Array.isArray(obj)) {
        return JSON.stringify(obj.map(stableStringify));
    }

    const sorted = {};

    Object.keys(obj).sort().forEach((key) => {
        sorted[key] = obj[key];
    });

    return JSON.stringify(sorted);
}

function buildFilterHash(criteria) {
    return crypto
        .createHash("sha1")
        .update(stableStringify(criteria || {}))
        .digest("hex");
}

/**
 * Build MongoDB $match from API criteria.
 * Add/remove allowed fields as needed.
 */
function buildMatch(criteria = {}) {
    const rootMatch = {};
    const holeStatsMatch = {};

    for (const [key, value] of Object.entries(criteria)) {
        if (key === "date_from" || key === "date_to") continue;

        const config = getCriteriaConfig(key);

        const field = config.field;
        const target = config.source === "hole_stats" ? holeStatsMatch : rootMatch;

        target[config.source === "hole_stats" ? `hole_stats.${field}` : field] = value;
    }

    if (criteria.date_from || criteria.date_to) {
        rootMatch.played_at = {};

        if (criteria.date_from) {
            rootMatch.played_at.$gte = new Date(criteria.date_from);
        }

        if (criteria.date_to) {
            const endDate = new Date(criteria.date_to);
            endDate.setUTCHours(23, 59, 59, 999);
            rootMatch.played_at.$lte = endDate;
        }
    }

    return { rootMatch, holeStatsMatch };
}

function getStatConfig(stat) {
    const config = getAppConfig().STAT_MAP[stat];

    if (!config) {
        throw new Error("Invalid stat selected.");
    }

    return config;
}

function getCriteriaConfig(key) {
    const config = getAppConfig().CRITERIA_MAP[key];

    if (!config) {
        throw new Error("Invalid criteria selected.");
    }

    return config;
}

function buildPeerMatch(peerCriteria = {}) {
    const match = {};

    for (const [publicKey, value] of Object.entries(peerCriteria)) {
        if (value === undefined || value === null || value === "") {
            continue;
        }

        const config = getAppConfig().PEER_CRITERIA_MAP[publicKey];

        if (!config) {
            continue; // or throw error
        }

        const mongoField = `user.${config.field}`;
        const finalValue = config.type === "number" ? Number(value) : value;

        if (config.operator) {
            if (!match[mongoField]) {
                match[mongoField] = {};
            }

            match[mongoField][config.operator] = finalValue;
        } else {
            match[mongoField] = finalValue;
        }
    }

    return match;
}

function getPeerLookupStages({ suffix = "", peerCriteria = {} }) {
    const peerMatch = buildPeerMatch(peerCriteria);

    if (Object.keys(peerMatch).length === 0) {
        return [];
    }

    return [
        {
            $lookup: {
                from: "users" + suffix,
                localField: "_id",
                foreignField: "_id",
                as: "user"
            }
        },
        {
            $unwind: "$user"
        },
        {
            $match: peerMatch
        }
    ];
}

/**
 * Rebuild ranking documents for a specific criteria set.
 *
 * Source collection should usually be round_scores, not hole_scores.
 */
async function rebuildRankingDocuments({
    thisDb,
    suffix = "",
    criteria = {},
    sourceCollection = "myrounds",
    rankingCollection = "ranking_cache",
    scoreField = "total_score",
    lowerIsBetter = true
}) {
    const { rootMatch, holeStatsMatch, normalizedCriteria } = normalizeCriteria(criteria);
    const filterHash = buildFilterHash(normalizedCriteria);

    const source = thisDb.collection(sourceCollection + suffix);
    const sortDirection = lowerIsBetter ? 1 : -1;

    const statConfig = getStatConfig(data.stat || "total_score");

    const scoreStages = getScoreProjectionStages(statConfig, holeStatsMatch);

    const pipeline = [
       { $match: rootMatch },

        ...scoreStages,

        {
            $group: {
                _id: "$user_id",
                total_score: { $sum: "$score" },
                average_score: { $avg: "$score" },
                min_score: { $min: "$score" },
                max_score: { $max: "$score" },
                rounds: { $sum: 1 }
            }
        },

        {
            $setWindowFields: {
                sortBy: { average_score: sortDirection },
                output: {
                    rank: { $rank: {} }
                }
            }
        },

        {
            $addFields: {
                user_id: "$_id",
                filter_hash: filterHash,
                criteria: normalizedCriteria,
                calculated_at: "$$NOW"
            }
        },

        {
            $project: {
                _id: 0,
                filter_hash: 1,
                criteria: 1,
                user_id: 1,
                total_score: 1,
                average_score: 1,
                min_score: 1,
                max_score: 1,
                rounds: 1,
                rank: 1,
                calculated_at: 1
            }
        },

        {
            $merge: {
                into: rankingCollection + suffix,
                on: ["filter_hash", "user_id"],
                whenMatched: "replace",
                whenNotMatched: "insert"
            }
        }
    ];

    await source.aggregate(pipeline, { allowDiskUse: true }).toArray();

    return {
        status: "OK",
        filter_hash: filterHash,
        criteria: normalizedCriteria
    };
}

/**
 * Enqueue a ranking rebuild instead of rebuilding directly inside API request.
 */
async function enqueueRankingRebuild({
    thisDb,
    suffix = "",
    criteria = {},
    jobsCollection = "ranking_jobs"
}) {
    const { rootMatch, holeStatsMatch, normalizedCriteria } = normalizeCriteria(criteria);
    const filterHash = buildFilterHash(normalizedCriteria);

    await thisDb.collection(jobsCollection + suffix).updateOne(
        { filter_hash: filterHash },
        {
            $set: {
                filter_hash: filterHash,
                criteria: normalizedCriteria,
                status: "pending",
                updated_at: new Date()
            },
            $setOnInsert: {
                created_at: new Date()
            }
        },
        { upsert: true }
    );

    return {
        status: "QUEUED",
        filter_hash: filterHash,
        criteria: normalizedCriteria
    };
}

/**
 * Process one pending ranking job.
 * Call this from a cron/background worker.
 */
async function processOneRankingJob({
    thisDb,
    suffix = "",
    jobsCollection = "ranking_jobs",
    sourceCollection = "round_scores",
    rankingCollection = "ranking_cache",
    scoreField = "total_score",
    lowerIsBetter = true
}) {
    const jobs = thisDb.collection(jobsCollection + suffix);

    const jobResult = await jobs.findOneAndUpdate(
        { status: "pending" },
        {
            $set: {
                status: "running",
                started_at: new Date()
            }
        },
        {
            sort: { updated_at: 1 },
            returnDocument: "after"
        }
    );

    const job = jobResult && jobResult.value;

    if (!job) {
        return {
            status: "NO_PENDING_JOBS"
        };
    }

    try {
        await rebuildRankingDocuments({
            thisDb,
            suffix,
            criteria: job.criteria || {},
            sourceCollection,
            rankingCollection,
            scoreField,
            lowerIsBetter
        });

        const popularCriteria = await thisDb
            .collection("stats_criteria_usage" + suffix)
            .find({
                usage_count: { $gte: 50 }
            })
            .sort({ usage_count: -1 })
            .limit(20)
            .toArray();

        for (const item of popularCriteria) {
            await rebuildRankingDocuments({
                thisDb,
                suffix,
                criteria: item.criteria,
                scoreField: item.scoreField || "total_score"
            });
        }

        await jobs.updateOne(
            { _id: job._id },
            {
                $set: {
                    status: "completed",
                    completed_at: new Date()
                }
            }
        );

        return {
            status: "COMPLETED",
            filter_hash: job.filter_hash
        };
    } catch (err) {
        await jobs.updateOne(
            { _id: job._id },
            {
                $set: {
                    status: "failed",
                    error: err.message,
                    failed_at: new Date()
                }
            }
        );

        throw err;
    }
}

/**
 * Report using live stats + cached ranking.
 */
async function getPlayerReport({
    thisDb,
    suffix = "",
    userId,
    criteria = {},
    sourceCollection = "round_scores",
    rankingCollection = "ranking_cache",
    scoreField = "total_score"
}) {
    const { rootMatch, holeStatsMatch, normalizedCriteria } = normalizeCriteria(criteria);
    const filterHash = buildFilterHash(normalizedCriteria);

    const source = thisDb.collection(sourceCollection + suffix);
    const rankings = thisDb.collection(rankingCollection + suffix);

    const [liveStats] = await source.aggregate([
        { $match: rootMatch },

        {
            $project: {
                user_id: 1,
                score: `$${scoreField}`
            }
        },

        {
            $facet: {
                player: [
                    { $match: { user_id: new ObjectID(userId) } },
                    {
                        $group: {
                            _id: "$user_id",
                            average_score: { $avg: "$score" },
                            min_score: { $min: "$score" },
                            max_score: { $max: "$score" },
                            total_score: { $sum: "$score" },
                            rounds: { $sum: 1 }
                        }
                    }
                ],

                overall: [
                    {
                        $group: {
                            _id: null,
                            average_score: { $avg: "$score" },
                            min_score: { $min: "$score" },
                            max_score: { $max: "$score" },
                            total_score: { $sum: "$score" },
                            rounds: { $sum: 1 },
                            players: { $addToSet: "$user_id" }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            average_score: 1,
                            min_score: 1,
                            max_score: 1,
                            total_score: 1,
                            rounds: 1,
                            players_count: { $size: "$players" }
                        }
                    }
                ]
            }
        },

        {
            $project: {
                player: { $arrayElemAt: ["$player", 0] },
                overall: { $arrayElemAt: ["$overall", 0] }
            }
        }
    ], { allowDiskUse: true }).toArray();

    const ranking = await rankings.findOne({
        filter_hash: filterHash,
        user_id: new ObjectID(userId)
    });

    return {
        criteria: normalizedCriteria,
        filter_hash: filterHash,
        player: liveStats && liveStats.player ? liveStats.player : null,
        overall: liveStats && liveStats.overall ? liveStats.overall : null,
        ranking: ranking || null
    };
}

/**
 * Optional: fully live report including ranking.
 * Use only for smaller filtered datasets or admin/debug.
 */
async function getPlayerReportOnTheFly({
    thisDb,
    suffix = "",
    userId,
    criteria = {},
    peerCriteria = {},
    sourceCollection = "round_scores",
    stat = "total_score",
    lowerIsBetter
}) {
    await recordCriteriaUsage({ thisDb, suffix, criteria, stat });

    const { rootMatch, holeStatsMatch, normalizedCriteria } = normalizeCriteria(criteria);

    const statConfig = getStatConfig(stat);
    const sortDirection = lowerIsBetter ?? statConfig.lowerIsBetter ?? true ? 1 : -1;

    const source = thisDb.collection(sourceCollection + suffix);
    const scoreStages = getScoreProjectionStages(statConfig, holeStatsMatch);
    const peerStages = getPeerLookupStages({ suffix, peerCriteria });

    const userObjectId = new ObjectID(userId);
console.log("rootMatch", JSON.stringify(rootMatch));
console.log("holeStatsMatch", JSON.stringify(holeStatsMatch));
console.log("scoreStages", JSON.stringify(scoreStages, null, 2));
console.log("userId", userId, new ObjectID(userId));

    const pipeline = [
        { $match: rootMatch },
        ...scoreStages,

        {
            $facet: {
                player: [
                    { $match: { user_id: userObjectId } },
                    {
                        $group: {
                            _id: "$user_id",
                            average_score: { $avg: "$score" },
                            min_score: { $min: "$score" },
                            max_score: { $max: "$score" },
                            total_score: { $sum: "$score" },
                            records: { $sum: 1 }
                        }
                    }
                ],

                overall: [
                    {
                        $group: {
                            _id: null,
                            average_score: { $avg: "$score" },
                            min_score: { $min: "$score" },
                            max_score: { $max: "$score" },
                            total_score: { $sum: "$score" },
                            records: { $sum: 1 },
                            players: { $addToSet: "$user_id" }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            average_score: 1,
                            min_score: 1,
                            max_score: 1,
                            total_score: 1,
                            records: 1,
                            players_count: { $size: "$players" }
                        }
                    }
                ],

                ranking: [
                    {
                        $group: {
                            _id: "$user_id",
                            average_score: { $avg: "$score" },
                            total_score: { $sum: "$score" },
                            records: { $sum: 1 }
                        }
                    },
                    {
                        $setWindowFields: {
                            sortBy: { average_score: sortDirection },
                            output: { rank: { $rank: {} } }
                        }
                    },
                    { $match: { _id: userObjectId } }
                ],

                overallPeers: [
                    {
                        $group: {
                            _id: "$user_id",
                            average_score: { $avg: "$score" },
                            total_score: { $sum: "$score" },
                            records: { $sum: 1 }
                        }
                    },
                    ...peerStages,
                    {
                        $group: {
                            _id: null,
                            average_score: { $avg: "$average_score" },
                            total_score: { $sum: "$total_score" },
                            records: { $sum: "$records" },
                            players_count: { $sum: 1 }
                        }
                    }
                ],

                rankingPeers: [
                    {
                        $group: {
                            _id: "$user_id",
                            average_score: { $avg: "$score" },
                            total_score: { $sum: "$score" },
                            records: { $sum: 1 }
                        }
                    },
                    ...peerStages,
                    {
                        $setWindowFields: {
                            sortBy: { average_score: sortDirection },
                            output: { rank: { $rank: {} } }
                        }
                    },
                    { $match: { _id: userObjectId } }
                ]
            }
        },

        {
            $project: {
                player: { $ifNull: [{$arrayElemAt: ["$player", 0]}, null] },
                overall: { $ifNull: [{$arrayElemAt: ["$overall", 0]}, null] },
                ranking: { $ifNull: [{$arrayElemAt: ["$ranking", 0]}, null] },
                overallPeers: { $ifNull: [{$arrayElemAt: ["$overallPeers", 0]}, null] },
                rankingPeers: { $ifNull: [{$arrayElemAt: ["$rankingPeers", 0]}, null] },
                // criteria: normalizedCriteria
            }
        }
    ];

    const [result] = await source.aggregate(pipeline, { allowDiskUse: true }).toArray();

    console.dir(result, { depth: null });

    return result || {
        player: null,
        overall: null,
        ranking: null,
        overallPeers: null,
        rankingPeers: null,
        criteria: normalizedCriteria
    };
}

async function recordCriteriaUsage({
    thisDb,
    suffix = "",
    criteria = {},
    stat = "total_score",
    collection = "stats_criteria_usage"
}) {
    const { normalizedCriteria } = normalizeCriteria(criteria);

    const filterHash = buildFilterHash({
        criteria: normalizedCriteria,
        stat
    });

    await thisDb.collection(collection + suffix).updateOne(
        { filter_hash: filterHash },
        {
            $set: {
                filter_hash: filterHash,
                criteria: normalizedCriteria,
                stat,
                last_used_at: new Date()
            },
            $inc: { usage_count: 1 },
            $setOnInsert: { created_at: new Date() }
        },
        { upsert: true }
    );

    return filterHash;
}

function getScoreProjectionStages(statConfig, holeStatsMatch = {}) {
    if (statConfig.source === "hole_stats") {
        return [
            { $unwind: "$hole_stats" },

            ...(Object.keys(holeStatsMatch).length
                ? [{ $match: holeStatsMatch }]
                : []),

            {
                $project: {
                    user_id: 1,
                    score: `$hole_stats.${statConfig.field}`
                }
            },

            {
                $match: {
                    score: { $nin: [null, 0, "", false] }
                }
            }
        ];
    }

    return [
        {
            $project: {
                user_id: 1,
                score: `$${statConfig.field}`
            }
        },
        {
            $match: {
                score: { $nin: [null, 0, "", false] }
            }
        }
    ];
}

module.exports = {
    buildMatch,
    buildFilterHash,
    rebuildRankingDocuments,
    enqueueRankingRebuild,
    processOneRankingJob,
    getPlayerReport,
    getPlayerReportOnTheFly
};