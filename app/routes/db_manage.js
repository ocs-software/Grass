/**
 * Database selector used by the current Grass routes.
 *
 * At present the selector always returns the `grass` database. Historical
 * suffix/cache selection logic remains commented below and is not active.
 */

module.exports = {
  /**
   * Selects the MongoDB database used for a Grass request.
   *
   * @param {Object} req Express request (currently not used for selection).
   * @param {Object} database MongoDB client.
   * @returns {Object} MongoDB database handle.
   */
  choose_db: function (req, database) {
    //const custID = req.params.dbid
    //const tourID = req.params.tourid

    let dbrec = "grass"
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