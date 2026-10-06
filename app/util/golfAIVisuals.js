function roundNumber(value, decimals) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return null;
    }

    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}

function getChangeAssessment(change, better) {
    if (typeof change !== "number" || !Number.isFinite(change)) {
        return {
            changeDirection: null,
            assessment: null
        };
    }

    if (change === 0) {
        return {
            changeDirection: "flat",
            assessment: "flat"
        };
    }

    const changeDirection = change > 0 ? "up" : "down";

    if (better !== "higher" && better !== "lower") {
        return {
            changeDirection,
            assessment: null
        };
    }

    const assessment =
        (better === "higher" && change > 0) ||
        (better === "lower" && change < 0)
            ? "better"
            : "worse";

    return {
        changeDirection,
        assessment
    };
}

function buildMetric(options) {
    const { key, label, value, unit, better, decimals } = options;

    return {
        key,
        label,
        value: roundNumber(value, decimals),
        unit,
        better
    };
}

function buildComparisonMetric(options) {
    const { key, label, current, previous, change, unit, better, decimals } =
        options;

    const roundedCurrent = roundNumber(current, decimals);
    const roundedPrevious = roundNumber(previous, decimals);
    const roundedChange = roundNumber(change, decimals);

    /*
     * Assess the original canonical change rather than the rounded
     * display value. A small non-zero change must not accidentally
     * become "flat" just because it rounds to zero for presentation.
     */
    const changeAssessment = getChangeAssessment(change, better);

    return {
        key,
        label,
        current: roundedCurrent,
        previous: roundedPrevious,
        change: roundedChange,
        unit,
        better,
        changeDirection: changeAssessment.changeDirection,
        assessment: changeAssessment.assessment
    };
}

function buildPerformanceSummaryVisual(toolResult) {
    if (!toolResult || !toolResult.performance) {
        return null;
    }

    const performance = toolResult.performance;
    const metrics = [];

    if (performance.scoring) {
        metrics.push(
            buildMetric({
                key: "scoringToParPerHole",
                label: "Score to par / hole",
                value: performance.scoring.toParPerHole,
                unit: "strokes",
                better: "lower",
                decimals: 2
            })
        );
    }

    if (performance.gir) {
        metrics.push(
            buildMetric({
                key: "girPercentage",
                label: "GIR",
                value: performance.gir.percentage,
                unit: "percentage",
                better: "higher",
                decimals: 1
            })
        );
    }

    if (performance.putting) {
        metrics.push(
            buildMetric({
                key: "puttsPerHole",
                label: "Putts / hole",
                value: performance.putting.puttsPerHole,
                unit: "putts",
                better: "lower",
                decimals: 2
            })
        );
    }

    if (performance.fairways) {
        metrics.push(
            buildMetric({
                key: "fairwayPercentage",
                label: "Fairways",
                value: performance.fairways.percentage,
                unit: "percentage",
                better: "higher",
                decimals: 1
            })
        );
    }

    if (performance.scrambling) {
        metrics.push(
            buildMetric({
                key: "scramblingPercentage",
                label: "Scrambling",
                value: performance.scrambling.percentage,
                unit: "percentage",
                better: "higher",
                decimals: 1
            })
        );
    }

    if (performance.penalties) {
        metrics.push(
            buildMetric({
                key: "penaltiesPerHole",
                label: "Penalties / hole",
                value: performance.penalties.perHole,
                unit: "strokes",
                better: "lower",
                decimals: 3
            })
        );
    }

    const validMetrics = metrics.filter(function (metric) {
        return metric.value !== null;
    });

    if (validMetrics.length === 0) {
        return null;
    }

    return {
        type: "performance_summary",
        title: "Performance overview",
        sample: toolResult.sample || null,
        metrics: validMetrics
    };
}

function buildPeriodComparisonVisual(toolResult) {
    if (
        !toolResult ||
        toolResult.available !== true ||
        !toolResult.comparison
    ) {
        return null;
    }

    const comparison = toolResult.comparison;
    const metrics = [];

    if (comparison.scoring && comparison.scoring.toParPerHole) {
        metrics.push(
            buildComparisonMetric({
                key: "scoringToParPerHole",
                label: "Score to par / hole",
                current: comparison.scoring.toParPerHole.current,
                previous: comparison.scoring.toParPerHole.previous,
                change: comparison.scoring.toParPerHole.change,
                unit: "strokes",
                better: "lower",
                decimals: 2
            })
        );
    }

    if (comparison.gir) {
        metrics.push(
            buildComparisonMetric({
                key: "girPercentage",
                label: "GIR",
                current: comparison.gir.current,
                previous: comparison.gir.previous,
                change: comparison.gir.change,
                unit: "percentage",
                better: "higher",
                decimals: 1
            })
        );
    }

    if (comparison.putting && comparison.putting.puttsPerHole) {
        metrics.push(
            buildComparisonMetric({
                key: "puttsPerHole",
                label: "Putts / hole",
                current: comparison.putting.puttsPerHole.current,
                previous: comparison.putting.puttsPerHole.previous,
                change: comparison.putting.puttsPerHole.change,
                unit: "putts",
                better: "lower",
                decimals: 2
            })
        );
    }

    if (comparison.fairways) {
        metrics.push(
            buildComparisonMetric({
                key: "fairwayPercentage",
                label: "Fairways",
                current: comparison.fairways.current,
                previous: comparison.fairways.previous,
                change: comparison.fairways.change,
                unit: "percentage",
                better: "higher",
                decimals: 1
            })
        );
    }

    if (comparison.scrambling) {
        metrics.push(
            buildComparisonMetric({
                key: "scramblingPercentage",
                label: "Scrambling",
                current: comparison.scrambling.current,
                previous: comparison.scrambling.previous,
                change: comparison.scrambling.change,
                unit: "percentage",
                better: "higher",
                decimals: 1
            })
        );
    }

    if (comparison.penaltiesPerHole) {
        metrics.push(
            buildComparisonMetric({
                key: "penaltiesPerHole",
                label: "Penalties / hole",
                current: comparison.penaltiesPerHole.current,
                previous: comparison.penaltiesPerHole.previous,
                change: comparison.penaltiesPerHole.change,
                unit: "strokes",
                better: "lower",
                decimals: 3
            })
        );
    }

    const validMetrics = metrics.filter(function (metric) {
        return (
            metric.current !== null &&
            metric.previous !== null &&
            metric.change !== null
        );
    });

    if (validMetrics.length === 0) {
        return null;
    }

    return {
        type: "period_comparison",
        title: "Recent performance",
        sample: comparison.sample || null,
        metrics: validMetrics
    };
}

function buildGolfAIVisuals(toolHistory) {
    if (!Array.isArray(toolHistory)) {
        return [];
    }

    const visuals = [];

    let overviewVisual = null;
    let comparisonVisual = null;

    for (const tool of toolHistory) {
        if (!tool || !tool.name || !tool.result) {
            continue;
        }

        if (tool.name === "get_player_overview") {
            const visual = buildPerformanceSummaryVisual(tool.result);

            if (visual) {
                overviewVisual = visual;
            }

            if (tool.result.trend && tool.result.trend.comparison) {
                const trendComparisonVisual = buildPeriodComparisonVisual({
                    available: true,
                    comparison: tool.result.trend.comparison
                });

                if (trendComparisonVisual) {
                    comparisonVisual = trendComparisonVisual;

                    comparisonVisual.title = "Recent performance";

                    comparisonVisual.period = {
                        roundsPerPeriod: tool.result.trend.roundsPerPeriod,

                        requestedRoundsPerPeriod:
                            tool.result.trend.requestedRoundsPerPeriod,

                        adjustedForAvailableData:
                            tool.result.trend.adjustedForAvailableData
                    };
                }
            }
        }

        if (tool.name === "compare_player_periods") {
            const visual = buildPeriodComparisonVisual(tool.result);

            if (visual) {
                comparisonVisual = visual;
            }
        }
    }

    if (overviewVisual) {
        visuals.push(overviewVisual);
    }

    if (comparisonVisual) {
        visuals.push(comparisonVisual);
    }

    return visuals;
}

module.exports = {
    buildGolfAIVisuals
};
