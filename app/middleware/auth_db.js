/**
 * Database selector used by the token-usage middleware.
 *
 * The database name is derived from the request customer identifier and an
 * optional suffix. The tour identifier is currently read but not used when
 * constructing the database name.
 */

module.exports = {
  /** Selects the customer database for the current request. */
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