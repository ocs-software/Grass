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
    STAT_MAP: {
      total_score: {
          source: "root",
          field: "total_score",
          lowerIsBetter: true
      },

      distance: {
          source: "hole_stats",
          field: "distance",
          lowerIsBetter: false
      },

      gir: {
          source: "hole_stats",
          field: "gir",
          lowerIsBetter: false
      },

      putts: {
          source: "hole_stats",
          field: "putts",
          lowerIsBetter: true
      }
    },
    CRITERIA_MAP: {
      tour: { source: "root", field: "tour" },
      season: { source: "root", field: "season" },
      course: { source: "root", field: "course_id" },
      event: { source: "root", field: "event_id" },

      hole: { source: "hole_stats", field: "hole" },
      par: { source: "hole_stats", field: "par" }
    },
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