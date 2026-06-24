const crypto = require("crypto");

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
    const match = {};

    const allowedFilters = [
        "tour",
        "season",
        "course_id",
        "event_id",
        "round_id",
        "division",
        "gender",
        "country",
        "state"
    ];

    for (const field of allowedFilters) {
        if (
            criteria[field] !== undefined &&
            criteria[field] !== null &&
            criteria[field] !== ""
        ) {
            match[field] = criteria[field];
        }
    }

    if (criteria.date_from || criteria.date_to) {
        match.played_at = {};

        if (criteria.date_from) {
            match.played_at.$gte = new Date(criteria.date_from);
        }

        if (criteria.date_to) {
            match.played_at.$lte = new Date(criteria.date_to);
        }
    }

    return match;
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
    const match = buildMatch(criteria);
    const filterHash = buildFilterHash(match);

    const source = thisDb.collection(sourceCollection + suffix);
    const sortDirection = lowerIsBetter ? 1 : -1;

    const scoreStages = getScoreProjectionStages(scoreField);

    const pipeline = [
        { $match: match },

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
                criteria: match,
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
        criteria: match
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
    const match = buildMatch(criteria);
    const filterHash = buildFilterHash(match);

    await thisDb.collection(jobsCollection + suffix).updateOne(
        { filter_hash: filterHash },
        {
            $set: {
                filter_hash: filterHash,
                criteria: match,
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
        criteria: match
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
    const match = buildMatch(criteria);
    const filterHash = buildFilterHash(match);

    const source = thisDb.collection(sourceCollection + suffix);
    const rankings = thisDb.collection(rankingCollection + suffix);

    const [liveStats] = await source.aggregate([
        { $match: match },

        {
            $project: {
                user_id: 1,
                score: `$${scoreField}`
            }
        },

        {
            $facet: {
                player: [
                    { $match: { user_id: userId } },
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
        user_id: userId
    });

    return {
        criteria: match,
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
    sourceCollection = "round_scores",
    scoreField = "total_score",
    lowerIsBetter = true
}) {
    await recordCriteriaUsage({
        thisDb,
        suffix,
        criteria,
        scoreField
    });
    const match = buildMatch(criteria);
    const sortDirection = lowerIsBetter ? 1 : -1;

    const source = thisDb.collection(sourceCollection + suffix);

    const scoreStages = getScoreProjectionStages(scoreField);

    const [result] = await source.aggregate([
        { $match: match },

        ...scoreStages,

        {
            $facet: {
                player: [
                    { $match: { user_id: userId } },
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
                ],

                ranking: [
                    {
                        $group: {
                            _id: "$user_id",
                            average_score: { $avg: "$score" },
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
                    { $match: { _id: userId } },
                    {
                        $project: {
                            _id: 0,
                            user_id: "$_id",
                            average_score: 1,
                            rounds: 1,
                            rank: 1
                        }
                    }
                ]
            }
        },

        {
            $project: {
                player: { $arrayElemAt: ["$player", 0] },
                overall: { $arrayElemAt: ["$overall", 0] },
                ranking: { $arrayElemAt: ["$ranking", 0] }
            }
        }
    ], { allowDiskUse: true }).toArray();

    return result || {
        player: null,
        overall: null,
        ranking: null
    };
}

async function recordCriteriaUsage({
    thisDb,
    suffix = "",
    criteria = {},
    scoreField = "total_score",
    collection = "stats_criteria_usage"
}) {
    const match = buildMatch(criteria);
    const filterHash = buildFilterHash({
        match,
        scoreField
    });

    await thisDb.collection(collection + suffix).updateOne(
        { filter_hash: filterHash },
        {
            $set: {
                filter_hash: filterHash,
                criteria: match,
                scoreField,
                last_used_at: new Date()
            },
            $inc: {
                usage_count: 1
            },
            $setOnInsert: {
                created_at: new Date()
            }
        },
        { upsert: true }
    );

    return filterHash;
}

function getScoreProjectionStages(scoreField) {
    if (scoreField.startsWith("hole_stats.")) {
        const subField = scoreField.replace("hole_stats.", "");

        return [
            { $unwind: "$hole_stats" },
            {
                $project: {
                    user_id: 1,
                    score: `$hole_stats.${subField}`
                }
            },
            {
                $match: {
                    score: {
                        $nin: [null, 0]
                    }
                }
            }
        ];
    }

    return [
        {
            $project: {
                user_id: 1,
                score: `$${scoreField}`
            }
        },
        {
            $match: {
                score: {
                    $nin: [null, 0]
                }
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