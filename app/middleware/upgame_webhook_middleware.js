const { check, oneOf, validationResult } = require("express-validator");
const moment = require('moment');
module.exports = [
    check("ocs_customer_code")
        .not()
        .isEmpty()
        .withMessage("Please enter a ocs_customer_code"),
    check("ocs_tour_code")
        .not()
        .isEmpty()
        .withMessage("Please enter a ocs_tour_code"),
    check("ocs_season_id")
        .not()
        .isEmpty()
        .withMessage("Please enter a ocs_season_id"),
    check("ocs_player_id")
        .not()
        .isEmpty()
        .withMessage("Please enter a ocs_player_id"),
    check("upgame_player_id")
        .not()
        .isEmpty()
        .withMessage("Please enter a upgame_player_id"),
    check("upgame_round_id")
        .not()
        .isEmpty()
        .withMessage("Please enter a upgame_round_id"),
    check("round_number")
        .not()
        .isEmpty()
        .withMessage("Please enter a round_number"),
    check("ocs_tourn_id")
        .not()
        .isEmpty()
        .withMessage("Please enter a ocs_tourn_id"),
]