const { response } = require("express");
const express = require("express");
const router = express.Router({ mergeParams: true });
const mongodb = require("mongodb");
const postmark = require("postmark");
let ObjectID = require('mongodb').ObjectID
const axios = require('axios');
// const { generateApiKey } = require('generate-api-key');

router.post("/venue", async (req, res) => {
    try {
        const { user_email, token, venue } = req.body;

        db = req.db;
        const thisDb = db.db("pin_positions");

        var errMess = "";
        if (user_email == null || user_email == "") {
            errMess = "Email Address Missing";
        }

        if (errMess == "") {
            if (!validateEmail(user_email)) {
                errMess = "Invalid Email Address Sent";
            }
        }

        if (token == null || token == "") {
            errMess += " Token Missing";
        }

        if (venue == null || venue == "") {
            errMess += " Venue Missing";
        }

        if (errMess !== "") {
            let res_json = {
                status: "FAILED",
            }
            res_json.message = errMess;
            res.send({ res_json });
        }
        else {
            let query = { user_email: user_email };
            thisDb.collection("users").find(query).toArray(function (err, item) {
                if (err) {
                    console.log(err)
                    let res_json = { status: "FAILED", };
                    res_json.message = "An error Fetching Account Details has occurred";
                    res_json.email = user_email;
                    res.send({ res_json });
                } else {
                    if (item.length > 0) {
                        if (item[0].token == token) {
                            var owner = user_email;
                            if (item[0].linked_from != "" && item[0].linked_from != null) {
                                // we are a Sub-account but need to use Owner email to get Venue
                                owner = item[0].linked_from;
                            }
                            thisDb.collection("venues").aggregate([{ '$match': { 'owner': owner, '_id': ObjectID(venue) } },
                            { $lookup: { from: 'courses', localField: '_id', foreignField: 'venue', as: 'courses' } }
                            ]).toArray(function (err, item) {
                                if (err) {
                                    console.log(err)
                                    let res_json = { status: "FAILED", };
                                    res_json.message = "An error Fetching Venue Details has occurred";
                                    res.send({ res_json });
                                } else {
                                    if (item.length > 0) {
                                        let res_json = { status: "OK", }
                                        res_json.message = "Venue Details Found";
                                        res_json.user_email = user_email;
                                        res_json.data = item[0];
                                        res.res_json = res_json;
                                        res.send({ res_json });
                                    } else {
                                        let res_json = { status: "ERROR", };
                                        res_json.message = "Venue Details Not Found Or Not Owner";
                                        res.send({ res_json })
                                    }
                                }
                            });
                        } else {
                            let res_json = { status: "ERROR", };
                            res_json.message = "Invalid Token Sent. Another Device has Logged on.";
                            res.send({ res_json })
                        }
                    } else {
                        let res_json = { status: "ERROR", };
                        res_json.message = "Account Details Not Found";
                        res.send({ res_json })
                    }
                }
            });
        }
    } catch (e) {
        console.log(e)
        let res_json = {
            status: "FAILED",
        }
        res_json.message = "Error in Venue Checking Email.";
        res.res_json = res_json;
        res.status(400).send({ message: "Error in Venue Checking Email.", data: e });
    }

    function validateEmail(email) {
        var re = /\S+@\S+\.\S+/;
        return re.test(email);
    }
});

router.post("/venues", async (req, res) => {
    try {
        const { user_email, token } = req.body;

        db = req.db;
        const thisDb = db.db("pin_positions");

        var errMess = "";
        if (user_email == null || user_email == "") {
            errMess = "Email Address Missing";
        }

        if (errMess == "") {
            if (!validateEmail(user_email)) {
                errMess = "Invalid Email Address Sent";
            }
        }

        if (token == null || token == "") {
            errMess += " Token Missing";
        }

        if (errMess !== "") {
            let res_json = {
                status: "FAILED",
            }
            res_json.message = errMess;
            res.send({ res_json });
        } else {
            let query = { user_email: user_email };
            thisDb.collection("users").find(query).toArray(function (err, item) {
                if (err) {
                    console.log(err)
                    let res_json = { status: "FAILED", };
                    res_json.message = "An error Fetching Account Details has occurred";
                    res_json.email = user_email;
                    res.send({ res_json });
                } else {
                    if (item.length > 0) {
                        // if (item[0].verified == "Y" && item[0].token == token) {
                        if (item[0].token == token) {
                            var owner = user_email;
                            if (item[0].linked_from != "") {
                                // we are a Sub-account but need to use Owner email to get Venue
                                owner = item[0].linked_from;
                            }
                            let query = { owner: owner };
                            thisDb.collection("venues").aggregate([{ '$match': { 'owner': owner } },
                            { $lookup: { from: 'courses', localField: '_id', foreignField: 'venue', as: 'courses' } }
                            ]).toArray(function (err, item) {
                                if (err) {
                                    console.log(err)
                                    let res_json = { status: "FAILED", };
                                    res_json.message = "An error Fetching Venue Details has occurred";
                                    res.send({ res_json });
                                } else {
                                    if (item.length > 0) {
                                        let res_json = { status: "OK", }
                                        res_json.message = "Venue Details Found";
                                        res_json.user_email = user_email;
                                        res_json.data = item;
                                        res.res_json = res_json;
                                        res.send({ res_json });
                                    } else {
                                        let res_json = { status: "ERROR", };
                                        res_json.message = "No Venue Details Found For User";
                                        res.send({ res_json })
                                    }
                                }
                            });
                        } else {
                            let res_json = { status: "ERROR", };
                            res_json.message = "Invalid Token Sent. Another Device has Logged on.";
                            res.send({ res_json })
                        }
                    } else {
                        let res_json = { status: "ERROR", };
                        res_json.message = "Account Not Found";
                        res.send({ res_json })
                    }
                }
            });
        }
    } catch (e) {
        console.log(e)
        let res_json = {
            status: "FAILED",
        }
        res_json.message = "Error in Venue Checking Email.";
        // res_json.data = e;
        res.res_json = res_json;
        res.status(400).send({ message: "Error in Venue Checking Email.", data: e });
    }

    function validateEmail(email) {
        var re = /\S+@\S+\.\S+/;
        return re.test(email);
    }
});

router.post("/delete", async (req, res) => {
    try {
        const { user_email, token, venue } = req.body;

        db = req.db;
        const thisDb = db.db("pin_positions");

        var errMess = "";
        if (user_email == null || user_email == "") {
            errMess = " Email Address Missing";
        }
        if (token == null || token == "") {
            errMess += " Token Missing";
        }
        if (venue == null || venue == "") {
            errMess += " Venue Missing";
        }
        if (errMess == "") {
            if (!validateEmail(user_email)) {
                errMess += " Invalid Email Address Sent";
            }
        }

        if (errMess != "") {
            let res_json = {
                status: "FAILED",
            }
            res_json.message = errMess;
            res_json.email = user_email;
            res_json.token = token;
            res_json.venue = venue;
            res.send({ res_json });
        }
        else {
            let query = { user_email: user_email };
            thisDb.collection("users").find(query).toArray(function (err, item) {
                if (err) {
                    console.log(err)
                    let res_json = { status: "FAILED", };
                    res_json.message = "An error Fetching Account Details has occurred";
                    res_json.email = user_email;
                    res.send({ res_json });
                } else {
                    if (item.length > 0) {
                        if (item[0].linked_from != "") {
                            let res_json = { status: "FAILED", };
                            res_json.message = "Account is a Sub-Account and cannot delete a Venue.";
                            res_json.email = user_email;
                            res.send({ res_json })
                        }
                        if (item[0].token == token) {
                            query = { _id: ObjectID(venue) };
                            thisDb.collection("venues").find(query).toArray(function (err, item) {
                                if (item.length > 0) {
                                    if (item.owner = user_email) {
                                        thisDb.collection("venues").deleteOne(query, function (err, venues) {
                                            if (err) {
                                                console.log(err)
                                                let res_json = { status: "FAILED", };
                                                res_json.message = "An error Deleting Venue Details has occurred";
                                                res.send({ res_json });
                                            } else {
                                                let res_json = { status: "OK", }
                                                res_json.message = "Venue Deleted";
                                                res.res_json = res_json;
                                                res.send({ res_json });
                                                // delete any courses
                                                let query = { venue: ObjectID(venue) };
                                                thisDb.collection("courses").deleteMany(query, function (err, courses) {
                                                    if (err) {
                                                        console.log("Delete Courses/Delete Venue Error")
                                                        console.log(err)
                                                    } else { }
                                                });
                                                query = {
                                                    user_email: user_email,
                                                    owner: "",
                                                    venue: venue,
                                                    venue_name: item[0].name,
                                                    course: "",
                                                    course_name: "",
                                                    message: "Venue and Courses Deleted",
                                                    created: new Date(Date.now()),
                                                    unix_timestamp: Date.now()
                                                };
                                                thisDb.collection("logs").insertOne(query, function (err, result) { });
                                            }
                                        });
                                    } else {
                                        let res_json = { status: "FAILED", };
                                        res_json.message = "Cannot delete Not the Owner";
                                        res.send({ res_json });
                                    }
                                } else {
                                    let res_json = { status: "FAILED", }
                                    res_json.message = "Venue Does Not Exist";
                                    res.res_json = res_json;
                                    res.send({ res_json });
                                }
                            });
                        } else {
                            let res_json = { status: "FAILED", };
                            res_json.message = "Invalid Token Sent. Another Device has Logged on.";
                            res_json.email = user_email;
                            res_json.token = token;
                            res_json.venue = venue;
                            res.send({ res_json })
                        }
                    } else {
                        let res_json = { status: "FAILED", };
                        res_json.message = "Email Not Found";
                        res_json.email = user_email;
                        res.send({ res_json })
                    }
                }
            });
        }
    } catch (e) {
        console.log(e)
        let res_json = {
            status: "FAILED",
        }
        res_json.message = "Error in Delete Venue.";
        res.res_json = res_json;
        res.send({ res_json })
    }

    function validateEmail(email) {
        var re = /\S+@\S+\.\S+/;
        return re.test(email);
    }
});

router.post("/new", async (req, res) => {
    try {
        const { user_email, token, v_name, v_addr1, v_addr2, v_town, v_state, v_postcode, v_country, v_phone, v_email, v_website, v_force } = req.body;
        response.data = req.body;

        db = req.db;
        const thisDb = db.db("pin_positions");

        var errMess = "";
        if (user_email === null || user_email === "") {
            errMess = "Email Address Missing";
        }
        if (errMess == "") {
            if (!validateEmail(user_email)) {
                errMess = "Invalid Email Address Sent";
            }
        }
        if (token == null || token == "") {
            errMess += " User Token Missing";
        }
        if (v_name == null || v_name == "") {
            errMess += " Venue Name Missing";
        }
        if (v_website == null || v_website == "") {
            errMess += " Venue Wesite Missing";
        }
        if (v_postcode == null || v_postcode == "") {
            errMess += " Venue Postcode Missing";
        }

        /*
        if (v_force != "Y") {
            v_force = "N"
        }
            */
        if (errMess !== "") {
            let res_json = {
                status: "FAILED",
            }
            res_json.message = errMess;
            res.res_json = res_json;
            res.send({ res_json });
        } else {
            let query = { user_email: user_email };
            thisDb.collection("users").find(query).toArray(function (err, item) {
                if (err) {
                    console.log(err)
                    let res_json = { status: "FAILED", };
                    res_json.message = "Getting Account Details";
                    res.send({ res_json });
                } else {
                    if (item.length > 0) {
                        // if (item[0].verified == "Y" && item[0].token == token) {
                        if (item[0].linked_from != "") {
                            let res_json = { status: "FAILED", };
                            res_json.message = "Account is a Sub-Account and cannot add a New Venue.";
                            res_json.email = user_email;
                            res.send({ res_json })
                        }
                        if (item[0].token == token) {
                            // User OK , now Check we already do not have a Venue with the same Postcode and Website
                            // let query = { postcode: v_postcode, website: v_website };
                            let query = { postcode: { "$regex": v_postcode, "$options": "i" }, website: { "$regex": v_website, "$options": "i" } };
                            thisDb.collection("venues").find(query).toArray(function (err, venue) {
                                if (err) {
                                    console.log(err);
                                    let res_json = { status: "FAILED", }
                                    res_json.message = "Checking Venue. (".v_postcode + " " + v_website + ")";
                                    res_json.user_email = user_email;
                                    res_json.postcode = v_postcode;
                                    res_json.website = v_website;
                                    res.res_json = res_json;
                                    res.send({ res_json });
                                } else {
                                    if (venue.length > 0 && v_force != "Y") {
                                        let res_json = { status: "FORCE", }
                                        res_json.message = "Venues exist with the same Postcode and Website";
                                        res_json.user_email = user_email;
                                        res.res_json = res_json;
                                        res.send({ res_json });
                                    } else {
                                        // Create Venue
                                        query = {
                                            owner: user_email,
                                            name: v_name,
                                            addr1: v_addr1,
                                            addr2: v_addr2,
                                            town: v_town,
                                            state: v_state,
                                            postcode: v_postcode,
                                            country: v_country,
                                            email: v_email,
                                            website: v_website,
                                            phone: v_phone,
                                            created: new Date(Date.now()),
                                            updated: new Date(Date.now()),
                                            unix_timestamp: Date.now()
                                        };
                                        thisDb.collection("venues").insertOne(query, async function (err, result) {
                                            if (err) {
                                                let res_json = {
                                                    status: "FAILED",
                                                }
                                                res_json.message = "Error Creating Venue";
                                                res.res_json = res_json;
                                                res.send({ res_json });
                                            } else {
                                                let res_json = {
                                                    status: "OK",
                                                }
                                                res_json.message = "Venue Created.";
                                                res.res_json = res_json;
                                                res.send({ res_json });

                                                // console.log(result);

                                                let query = {
                                                    user_email: user_email,
                                                    owner: "",
                                                    venue: result.insertedId.toString(),
                                                    venue_name: v_name,
                                                    course: "",
                                                    course_name: "",
                                                    message: "Venue Created: " + v_name,
                                                    created: new Date(Date.now()),
                                                    unix_timestamp: Date.now()
                                                };
                                                thisDb.collection("logs").insertOne(query, function (err, result) { });
                                            }
                                        });
                                    }
                                }
                            });
                        } else {
                            let res_json = { status: "FAILED", }
                            res_json.message = "Invalid Token Sent. Another Device has Logged on.";
                            res_json.user_email = user_email;
                            res.res_json = res_json;
                            res.send({ res_json });
                        }
                    } else {
                        let res_json = { status: "FAILED", }
                        res_json.message = "Account Does Not Exists";
                        res_json.user_email = user_email;
                        res.res_json = res_json;
                        res.send({ res_json });
                    }
                }
            });
        }
    } catch (e) {
        console.log(e)
        let res_json = {
            status: "FAILED",
        }
        res_json.message = "Error in New Venue data.";
        res.res_json = res_json;
        res.status(400).send({ message: "Error in New Venue data.", data: e });
    }

    function validateEmail(email) {
        var re = /\S+@\S+\.\S+/;
        return re.test(email);
    }
});

router.post("/update", async (req, res) => {
    try {
        const { user_email, token, v_venue, v_name, v_addr1, v_addr2, v_town, v_state, v_postcode, v_country, v_phone, v_email, v_website, v_force } = req.body;
        response.data = req.body;

        db = req.db;
        const thisDb = db.db("pin_positions");

        var errMess = "";
        if (user_email === null || user_email === "") {
            errMess = "Email Address Missing";
        }
        if (errMess == "") {
            if (!validateEmail(user_email)) {
                errMess = "Invalid Email Address Sent";
            }
        }
        if (token == null || token == "") {
            errMess += " User Token Missing";
        }
        if (v_name == null || v_name == "") {
            errMess += " Venue Name Missing";
        }
        if (v_venue == null || v_venue == "") {
            errMess += " Venue ID Missing";
        }

        /*
        if (v_force != "Y") {
            v_force = "N"
        }
            */

        if (errMess !== "") {
            let res_json = {
                status: "FAILED",
            }
            res_json.message = errMess;
            res.res_json = res_json;
            res.send({ res_json });
        }
        else {
            // Check if email already exists 
            let query = { user_email: user_email };
            thisDb.collection("users").find(query).toArray(function (err, item) {
                if (err) {
                    console.log(err)
                    let res_json = { status: "FAILED", };
                    res_json.message = "An error Checking Email Details Exist";
                    res.send({ res_json });
                } else {
                    if (item.length > 0) {
                        if (item[0].linked_from != "") {
                            let res_json = { status: "FAILED", };
                            res_json.message = "Account is a Sub-Account and cannot Update a Venue.";
                            res_json.email = user_email;
                            res.send({ res_json })
                        }
                        // if (item[0].verified == "Y" && item[0].token == token) {
                        if (item[0].token == token) {
                            // check venue exists
                            let query = { _id: ObjectID(v_venue) };
                            thisDb.collection("venues").find(query).toArray(function (err, venue) {
                                if (err) {
                                    console.log(err)
                                    let res_json = { status: "FAILED", };
                                    res_json.message = "Reading Venue Details.";
                                    res.res_json = res_json;
                                    res.send({ res_json });
                                } else {
                                    if (venue.length > 0) {
                                        if (venue[0].owner == user_email) {
                                            let newvalues = {
                                                $set: {
                                                    // owner: user_email,
                                                    name: v_name,
                                                    addr1: v_addr1,
                                                    addr2: v_addr2,
                                                    town: v_town,
                                                    state: v_state,
                                                    postcode: v_postcode,
                                                    country: v_country,
                                                    phone: v_phone,
                                                    email: v_email,
                                                    website: v_website,
                                                    // created: new Date(Date.now()),
                                                    updated: new Date(Date.now()),
                                                    unix_timestamp: Date.now()
                                                }
                                            };
                                            thisDb.collection("venues").updateOne(query, newvalues, function (err, result) {
                                                if (err) {
                                                    let res_json = {
                                                        status: "FAILED",
                                                    }
                                                    res.res_json.message = "Error Updating Venue"
                                                    res.send({ res_json });
                                                } else {
                                                    let res_json = {
                                                        status: "OK",
                                                    }
                                                    res_json.message = "Venue Updated.";
                                                    res_json.venue = v_venue;
                                                    res.res_json = res_json;
                                                    res.send({ res_json });
                                                    // now update any courses
                                                    let newvalues = {
                                                        $set: {
                                                            venue_name: v_name,
                                                            venue_postcode: v_postcode,
                                                            venue_country: v_country,
                                                            // long: course_long,
                                                            // lat: course_lat,
                                                            // hole_data: c_holes,
                                                            updated: new Date(Date.now()),
                                                            unix_timestamp: Date.now()
                                                        }
                                                    };
                                                    let query = { venue: ObjectID(v_venue) };
                                                    thisDb.collection("courses").updateOne(query, newvalues, function (err, result) {
                                                        /*
                                                        if (err) {
                                                            let res_json = {
                                                                status: "FAILED",
                                                            }
                                                            res.res_json.message = "Error Updating Course"
                                                            res.send({ res_json });
                                                        } else {
                                                            let res_json = {
                                                                status: "OK",
                                                            }
                                                            res_json.message = "Course Updated.";
                                                            res_json.venue = c_venue;
                                                            res_json.course = c_id;
                                                            res.res_json = res_json;
                                                            res.send({ res_json });
                                                        }
                                                            */
                                                    });
                                                    query = {
                                                        user_email: user_email,
                                                        owner: "",
                                                        venue: v_venue,
                                                        venue_name: v_name,
                                                        course: "",
                                                        course_name: "",
                                                        message: "Venue Updated: " + v_name,
                                                        created: new Date(Date.now()),
                                                        unix_timestamp: Date.now()
                                                    };
                                                    thisDb.collection("logs").insertOne(query, function (err, result) { });
                                                }
                                            });
                                        } else {
                                            let res_json = {
                                                status: "FAILED",
                                            }
                                            res.res_json.message = "Not Owner of Venue"
                                            res.send({ res_json });
                                        }
                                    }
                                }
                            });
                        } else {
                            let res_json = { status: "FAILED", }
                            res_json.message = "Invalid Token Sent. Another Device has Logged on.";
                            res_json.user_email = user_email;
                            res.res_json = res_json;
                            res.send({ res_json });
                        }
                    } else {
                        let res_json = { status: "FAILED", }
                        res_json.message = "Email Does Not Exist";
                        res_json.user_email = user_email;
                        res.res_json = res_json;
                        res.send({ res_json });
                    }
                }
            });
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

    function validateEmail(email) {
        var re = /\S+@\S+\.\S+/;
        return re.test(email);
    }
});

module.exports = router;
