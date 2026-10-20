/**
 * Express-validator rules preventing whitespace in database/tour route IDs.
 * Validation-result handling is performed by the route that uses these rules.
 */
const { check, oneOf, validationResult } = require("express-validator");
module.exports = [
    check('dbid')
        .custom(value => !/\s/.test(value))
        .withMessage('No spaces are allowed in the dbid'),
    check('tourid')
        .custom(value => !/\s/.test(value))
        .withMessage('No spaces are allowed in the tourid'),
]