const {
    analyseRound,
    aggregateRounds,
    compareAggregates,
    getPlayerRounds,
    buildAnalyticsContext,
    buildPlayerAnalyticsReport
} = require("./golfAnalytics");

async function getPlayerOverview(
    thisDb,
    collectionName,
    userId,
    analyticsContext,
    options
) {
    options = options || {};

    const criteria = options.criteria || {};

    const trendRoundCount =
        Number(options.trendRoundCount) > 0
            ? Number(options.trendRoundCount)
            : 3;

    const rounds = await getPlayerRounds(
        thisDb,
        collectionName,
        userId,
        criteria
    );

    const analyses = rounds.map(function (round) {
        return analyseRound(round, analyticsContext);
    });

    const aggregate = aggregateRounds(analyses);

    /*
     * Trend calculation.
     *
     * getPlayerRounds() currently returns the rounds in
     * chronological order, so the last N rounds are the
     * current period and the N immediately before those
     * are the comparison period.
     */
    const currentRounds = rounds.slice(-trendRoundCount);

    const previousRounds = rounds.slice(
        -(trendRoundCount * 2),
        -trendRoundCount
    );

    let comparison = null;

    if (
        currentRounds.length === trendRoundCount &&
        previousRounds.length === trendRoundCount
    ) {
        const currentAnalyses = currentRounds.map(function (round) {
            return analyseRound(round, analyticsContext);
        });

        const previousAnalyses = previousRounds.map(function (round) {
            return analyseRound(round, analyticsContext);
        });

        const currentAggregate = aggregateRounds(currentAnalyses);

        const previousAggregate = aggregateRounds(previousAnalyses);

        comparison = compareAggregates(currentAggregate, previousAggregate);
    }

    return buildPlayerAnalyticsReport(aggregate, comparison);
}

async function comparePlayerPeriods(
    thisDb,
    collectionName,
    userId,
    analyticsContext,
    options
) {
    options = options || {};

    const mode = options.mode;

    let currentCriteria;
    let previousCriteria;

    if (mode === "last_n") {
        const count = Number(options.count);

        if (!Number.isInteger(count) || count <= 0 || count > 50) {
            throw new Error("count must be an integer between 1 and 50");
        }

        /*
         * Fetch enough rounds for both periods.
         */
        const rounds = await getPlayerRounds(
            thisDb,
            collectionName,
            userId,
            {}
        );

        const currentRounds = rounds.slice(-count);

        const previousRounds = rounds.slice(-(count * 2), -count);

        if (currentRounds.length < count || previousRounds.length < count) {
            return {
                available: false,
                reason: "Not enough rounds for two complete comparison periods.",
                requestedRoundsPerPeriod: count,
                availableRounds: rounds.length
            };
        }

        const currentAggregate = aggregateRounds(
            currentRounds.map(function (round) {
                return analyseRound(round, analyticsContext);
            })
        );

        const previousAggregate = aggregateRounds(
            previousRounds.map(function (round) {
                return analyseRound(round, analyticsContext);
            })
        );

        return {
            available: true,
            mode: "last_n",
            comparison: compareAggregates(currentAggregate, previousAggregate)
        };
    }

    if (mode === "date_range") {
        if (!options.current || !options.previous) {
            throw new Error("current and previous date ranges are required");
        }

        currentCriteria = {
            date_from: options.current.date_from,
            date_to: options.current.date_to
        };

        previousCriteria = {
            date_from: options.previous.date_from,
            date_to: options.previous.date_to
        };

        const currentRounds = await getPlayerRounds(
            thisDb,
            collectionName,
            userId,
            currentCriteria
        );

        const previousRounds = await getPlayerRounds(
            thisDb,
            collectionName,
            userId,
            previousCriteria
        );

        if (currentRounds.length === 0 || previousRounds.length === 0) {
            return {
                available: false,
                reason: "One or both date ranges contain no rounds.",
                sample: {
                    currentRounds: currentRounds.length,
                    previousRounds: previousRounds.length
                }
            };
        }

        const currentAggregate = aggregateRounds(
            currentRounds.map(function (round) {
                return analyseRound(round, analyticsContext);
            })
        );

        const previousAggregate = aggregateRounds(
            previousRounds.map(function (round) {
                return analyseRound(round, analyticsContext);
            })
        );

        return {
            available: true,
            mode: "date_range",

            periods: {
                current: {
                    date_from: options.current.date_from,
                    date_to: options.current.date_to
                },

                previous: {
                    date_from: options.previous.date_from,
                    date_to: options.previous.date_to
                }
            },

            comparison: compareAggregates(currentAggregate, previousAggregate)
        };
    }

    throw new Error("Unsupported comparison mode");
}

async function getRound(
    thisDb,
    collectionName,
    userId,
    analyticsContext,
    options
) {
    const round = await findPlayerRound(
        thisDb,
        collectionName,
        userId,
        options
    );

    if (!round) {
        return {
            available: false,
            reason: "The requested round was not found."
        };
    }

    const analysis = analyseRound(round, analyticsContext);

    const compactHoles = analysis.holes.map(function (hole) {
        return {
            hole: hole.hole,

            par: hole.par,

            score: hole.score,

            scoreToPar: hole.scoreToPar,

            scoringCategory: hole.scoringCategory,

            gir: hole.gir,

            fairwayOpportunity: hole.fairwayOpportunity,

            fairwayHit: hole.fairwayHit,

            scramblingOpportunity: hole.scramblingOpportunity,

            scramble: hole.scramble,

            penaltyStrokes: hole.penaltyStrokes,

            putts: hole.putts
        };
    });

    return {
        analysis: {
            roundId: analysis.roundId,

            userId: analysis.userId,

            date: analysis.date,

            complete: analysis.complete,

            holesPlayed: analysis.holesPlayed,

            scoring: analysis.scoring,

            gir: analysis.gir,

            putting: analysis.putting,

            fairways: analysis.fairways,

            scrambling: analysis.scrambling,

            penalties: analysis.penalties,

            clubs: analysis.clubs,

            shotQuality: analysis.shotQuality,

            shotDataQuality: analysis.shotDataQuality,

            holes: compactHoles
        }
    };
}

function getShotQualityDescription(value) {
    switch (Number(value)) {
        case 1:
            return "Very Bad";
        case 2:
            return "Bad";
        case 3:
            return "Average";
        case 4:
            return "Good";
        case 5:
            return "Perfect";
        default:
            return null;
    }
}

function getLookupDescription(map, code) {
    if (!map || !code) {
        return null;
    }

    const item = map[String(code)];

    if (!item) {
        return null;
    }

    if (typeof item === "string") {
        return item;
    }

    return item.description || item.desc || item.name || item.label || null;
}

function buildAIShot(shot, analyticsContext) {
    const clubCode =
        shot.shot_club !== undefined &&
        shot.shot_club !== null &&
        shot.shot_club !== ""
            ? String(shot.shot_club)
            : null;

    const positionCode =
        shot.position !== undefined &&
        shot.position !== null &&
        shot.position !== ""
            ? String(shot.position)
            : null;

    const outcomeCode =
        shot.outcome !== undefined &&
        shot.outcome !== null &&
        shot.outcome !== ""
            ? String(shot.outcome)
            : null;

    const qualityValue = Number(shot.shot_qos);

    const validQuality =
        Number.isInteger(qualityValue) &&
        qualityValue >= 1 &&
        qualityValue <= 5;

    const isPutter = clubCode === "075";

    let travelDistance = null;

    /*
     * Non-putter distance is recorded in yards.
     * Only positive values are meaningful.
     */
    if (!isPutter && Number(shot.shot_dist_y) > 0) {
        travelDistance = {
            value: Number(shot.shot_dist_y),
            unit: "yards",
            type: "recorded_travel"
        };
    }

    /*
     * Putter distance is recorded in feet.
     * Never use putt_dist_* for non-putter shots.
     */
    if (isPutter && Number(shot.putt_dist_f) > 0) {
        travelDistance = {
            value: Number(shot.putt_dist_f),
            unit: "feet",
            type: "recorded_travel"
        };
    }

    return {
        stroke: Number(shot.strokes),

        club: clubCode
            ? {
                  code: clubCode,
                  description: getLookupDescription(
                      analyticsContext.clubMap,
                      clubCode
                  )
              }
            : null,

        position: positionCode
            ? {
                  code: positionCode,
                  description: getLookupDescription(
                      analyticsContext.positionMap,
                      positionCode
                  )
              }
            : null,

        outcome: outcomeCode
            ? {
                  code: outcomeCode,
                  description: getLookupDescription(
                      analyticsContext.outcomeMap,
                      outcomeCode
                  )
              }
            : null,

        quality: validQuality
            ? {
                  rating: qualityValue,
                  description: getShotQualityDescription(qualityValue),
                  subjective: true
              }
            : null,

        travelDistance: travelDistance
    };
}

function getShotQualityDescription(value) {
    switch (Number(value)) {
        case 1:
            return "Very Bad";
        case 2:
            return "Bad";
        case 3:
            return "Average";
        case 4:
            return "Good";
        case 5:
            return "Perfect";
        default:
            return null;
    }
}

function getLookupItem(map, code) {
    if (!map || !code) {
        return null;
    }

    return map[String(code)] || null;
}

function buildAIShot(shot, analyticsContext) {
    const clubCode =
        shot.shot_club !== undefined &&
        shot.shot_club !== null &&
        shot.shot_club !== ""
            ? String(shot.shot_club)
            : null;

    const positionCode =
        shot.position !== undefined &&
        shot.position !== null &&
        shot.position !== ""
            ? String(shot.position)
            : null;

    const outcomeCode =
        shot.outcome !== undefined &&
        shot.outcome !== null &&
        shot.outcome !== ""
            ? String(shot.outcome)
            : null;

    const qualityValue = Number(shot.shot_qos);

    const validQuality =
        Number.isInteger(qualityValue) &&
        qualityValue >= 1 &&
        qualityValue <= 5;

    const club = getLookupItem(analyticsContext.clubs, clubCode);

    const position = getLookupItem(analyticsContext.positions, positionCode);

    const outcome = getLookupItem(analyticsContext.outcomes, outcomeCode);

    const isPutter = clubCode === "075";

    let travelDistance = null;

    /*
     * For non-putter shots, shot_dist_y is recorded
     * ball travel distance in yards.
     */
    if (!isPutter && Number(shot.shot_dist_y) > 0) {
        travelDistance = {
            value: Number(shot.shot_dist_y),
            unit: "yards",
            type: "recorded_travel"
        };
    }

    /*
     * putt_dist_f is meaningful only for an actual
     * putter stroke. It represents travelled distance,
     * not necessarily starting distance from the hole.
     */
    if (isPutter && Number(shot.putt_dist_f) > 0) {
        travelDistance = {
            value: Number(shot.putt_dist_f),
            unit: "feet",
            type: "recorded_travel"
        };
    }

    return {
        stroke: Number(shot.strokes),

        club: clubCode
            ? {
                  code: clubCode,
                  description:
                      club && club.description ? club.description : null,
                  abbreviation:
                      club && club.abbreviation ? club.abbreviation : null
              }
            : null,

        position: positionCode
            ? {
                  code: positionCode,
                  description:
                      position && position.description
                          ? position.description
                          : null
              }
            : null,

        outcome: outcomeCode
            ? {
                  code: outcomeCode,
                  description:
                      outcome && outcome.description
                          ? outcome.description
                          : null,
                  penalty: outcome ? outcome.penalty : false
              }
            : null,

        quality: validQuality
            ? {
                  rating: qualityValue,
                  description: getShotQualityDescription(qualityValue),
                  subjective: true
              }
            : null,

        travelDistance: travelDistance
    };
}

async function getHole(
    thisDb,
    collectionName,
    userId,
    analyticsContext,
    options
) {
    options = options || {};

    const holeNumber = Number(options.hole);

    if (!Number.isInteger(holeNumber) || holeNumber < 1 || holeNumber > 18) {
        throw new Error("hole must be an integer between 1 and 18");
    }

    const round = await findPlayerRound(thisDb, collectionName, userId, {
        mode: options.round_id ? "round_id" : "latest",

        round_id: options.round_id
    });

    if (!round) {
        return {
            available: false,
            reason: "The requested round was not found."
        };
    }

    const analysis = analyseRound(round, analyticsContext);

    const hole = analysis.holes.find(function (item) {
        return Number(item.hole) === holeNumber;
    });

    if (!hole) {
        return {
            available: false,
            reason: "The requested hole was not found in this round.",
            roundId: round.id,
            hole: holeNumber
        };
    }

    const aiShots = Array.isArray(hole.shots)
        ? hole.shots.map(function (shot) {
              return buildAIShot(shot, analyticsContext);
          })
        : [];

    return {
        available: true,

        round: {
            id: String(round._id),
            created_at: round.created_at || null
        },

        hole: {
            hole: hole.hole,
            par: hole.par,
            score: hole.score,
            scoreToPar: hole.scoreToPar,
            scoringCategory: hole.scoringCategory,

            gir: hole.gir,
            girStroke: hole.girStroke,
            girTarget: hole.girTarget,

            fairwayOpportunity: hole.fairwayOpportunity,

            fairwayHit: hole.fairwayHit,

            scramblingOpportunity: hole.scramblingOpportunity,

            scramble: hole.scramble,

            penaltyStrokes: hole.penaltyStrokes,

            putts: hole.putts,

            shots: aiShots
        }
    };
}

async function findPlayerRound(thisDb, collectionName, userId, options) {
    options = options || {};

    const mode = options.mode || "latest";

    const rounds = await getPlayerRounds(thisDb, collectionName, userId, {});

    if (rounds.length === 0) {
        return null;
    }

    if (mode === "latest") {
        return rounds[rounds.length - 1];
    }

    if (mode === "round_id") {
        if (!options.round_id) {
            throw new Error("round_id is required");
        }

        return (
            rounds.find(function (round) {
                return String(round._id) === String(options.round_id);
            }) || null
        );
    }

    throw new Error("Unsupported round mode");
}

module.exports = {
    getPlayerOverview,
    comparePlayerPeriods,
    getRound,
    getHole
};
