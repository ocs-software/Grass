// routes/note_routes.js

// module.exports = function (app, db, io) {
module.exports = function (app, db) {

  app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    req.db = db;
    next();
  })

  app.get("/", (req, res) => {
    res.json({ message: "TheGrass App API Working" });
  });

  const pinusers = require('./grass/users');
  app.use("/users", pinusers);

  const ppsearch = require('./grass/search');
  app.use("/search", ppsearch);

  const pinlogs = require('./grass/logs');
  app.use("/logs", pinlogs);

  const grasstable = require('./grass/tables');
  app.use("/table", grasstable);

  const grasssubs = require('./grass/subs');
  app.use("/subs", grasstable);

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