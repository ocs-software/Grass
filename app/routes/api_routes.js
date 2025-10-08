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
    res.json({ message: "Pin Position API Working" });
  });

  const pinusers = require('./grass/users');
  app.use("/users", pinusers);

  const pinvenues = require('./grass/venues');
  app.use("/venues", pinvenues);

  const pincourses = require('./grass/courses');
  app.use("/courses", pincourses);

  const ppsearch = require('./grass/search');
  app.use("/search", ppsearch);

  const pinlogs = require('./grass/logs');
  app.use("/logs", pinlogs);

  /*
  const pinlinked = require('./pinusers/linked');
  app.use("/linked", pinlinked);

*/
};