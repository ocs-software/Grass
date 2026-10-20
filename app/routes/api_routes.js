/**
 * Registers the public route prefixes used by the Grass backend.
 *
 * The supplied MongoDB client is attached to each request as `req.db`, which
 * allows individual routers to select the database/collections they require.
 * This module also applies the API's current CORS response headers.
 */

// Historical signature retained for reference:
// module.exports = function (app, db, io) {
module.exports = function (app, db) {

  // Make the shared MongoDB client available to all downstream route handlers.
  app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    req.db = db;
    next();
  })

  // Lightweight endpoint used to confirm that the Grass API is responding.
  app.get("/", (req, res) => {
    res.json({ message: "TheGrass App API Working" });
  });

  // Mount the feature routers under their API prefixes.
  const pinusers = require('./grass/users');
  app.use("/users", pinusers);

  const ppsearch = require('./grass/search');
  app.use("/search", ppsearch);

  const pinlogs = require('./grass/logs');
  app.use("/logs", pinlogs);

  const grasstable = require('./grass/tables');
  app.use("/table", grasstable);

  const grasssubs = require('./grass/subs');
  app.use("/subs", grasssubs);

  const grasstourns = require('./grass/tourns');
  app.use("/tourns", grasstourns);

  const grassmyrounds = require('./grass/myrounds');
  app.use("/rounds", grassmyrounds);

  const grassstats = require('./grass/stats');
  app.use("/stats", grassstats);

  /*
  const grassplayer = require('./grass/player');
  app.use("/table", grassplayer);

  const pinvenues = require('./grass/venues');
  app.use("/venues", pinvenues);

  const pincourses = require('./grass/courses');
  app.use("/courses", pincourses);

  const pinlinked = require('./pinusers/linked');
  app.use("/linked", pinlinked);

*/
};