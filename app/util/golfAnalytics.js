function analyseRound(round) {
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

        const greenShot = holeShots.find(function (shot) {
            return shot.outcome === "030";
        });

        const girStroke = greenShot ? greenShot.strokes : null;
        const girTarget = par - 2;

        const gir = girStroke !== null && girStroke <= girTarget;

        const putts = holeShots.filter(function (shot) {
            return shot.position === "030";
        }).length;

        const scoreToPar =
            score !== undefined && score !== null ? score - par : null;

        holes.push({
            hole: holeNumber,
            par: par,
            score: score !== undefined ? score : null,
            scoreToPar: scoreToPar,

            shots: holeShots,

            gir: gir,
            girStroke: girStroke,
            girTarget: girTarget,

            putts: putts
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

        holes: holes
    };
}

module.exports = {
    analyseRound
};
