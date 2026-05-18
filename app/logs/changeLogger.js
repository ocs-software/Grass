const { getAppConfig } = require("../config/app_config");

const DEFAULT_IGNORED_FIELDS = [
  "_id",
  "created_at",
  "updated_at",
  "updated",
  "created"
];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function shouldIgnore(path, ignoredFields) {
  return ignoredFields.includes(path) || ignoredFields.some(field => path.endsWith(`.${field}`));
}

function diffValues(oldValue, newValue, path = "", ignoredFields = DEFAULT_IGNORED_FIELDS) {
  const old_values = {};
  const new_values = {};

  if (shouldIgnore(path, ignoredFields)) {
    return { old_values, new_values };
  }

  // Object diff
  if (isObject(oldValue) && isObject(newValue)) {
    const keys = new Set([
      ...Object.keys(oldValue),
      ...Object.keys(newValue)
    ]);

    for (const key of keys) {
      const childPath = path ? `${path}.${key}` : key;

      const childDiff = diffValues(
        oldValue[key],
        newValue[key],
        childPath,
        ignoredFields
      );

      Object.assign(old_values, childDiff.old_values);
      Object.assign(new_values, childDiff.new_values);
    }

    return { old_values, new_values };
  }

  // Array or primitive diff
  if (!isEqual(oldValue, newValue)) {
    old_values[path] = oldValue;
    new_values[path] = newValue;
  }

  return { old_values, new_values };
}

function getChangedFields(oldDoc = {}, newData = {}, options = {}) {
  const ignoredFields = options.ignoredFields || DEFAULT_IGNORED_FIELDS;

  return diffValues(oldDoc, newData, "", ignoredFields);
}

async function logDocumentChange({
  thisDb,
  table,
  channel = "update",
  oldDoc,
  newData,
  user_id = null,
  user_email = null,
  ignoredFields = DEFAULT_IGNORED_FIELDS
}) {
  try {
    const { old_values, new_values } = getChangedFields(oldDoc, newData, {
      ignoredFields
    });

    if (Object.keys(new_values).length === 0) {
      return { logged: false, reason: "no_changes" };
    }

    const suffix = getAppConfig().suffix;
    const logsDb = thisDb.collection(`logs${suffix}`);

    const result = await logsDb.insertOne({
      table,
      channel,
      old_values,
      new_values,
      user_id,
      user_email,
      created_at: new Date()
    });

    return {
      logged: true,
      insertedId: result.insertedId
    };

  } catch (e) {
    console.error("Change logger failed:", e);
    return {
      logged: false,
      error: e.message
    };
  }
}

module.exports = {
  logDocumentChange,
  getChangedFields
};