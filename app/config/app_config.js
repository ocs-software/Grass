/**
 * Builds the runtime configuration used by the Grass backend.
 *
 * Environment-specific values are read when this function is called rather
 * than when the module is loaded. Development uses the `_dev` collection
 * suffix; staging and production use the unsuffixed collections.
 *
 * The metric and criteria maps describe fields that may be used by the
 * statistics/ranking layer. Secrets themselves are not stored here; only
 * environment-variable references are exposed through the returned config.
 *
 * @returns {Object} Current application configuration.
 */
function getAppConfig() {
    const appEnv = process.env.APP_ENV || "production";

    return {
        env: appEnv,
        isProduction: appEnv === "production",
        isStaging: appEnv === "staging",
        isDevelopment: appEnv === "development",

        branch: process.env.APP_BRANCH || "unknown",
        appUrl: process.env.APP_URL || null,
        live: appEnv != "development",
        suffix: appEnv === "development" ? "_dev" : "",
        database_name: "grass",

        stripe: {
            skey: process.env.STRIPE_KEY
        },
        // Canonical metadata for statistics exposed by the ranking/analytics layer.
        STAT_MAP: {
            total_score: {
                source: "root",
                field: "total_score",
                aggregation: "average",
                category: "scoring",
                label: "Score",
                unit: "strokes",
                lowerIsBetter: true,
                type: "stored",
                minimumRecords: 1
            },

            distance: {
                source: "hole_stats",
                field: "distance",
                aggregation: "average",
                category: "shots",
                label: "Distance",
                unit: "yards",
                lowerIsBetter: false,
                minimumRecords: 1,
                type: "stored",
                lastRecords: 10
            },

            gir: {
                source: "hole_stats",
                field: "gir",
                aggregation: "average",
                category: "approach",
                label: "Greens in Regulation",
                unit: "boolean",
                lowerIsBetter: false,
                type: "stored",
                minimumRecords: 1
            },

            putts: {
                source: "hole_stats",
                field: "putts",
                aggregation: "average",
                category: "putting",
                label: "Putts",
                unit: "strokes",
                lowerIsBetter: true,
                type: "stored",
                minimumRecords: 1
            }
        },
        // Maps supported report filters to their MongoDB document locations.
        CRITERIA_MAP: {
            tour: { source: "root", field: "tour" },
            season: { source: "root", field: "season" },
            course: { source: "root", field: "course_id" },
            event: { source: "root", field: "event_id" },

            hole: { source: "hole_stats", field: "hole" },
            par: { source: "hole_stats", field: "par" },
            distance: { source: "hole_stats", field: "distance" },
            qos: { source: "hole_stats", field: "qos" },
            club_used: { source: "hole_stats", field: "club_used" }
        },
        // Defines supported player-cohort filters and any required operators/types.
        PEER_CRITERIA_MAP: {
            playerType: { field: "player_type" },
            gender: { field: "gender" },
            division: { field: "division" },
            country: { field: "country" },
            state: { field: "state" },

            ageMin: { field: "age", operator: "$gte", type: "number" },
            ageMax: { field: "age", operator: "$lte", type: "number" }
        }
    };
}

module.exports = { getAppConfig };
