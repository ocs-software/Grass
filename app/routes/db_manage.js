// routes/db_manage.js

module.exports = {
  choose_db: function (req, database, suffix) {
    //const custID = req.params.dbid
    //const tourID = req.params.tourid

    let dbrec = "pin_positions"
    //if (dbrec.includes(' ')) {
    //  console.log("dbrec with white space:")
    //  console.log(dbrec)
    //}

    //if (suffix) {
    //  dbrec += "_" + suffix
    //} else {
    //  dbrec += "_cache"
    //}

    thisDb = database.db(dbrec)

    return thisDb;

  }
};