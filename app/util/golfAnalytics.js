function buildAnalyticsContext(table) {
    const outcomes = table && Array.isArray(table.as_oos) ? table.as_oos : [];

    const fairway = outcomes.find(function (item) {
        return item.type === "F";
    });

    const green = outcomes.find(function (item) {
        return item.type === "G";
    });

    const penaltyCodes = outcomes
        .filter(function (item) {
            return item.pen === "Y";
        })
        .map(function (item) {
            return item.code;
        });

    return {
        codes: {
            fairway: fairway ? fairway.code : null,
            green: green ? green.code : null,
            penalties: penaltyCodes
        }
    };
}

function calculateGir(holeShots, par, codes) {
    const greenCode = codes.green || "030";

    const greenShot = holeShots.find(function (shot) {
        return shot.outcome === greenCode;
    });

    const girStroke = greenShot ? greenShot.strokes : null;
    const girTarget = par - 2;

    return {
        gir: girStroke !== null && girStroke <= girTarget,
        girStroke: girStroke,
        girTarget: girTarget
    };
}

function calculatePutting(holeShots, codes) {
    const greenCode = codes.green || "030";

    return {
        putts: holeShots.filter(function (shot) {
            return shot.position === greenCode;
        }).length
    };
}

function calculateFairway(holeShots, par, codes) {
    const fairwayCode = codes.fairway || "001";
    const opportunity = par > 3;

    const teeShot = holeShots.find(function (shot) {
        return shot.strokes === 1;
    });

    return {
        fairwayOpportunity: opportunity,
        fairwayHit: opportunity && !!teeShot && teeShot.outcome === fairwayCode
    };
}

function calculateScrambling(gir, score, par) {
    const opportunity = !gir;

    return {
        scramblingOpportunity: opportunity,
        scramble:
            opportunity && score !== undefined && score !== null && score <= par
    };
}

function analyseRound(round, context) {
    context = context || {};
    const codes = context.codes || {};

    if (!round) {
        throw new Error("Round is required.");
    }

    const holePars = round.hole_pars || [];
    const holeScores = round.hole_scores || [];
    const shots = round.hole_stats || [];

    const holes = [];

    for (let holeNumber = 1; holeNumber <= holePars.length; holeNumber++) {
        const par = holePars[holeNumber - 1];
        const score = holeScores[holeNumber - 1];

        const holeShots = shots
            .filter(function (shot) {
                return shot.hole === holeNumber;
            })
            .sort(function (a, b) {
                return a.strokes - b.strokes;
            });

        // Ignore holes which have not actually been played.
        if (holeShots.length === 0) {
            continue;
        }

        const girResult = calculateGir(holeShots, par, codes);
        const puttingResult = calculatePutting(holeShots, codes);
        const fairwayResult = calculateFairway(holeShots, par, codes);
        const scramblingResult = calculateScrambling(girResult.gir, score, par);

        const scoreToPar =
            score !== undefined && score !== null ? score - par : null;

        holes.push({
            hole: holeNumber,
            par: par,
            score: score !== undefined ? score : null,
            scoreToPar: scoreToPar,

            shots: holeShots,

            gir: girResult.gir,
            girStroke: girResult.girStroke,
            girTarget: girResult.girTarget,

            fairwayOpportunity: fairwayResult.fairwayOpportunity,
            fairwayHit: fairwayResult.fairwayHit,

            scramblingOpportunity: scramblingResult.scramblingOpportunity,
            scramble: scramblingResult.scramble,

            putts: puttingResult.putts
        });
    }

    const totalPutts = holes.reduce(function (total, hole) {
        return total + hole.putts;
    }, 0);

    const girHoles = holes.filter(function (hole) {
        return hole.gir;
    });

    const totalScore = holes.reduce(function (total, hole) {
        return total + (hole.score || 0);
    }, 0);

    const totalPar = holes.reduce(function (total, hole) {
        return total + hole.par;
    }, 0);

    const fairwayOpportunities = holes.filter(function (hole) {
        return hole.fairwayOpportunity;
    });

    const fairwaysHit = fairwayOpportunities.filter(function (hole) {
        return hole.fairwayHit;
    });

    const scramblingOpportunities = holes.filter(function (hole) {
        return hole.scramblingOpportunity;
    });

    const scramblesMade = scramblingOpportunities.filter(function (hole) {
        return hole.scramble;
    });

    return {
        roundId: round._id,
        userId: round.user_id,
        date: round.created_at || null,
        complete: round.complete === true,

        holesPlayed: holes.length,

        scoring: {
            score: totalScore,
            par: totalPar,
            toPar: totalScore - totalPar
        },

        gir: {
            made: girHoles.length,
            opportunities: holes.length,
            percentage:
                holes.length > 0 ? (girHoles.length / holes.length) * 100 : null
        },

        putting: {
            putts: totalPutts,
            puttsPerHole: holes.length > 0 ? totalPutts / holes.length : null
        },

        fairways: {
            hit: fairwaysHit.length,
            opportunities: fairwayOpportunities.length,
            percentage:
                fairwayOpportunities.length > 0
                    ? (fairwaysHit.length / fairwayOpportunities.length) * 100
                    : null
        },

        scrambling: {
            made: scramblesMade.length,
            opportunities: scramblingOpportunities.length,
            percentage:
                scramblingOpportunities.length > 0
                    ? (scramblesMade.length / scramblingOpportunities.length) *
                      100
                    : null
        },

        holes: holes
    };
}

module.exports = {
    analyseRound,
    buildAnalyticsContext
};
