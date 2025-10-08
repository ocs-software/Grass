const { response } = require("express");
const express = require("express");
const router = express.Router({ mergeParams: true });
const mongodb = require("mongodb");
const postmark = require("postmark");
let ObjectID = require('mongodb').ObjectID
const axios = require('axios');
const { generateApiKey } = require('generate-api-key');

router.post("/course", async (req, res) => {
    try {
        const { user_email, token, c_id } = req.body;

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

        if (c_id == null || c_id == "") {
            errMess += " Course Missing";
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
                    res_json.message = "Fetching Account Details";
                    res_json.email = user_email;
                    res.send({ res_json });
                } else {
                    if (item.length > 0) {
                        if (item[0].token == token) {
                            thisDb.collection("courses").aggregate([{ '$match': { 'course': c_id } },
                            { $lookup: { from: 'venues', localField: 'venue', foreignField: '_id', as: 'venue' } }
                            ]).toArray(function (err, item) {
                                if (err) {
                                    console.log(err)
                                    let res_json = { status: "FAILED", };
                                    res_json.message = "Fetching Course Details";
                                    res.send({ res_json });
                                } else {
                                    if (item.length > 0) {
                                        let res_json = { status: "OK", }
                                        res_json.message = "Course Details Found";
                                        res_json.user_email = user_email;
                                        res_json.data = item[0];
                                        res.res_json = res_json;
                                        res.send({ res_json });
                                    } else {
                                        let res_json = { status: "ERROR", };
                                        res_json.message = "Course Not Found";
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
        res_json.message = "Error in Course.";
        res.res_json = res_json;
        res.send({ res_jon });
    }

    function validateEmail(email) {
        var re = /\S+@\S+\.\S+/;
        return re.test(email);
    }
});

/*
router.post("/courses", async (req, res) => {
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
                                owner = item[0].linked_from
                            }
                            let query = { owner: owner };
                            thisDb.collection("venues").aggregate([{ '$match': { 'owner': owner } },
                            { $lookup: { from: 'courses', localField: '_id', foreignField: 'venue', as: 'courses' } }
                            ]).toArray(function (err, item) {
                                if (err) {
                                    console.log(err)
                                    let res_json = { status: "FAILED", };
                                    res_json.message = "An error Fetching Venue Email Details has occurred";
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
                                        res_json.message = "Venue Email Not Found";
                                        res.send({ res_json })
                                    }
                                }
                            });
                        } else {
                            let res_json = { status: "ERROR", };
                            res_json.message = "Account Not Verified or Wrong Token";
                            res.send({ res_json })
                        }
                    } else {
                        let res_json = { status: "ERROR", };
                        res_json.message = "No Details Not Found";
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
*/

router.post("/delete", async (req, res) => {
    try {
        const { user_email, token, c_id } = req.body;

        db = req.db;
        const thisDb = db.db("pin_positions");

        var errMess = "";
        if (user_email == null || user_email == "") {
            errMess = " Email Address Missing";
        }
        if (token == null || token == "") {
            errMess += " Token Missing";
        }
        if (c_id == null || c_id == "") {
            errMess += " Course Missing";
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
            res_json.course = c_id;
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
                            res_json.message = "Account is a Sub-Account and cannot Delete a Course.";
                            res_json.email = user_email;
                            res.send({ res_json })
                        }
                        if (item[0].token == token) {
                            query = { course: c_id };
                            thisDb.collection("courses").find(query).toArray(function (err, course) {
                                if (item.length > 0) {
                                    thisDb.collection("courses").deleteOne(query, function (err, item) {
                                        if (err) {
                                            console.log(err)
                                            let res_json = { status: "FAILED", };
                                            res_json.message = "An error Deleting Course Details has occurred";
                                            res.send({ res_json });
                                        } else {
                                            let res_json = { status: "OK", }
                                            res_json.message = "Course Deleted";
                                            res.res_json = res_json;
                                            res.send({ res_json });
                                            query = {
                                                user_email: user_email,
                                                owner: "",
                                                venue: course[0].venue,
                                                venue_name: course[0].venue_name,
                                                course: course[0].course,
                                                course_name: course[0].name,
                                                message: "Course Deleted",
                                                created: new Date(Date.now()),
                                                unix_timestamp: Date.now()
                                            };
                                            thisDb.collection("logs").insertOne(query, function (err, result) { });
                                        }
                                    });
                                } else {
                                    let res_json = { status: "FAILED", }
                                    res_json.message = "Course Does Not Exist";
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
        res_json.message = "Error in Delete Course.";
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
        const { user_email, token, c_name, c_venue, c_id, c_holes, v_name, v_postcode, v_country, c_long, c_lat } = req.body;
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
        if (c_name == null || c_name == "") {
            errMess += " Course Name Missing";
        }
        if (c_venue == null || c_venue == "") {
            errMess += " Course Venue Missing";
        }
        if (c_id == null || c_id == "") {
            errMess += " Course ID Missing";
        }
        var venue_name = v_name;
        if (venue_name == null) {
            venue_name = "";
        }
        var venue_postcode = v_postcode;
        if (venue_postcode == null) {
            venue_postcode = "";
        }
        var venue_country = v_country;
        if (venue_country == null) {
            venue_country = "";
        }
        var course_long = c_long;
        if (course_long == null || course_long == "") {
            course_long = 0;
        }
        var course_lat = c_lat;
        if (course_lat == null || course_lat == "") {
            course_lat = 0;
        }


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
                        if (item[0].linked_from != "") {
                            let res_json = { status: "FAILED", };
                            res_json.message = "Account is a Sub-Account and cannot Create a New Course.";
                            res_json.email = user_email;
                            res.send({ res_json })
                        }
                        // if (item[0].verified == "Y" && item[0].token == token) {
                        if (item[0].token == token) {
                            // User OK Check and Create Course
                            // let query = { venue: ObjectID(c_venue), course: c_id };
                            let query = { course: c_id };
                            thisDb.collection("courses").find(query).toArray(function (err, course) {
                                if (err) {
                                    let res_json = { status: "FAILED", }
                                    res_json.message = "Checking Course";
                                    res_json.user_email = user_email;
                                    res.res_json = res_json;
                                    res.send({ res_json });
                                } else {
                                    if (course.length > 0) {
                                        let res_json = { status: "FAILED", }
                                        res_json.message = "Course Already Attached to a Venue. Please contact Support.";
                                        res_json.user_email = user_email;
                                        res.res_json = res_json;
                                        res.send({ res_json });
                                    } else {
                                        query = {
                                            venue: ObjectID(c_venue),
                                            owner: user_email,
                                            course: c_id,
                                            name: c_name,
                                            venue_name: venue_name,
                                            venue_postcode: venue_postcode,
                                            venue_country: venue_country,
                                            long: course_long,
                                            lat: course_lat,
                                            hole_data: c_holes,
                                            created: new Date(Date.now()),
                                            updated: new Date(Date.now()),
                                            unix_timestamp: Date.now()
                                        };
                                        thisDb.collection("courses").insertOne(query, async function (err, result) {
                                            if (err) {
                                                let res_json = {
                                                    status: "FAILED",
                                                }
                                                res_json.message = "Error Creating Course";
                                                res.res_json = res_json;
                                                res.send({ res_json });
                                            } else {
                                                let res_json = {
                                                    status: "OK",
                                                }
                                                res_json.message = "Course Created.";
                                                res_json.user_email = user_email;
                                                res_json.venue = c_venue;
                                                res_json.course = c_id;
                                                res_json.name = c_name;
                                                res.res_json = res_json;
                                                res.send({ res_json });
                                                query = {
                                                    user_email: user_email,
                                                    owner: "",
                                                    venue: c_venue,
                                                    venue_name: venue_name,
                                                    course: c_id,
                                                    course_name: c_name,
                                                    message: "Course Created: " + c_name,
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
        res_json.message = "Error in New Course data.";
        res.res_json = res_json;
        res.status(400).send({ message: "Error in New Course data.", data: e });
    }

    function validateEmail(email) {
        var re = /\S+@\S+\.\S+/;
        return re.test(email);
    }
});

router.post("/update", async (req, res) => {
    try {
        // const { user_email, token, c_name, c_venue, c_id, c_holes } = req.body;
        const { user_email, token, c_name, c_venue, c_id, c_holes, v_name, v_postcode, v_country, c_long, c_lat } = req.body;
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

        if (c_name == null || c_name == "") {
            errMess += " Course Name Missing";
        }
        if (c_venue == null || c_venue == "") {
            errMess += " Course Venue Missing";
        }
        if (c_id == null || c_id == "") {
            errMess += " Course ID Missing";
        }

        var venue_name = v_name;
        if (venue_name == null) {
            venue_name = "";
        }
        var venue_postcode = v_postcode;
        if (venue_postcode == null) {
            venue_postcode = "";
        }
        var venue_country = v_country;
        if (venue_country == null) {
            venue_country = "";
        }
        var course_long = c_long;
        if (course_long == null || course_long == "") {
            course_long = 0;
        }
        var course_lat = c_lat;
        if (course_lat == null || course_lat == "") {
            course_lat = 0;
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
            // Check Account is logged in (Verified and token matches)
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
                        if (item[0].token == token) {
                            // check course exists
                            let query = { course: c_id };
                            thisDb.collection("courses").find(query).toArray(function (err, course) {
                                if (err) {
                                    console.log(err)
                                    let res_json = { status: "FAILED", };
                                    res_json.message = "Reading Course Details.";
                                    res.res_json = res_json;
                                    res.send({ res_json });
                                } else {
                                    if (course.length > 0) {
                                        let newvalues = {
                                            $set: {
                                                name: c_name,
                                                // venue_name: venue_name,
                                                // venue_postcode: venue_postcode,
                                                // venue_country: venue_country,
                                                // long: course_long,
                                                // lat: course_lat,
                                                hole_data: c_holes,
                                                updated: new Date(Date.now()),
                                                unix_timestamp: Date.now()
                                            }
                                        };
                                        thisDb.collection("courses").updateOne(query, newvalues, function (err, result) {
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
                                                query = {
                                                    user_email: user_email,
                                                    owner: item[0].linked_from,
                                                    venue: c_venue,
                                                    venue_name: venue_name,
                                                    course: c_id,
                                                    course_name: c_name,
                                                    message: "Course update: " + c_name,
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
                        res_json.message = "Account Appears Not To Exist";
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
        res_json.message = "Error in Updating Course.";
        res.res_json = res_json;
        res.status(400).send({ message: "Error in Updating Course.", data: e });
    }

    function validateEmail(email) {
        var re = /\S+@\S+\.\S+/;
        return re.test(email);
    }
});

module.exports = router;
