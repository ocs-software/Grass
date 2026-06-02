const { getAppConfig } = require("../config/app_config");

async function logError({
  thisDb,
  type = "other",
  action = "unknown",
  error,

  // optional context
  query,
  payload,
  user,
  extra,
  table,
  functionName
}) {
  try {
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;

    const errorLogs = thisDb.collection(`error_logs${suffix}`);

    const context = {};

    if (query !== undefined) context.query = query;
    if (payload !== undefined) context.payload = payload;
    if (user !== undefined) context.user = user;
    if (extra !== undefined) context.extra = extra;
    if (table !== undefined) context.table = table;
    if (functionName !== undefined) context.functionName = functionName;

    await errorLogs.insertOne({
      type,
      action,
      context,

      error: {
        message: error?.message || String(error),
        name: error?.name || null,
        stack: error?.stack || null,
        code: error?.code || null
      },

      created_at: new Date()
    });

  } catch (logErr) {
    console.error("Error logger failed:", logErr);
  }
}

module.exports = { logError };