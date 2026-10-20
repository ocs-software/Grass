/**
 * Registers the Grass API route groups on the supplied Express application.
 *
 * @param {Object} app Express application instance.
 * @param {Object} db MongoDB client shared with request handlers.
 */
const apiRoutes = require('./api_routes');
module.exports = function (app, db) {
  apiRoutes(app, db);
  // Other route groups could go here, in the future
};
