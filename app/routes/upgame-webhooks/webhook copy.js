// These endooints are cached by our CF caching rules so we do not overuse the API keys
const { response } = require("express");
const express = require("express");
const { check, oneOf, validationResult } = require("express-validator");
const router = express.Router({ mergeParams: true });
const mongodb = require("mongodb");
let ObjectID = require('mongodb').ObjectID
const axios = require('axios');

const check_post_data = require('../../middleware/upgame_webhook_middleware');

// Validate the endpoint round scores for this player
// 'scores' should be a hole-by-hole array of each holes score. We will validate this against what is in OCS and return true if it matches what we have for each hole
router.post("/validate-score", async (req, res) => {
    try {
        const { ocs_customer_code, ocs_tour_code, ocs_season_id, ocs_tourn_id, ocs_course_id, ocs_player_id, upgame_player_id, round_number, scores } = req.body;

        response.data = req.body

        var errMess = "";
        if (ocs_customer_code === null || ocs_customer_code === "") {
            errMess = "OCS Customer Code Missing. Please contact UpGame";
        }
        if (ocs_season_id === null || ocs_season_id === "") {
            errMess = "OCS Season ID Missing. Please contact UpGame";
        }
        if (ocs_player_id === null || ocs_player_id === "") {
            errMess = "OCS Player ID Missing. Please contact UpGame";
        }
        if (ocs_tourn_id === null || ocs_tourn_id === "") {
            errMess = "OCS Tournament ID Missing. Please contact UpGame";
        }
        if (round_number === null || round_number === "") {
            errMess = "OCS Round Number Missing. Please contact UpGame";
        }

        var playerMess = "(" + ocs_player_id + "/" + round_number + ")";

        if (errMess !== "") {
            let res_json = {
                scores_status: false,
            }
            res_json.message = errMess + " " + playerMess + " " + upgame_player_id;
            res.res_json = res_json;
            res.send({ res_json });
        }
        else {
            let req_for_db = {
                params: {
                    dbid: ocs_customer_code,
                    tourid: ocs_tour_code
                }
            }

            const manage_db = require('../db_manage')
            const thisDb = manage_db.choose_db(req_for_db, req.db)

            const score_document = ocs_season_id + "-" + ocs_tourn_id + "-scores-latest.json";
            const round_scores = "hole_scores_R" + round_number;
            const idreg = score_document.replace(/[<>*()?]/g, "\\$&");

            let query = {
                "_id": { $regex: new RegExp("^" + idreg, "i") }
            }
            // get data from mongo cache
            let lookup = await thisDb.collection(ocs_season_id).find(query).toArray();

            if (lookup && lookup.length > 0) {
                // drill down to first instance for the player
                const object = lookup[0].data.scores.scores_entry.find(obj => obj.member_no === ocs_player_id);
                if (object) {
                    // Drill down to required round
                    if (object[round_scores]) {
                        const scores_array = object[round_scores].replace(/,\s*$/, "").split(",");
                        if (scores_array) {
                            // check if scores match with data sent by Upgame
                            const match = scores_array.every((element, index) => element == scores[index].score);

                            let res_json = {
                                scores_status: match,
                            }

                            if (match === false) {
                                // scores mis-match
                                let error_holes = []
                                scores_array.forEach((element, index) => {
                                    if (element != scores[index].score) {
                                        error_holes.push(scores[index])
                                    }
                                });
                                res_json.message = "Scores Do Not Match. Please check Scores " + playerMess;
                                res.res_json = res_json;
                                // let err_json = res_json;
                                // err_json.error_holes = error_holes;
                                res.send({ res_json });
                            }
                            else {
                                // scores match
                                res_json.message = "Scores Match";
                                res.res_json = res_json;
                                res.send({ res_json });
                            }
                        }
                        else {
                            let res_json = {
                                scores_status: false,
                            }
                            res_json.message = "No Round Scores For Player. Please try again... " + playerMess;
                            res.res_json = res_json;
                            res.send({ res_json });
                        }
                    } else {
                        let res_json = {
                            scores_status: false,
                        }
                        res_json.message = "Round Scores NOT Found For Player. Please try again... " + playerMess;
                        res.res_json = res_json;
                        res.send({ res_json });
                    }
                }
                else {
                    // player could be cut , cut players NOT included in latest scores normally
                    // lets check for the round
                    const round_document = ocs_season_id + "-" + ocs_tourn_id + "-scores-P*" + round_number + "SRC0" + round_number + ".json";
                    const idregR = round_document.replace(/[<>*()?]/g, "\\$&");

                    let query = {
                        "_id": { $regex: new RegExp("^" + idregR, "i") }
                    }
                    // get data from mongo cache
                    let lookup = await thisDb.collection(ocs_season_id).find(query).toArray();

                    if (lookup && lookup.length > 0) {
                        // have data
                        // drill down to first instance for the player
                        const objectR = lookup[0].data.scores.scores_entry.find(obj => obj.member_no === ocs_player_id);
                        if (objectR) {
                            // Drill down to required round
                            if (objectR[round_scores]) {
                                const scores_arrayR = objectR[round_scores].replace(/,\s*$/, "").split(",");
                                if (scores_arrayR) {
                                    // check if scores match with data sent by Upgame
                                    const matchR = scores_arrayR.every((element, index) => element == scores[index].score);

                                    let res_json = {
                                        scores_status: matchR,
                                    }

                                    if (matchR === false) {
                                        // scores mis-match
                                        let error_holes = []
                                        scores_arrayR.forEach((element, index) => {
                                            if (element != scores[index].score) {
                                                error_holes.push(scores[index])
                                            }
                                        });
                                        res_json.message = "Scores Do Not Match , for Round. Please check Scores " + playerMess;
                                        res.res_json = res_json;
                                        res_json.error_holes = error_holes;
                                        res.send({ res_json });
                                    }
                                    else {
                                        // scores match
                                        res_json.message = "Scores Match for Round";
                                        res.res_json = res_json;
                                        res.send({ res_json });
                                    }
                                }
                                else {
                                    let res_json = {
                                        scores_status: false,
                                    }
                                    res_json.message = "No Round Scores For Player , for Round. Please try again... " + playerMess;
                                    res.res_json = res_json;
                                    res.send({ res_json });
                                }
                            } else {
                                let res_json = {
                                    scores_status: false,
                                }
                                res_json.message = "Round Scores NOT Found For Player , for Round. Please try again... " + playerMess;
                                res.res_json = res_json;
                                res.send({ res_json });
                            }
                        }
                    } else {
                        let res_json = {
                            scores_status: false,
                        }
                        res_json.message = "Player Missing from Latest Scores for tournament. Please try again... " + playerMess;
                        res.res_json = res_json;
                        res.send({ res_json });
                    }
                }
            }
            else {
                let res_json = {
                    scores_status: false,
                }
                res_json.message = "No Latest Scores. Please try again TEST " + playerMess;
                res.res_json = res_json;
                res.send({ res_json });
            }
        }

    } catch (e) {
        console.log(e)
        let res_json = {
            scores_status: false,
        }
        res_json.message = "Error in Fetching data. Please contact UpGame. " + playerMess;
        res.res_json = res_json;
        res.status(400).send({ message: "Error in Fetching data. Please contact UpGame. " + playerMess, data: e });
    }
});

// Validate the endpoint round scores for this player
// 'round_type' is Tournament or Practice
router.post("/round-stat-webhook", check_post_data, async (req, res) => {
    try {
        const { ocs_customer_code, ocs_tour_code, ocs_season_id, ocs_player_id, upgame_player_id, upgame_round_id, round_number, tee_off_timestamp, tourn_name, upgame_tourn_code, ocs_tourn_id, course_name, ocs_course_id, round_type } = req.body;

        // Check for validation errors
        const errors = validationResult(req);

        // If errors then return them in a array called errors
        if (!errors.isEmpty()) {
            let res_json = {
                scores_status: false,
            }
            res_json.message = "Error Updating Stats. Please contact UpGame. Errors:" + errors.array();
            res.res_json = res_json;
            return res.status(400).json({
                errors: errors.array()
            });
        }

        // Make request to backend with API data as we have passed above validation
        // Await return of the result
        const ocs_backend_post = await axios.post('https://ocs-let.com/upgame/upgame/round-stat-webhook', req.body);

        res.status(200).send();

    } catch (e) {
        console.log(e)
        res.status(400).send({ message: "Error in Updating Stats", data: e });
    }
});

module.exports = router;
