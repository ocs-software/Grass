function getAppConfig() {
  const appEnv = process.env.APP_ENV || "development";

  return {
    env: appEnv,
    isProduction: appEnv === "production",
    isStaging: appEnv === "staging",
    isDevelopment: appEnv === "development",

    branch: process.env.APP_BRANCH || "unknown",
    appUrl: process.env.APP_URL || null,

    stripe: {
      skey: process.env.STRIPE_KEY
    }
  };
}

module.exports = { getAppConfig };