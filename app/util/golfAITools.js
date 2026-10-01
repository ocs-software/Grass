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

module.exports = {
    getPlayerOverview
};
