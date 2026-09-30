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

        holes.push({
            hole: holeNumber,
            par: par,
            score: score !== undefined ? score : null,
            shots: holeShots,
            gir: gir,
            girStroke: girStroke,
            girTarget: girTarget
        });
    }

    return {
        roundId: round._id,
        userId: round.user_id,
        date: round.created_at || null,
        complete: round.complete === true,
        holesPlayed: holes.length,
        holes: holes
    };
}

module.exports = {
    analyseRound
};
