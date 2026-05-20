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

    stripe: {
      skey: process.env.STRIPE_KEY
    }
  };
}

module.exports = { getAppConfig };