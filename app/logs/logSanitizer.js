/**
 * Shared sanitisation helpers for data written to application logs.
 *
 * This module protects logging destinations only; it never changes the live
 * request or application data used by business logic.
 */
const REDACTED_VALUE = "[REDACTED]";

/*
 * Field names whose values must never be persisted in application logs.
 *
 * Comparison is case-insensitive and ignores "-", "_" and spaces so that,
 * for example, access_key, access-key and accessKey are treated consistently.
 */
const SENSITIVE_FIELDS = new Set([
    "password",
    "passwd",
    "pwd",
    "token",
    "accesstoken",
    "refreshtoken",
    "authorization",
    "apikey",
    "accesskey",
    "secret",
    "clientsecret",
    "jwt",
    "cookie",
    "setcookie"
]);

/** Normalises field names so common credential-name variations match. */
function normaliseFieldName(fieldName) {
    return String(fieldName)
        .toLowerCase()
        .replace(/[-_\s]/g, "");
}

/** Returns true when a field name is configured as sensitive. */
function isSensitiveField(fieldName) {
    return SENSITIVE_FIELDS.has(normaliseFieldName(fieldName));
}

/*
 * Creates a sanitised copy of a value before it is written to a log.
 *
 * Objects and arrays are processed recursively because credentials can be
 * nested inside request payloads. The original object is never modified.
 */
function sanitizeLogValue(value, seen = new WeakSet()) {
    if (value === null || value === undefined || typeof value !== "object") {
        return value;
    }

    /*
     * Avoid recursion problems if an object contains a circular reference.
     * Normal request payloads should not contain these, but Error metadata
     * and application objects potentially can.
     */
    if (seen.has(value)) {
        return "[CIRCULAR]";
    }

    seen.add(value);

    if (value instanceof Date) {
        seen.delete(value);
        return value;
    }

    if (Array.isArray(value)) {
        const sanitisedArray = value.map(function (item) {
            return sanitizeLogValue(item, seen);
        });

        seen.delete(value);

        return sanitisedArray;
    }

    const sanitisedObject = {};

    for (const [key, item] of Object.entries(value)) {
        if (isSensitiveField(key)) {
            sanitisedObject[key] = REDACTED_VALUE;
        } else {
            sanitisedObject[key] = sanitizeLogValue(item, seen);
        }
    }

    seen.delete(value);

    return sanitisedObject;
}

/*
 * Sanitises sensitive query-string parameters while preserving the URL
 * itself for diagnostic purposes.
 *
 * req.originalUrl can contain values such as ?access_key=... or ?token=...
 * which would otherwise bypass object-based request sanitisation.
 */
function sanitizeLogUrl(url) {
    if (!url || typeof url !== "string") {
        return url;
    }

    const questionMark = url.indexOf("?");

    if (questionMark === -1) {
        return url;
    }

    const path = url.substring(0, questionMark);
    const queryString = url.substring(questionMark + 1);
    const params = new URLSearchParams(queryString);

    for (const key of params.keys()) {
        if (isSensitiveField(key)) {
            params.set(key, REDACTED_VALUE);
        }
    }

    const sanitisedQuery = params.toString();

    return sanitisedQuery ? path + "?" + sanitisedQuery : path;
}

module.exports = {
    sanitizeLogValue,
    sanitizeLogUrl,
    isSensitiveField
};
