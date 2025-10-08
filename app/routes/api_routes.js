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

  const pinusers = require('./pinusers/users');
  app.use("/users", pinusers);

  const pinvenues = require('./pinusers/venues');
  app.use("/venues", pinvenues);

  const pincourses = require('./pinusers/courses');
  app.use("/courses", pincourses);

  const ppsearch = require('./pinusers/search');
  app.use("/search", ppsearch);

  const pinlogs = require('./pinusers/logs');
  app.use("/logs", pinlogs);

  /*
  const pinlinked = require('./pinusers/linked');
  app.use("/linked", pinlinked);

*/
};