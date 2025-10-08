// routes/db_manage.js

module.exports = {
  choose_db: function (req, database, suffix) {
    const custID = req.params.dbid
    const tourID = req.params.tourid
    
    let dbrec = custID

    if (suffix) {
      dbrec += "_" + suffix
    } else {
      dbrec += "_sfs"
    }

    thisDb = database.db(dbrec)

    return thisDb;

  }
};