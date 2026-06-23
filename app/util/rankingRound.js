const crypto = require("crypto");

function stableStringify(obj) {
    return JSON.stringify(
        Object.keys(obj).sort().reduce((acc, key) => {
            acc[key] = obj[key];
            return acc;
        }, {})
    );
}

function buildFilterHash(criteria) {
    return crypto
        .createHash("sha1")
        .update(stableStringify(criteria))
        .digest("hex");
}

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
        "country"
    ];

    for (const field of allowedFilters) {
        if (criteria[field] !== undefined && criteria[field] !== null && criteria[field] !== "") {
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

async function rebuildRankingDocuments({
    thisDb,
    suffix = "",
    criteria = {},
    sourceCollection = "myrounds",
    rankingCollection = "ranking_cache",
    scoreField = "myround.total_score",
    lowerIsBetter = true
}) {
    const match = buildMatch(criteria);
    const filterHash = buildFilterHash(match);

    const source = thisDb.collection(sourceCollection + suffix);
    const rankings = thisDb.collection(rankingCollection + suffix);

    const sortDirection = lowerIsBetter ? 1 : -1;

    const pipeline = [
        { $match: match },
        {
            $project: {
                user_id: 1,
                score: `$${scoreField}`
            }
        },
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
    }
}

async function getPlayerReportOnTheFly({
    thisDb,
    suffix = "",
    userId,
    criteria = {},
    sourceCollection = "round_scores",
    scoreField = "total_score",
    lowerIsBetter = true
}) {
    const match = buildMatch(criteria);
    const sortDirection = lowerIsBetter ? 1 : -1;

    const source = thisDb.collection(sourceCollection + suffix);

    const pipeline = [
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
                            total_score: { $sum: "$score" },
                            average_score: { $avg: "$score" },
                            min_score: { $min: "$score" },
                            max_score: { $max: "$score" },
                            rounds: { $sum: 1 }
                        }
                    }
                ],

                overall: [
                    {
                        $group: {
                            _id: null,
                            total_score: { $sum: "$score" },
                            average_score: { $avg: "$score" },
                            min_score: { $min: "$score" },
                            max_score: { $max: "$score" },
                            rounds: { $sum: 1 },
                            players: { $addToSet: "$user_id" }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            total_score: 1,
                            average_score: 1,
                            min_score: 1,
                            max_score: 1,
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
                    {
                        $match: {
                            _id: userId
                        }
                    },
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
    ];

    const result = await source.aggregate(pipeline, { allowDiskUse: true }).toArray();

    return result[0] || {
        player: null,
        overall: null,
        ranking: null
    };
}
    
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
    ]).toArray();

    const ranking = await rankings.findOne({
        filter_hash: filterHash,
        user_id: userId
    });

    return {
        criteria: match,
        filter_hash: filterHash,
        player: liveStats?.player || null,
        overall: liveStats?.overall || null,
        ranking: ranking || null
    };
}

module.exports = { rebuildRankingDocuments,  getPlayerReport};