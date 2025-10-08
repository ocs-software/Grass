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
        const { user_email, user_firstname, user_surname } = req.body;
        response.data = req.body;

        var errMess = "";
        if (user_email === null || user_email === "") {
            errMess = "Email Address Missing";
        }
        if (user_firstname === null || user_firstname === "") {
            errMess = "User Firstname Missing";
        }
        if (user_surname === null || user_surname === "") {
            errMess = "User Surname Missing";
        }
        if (errMess !== "") {
            let res_json = {
                status: "FAILED",
            }
            res_json.message = errMess;
            res.res_json = res_json;
            res.send({ res_json });
        }
        else {
            let res_json = {
                status: "OK",
            }
            res_json.message = "User Data OK";
            res.res_json = res_json;
            res.send({ res_json });
        }
    } catch (e) {
        console.log(e)
        let res_json = {
            status: "FAILED",
        }
        res_json.message = "Error in Fetching data.";
        res.res_json = res_json;
        res.status(400).send({ message: "Error in Fetching data.", data: e });
    }
});

module.exports = router;
