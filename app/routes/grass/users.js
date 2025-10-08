const { response } = require("express");
const express = require("express");
const router = express.Router({ mergeParams: true });
const mongodb = require("mongodb");
const postmark = require("postmark");
let ObjectID = require('mongodb').ObjectID
const axios = require('axios');
const { generateApiKey } = require('generate-api-key');
const clientSocket = require('socket.io-client');

const message =
    '<!DOCTYPE html>' +
    '<html>' +
    '<head>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />' +
    '<title>Grass - Email Verification Successful</title>' +
    '<style>' +
    '@import url("https://fonts.googleapis.com/css?family=Open+Sans");' +
    '</style>' +
    '<style type="text/css" rel="stylesheet" media="all"> ' +
    'table, td, tr { border: 0px solid red; align: center; text-align: center; } ' +
    'a { color: #525B65; text-decoration: none; }' +
    '.logo { float: left; } ' +
    '.inset-panel { background-color: rgba(255,255,255,0.7); color: red; margin-top: 2px; padding: 10px; max-width: 1200px; text-align: center;}' +
    '.main-text { font-size:5vw; color: #01458B; width: 100%; text-align: center; font-weight: 600; }' +
    '.bottom-text { padding-top: 9vw; font-size: 3vw; color: #525A66; width: 100%; text-align: center; font-weight: 600; }' +
    'body { font-family: "Open Sans", sans-serif; padding: 30px; text-align: center; }' +
    '@media only screen and (min-width: 1200px) {' +
    '.main-text { font-size: 60px !important; }' +
    '.bottom-text { font-size: 40px !important; }' +
    '}' +
    '@media only screen and (max-width: 768px) {' +
    '.main-text, .bottom-text { font-size: 17px !important; }' +
    '}' +
    '</style>' +
    '</head>' +
    '<body>' +
    '<div>' +
    '<div class="inset-panel" style="margin: 0 auto">' +
    '<table style="width: 100%">' +
    '<tr>' +
    '<td style="width: 33%;"></td>' +
    '<td style="width: 33%;">' +
    '<img style="width: 100%; padding-top: 1vw" class="logo" src="https://vms-images.ams3.cdn.digitaloceanspaces.com/pinpos/PinPos_POS.png" />' +
    '</td>' +
    '<td style="width: 33%;"></td>' +
    '</tr>' +
    '</table>' +
    '<table style="width: 100%">' +
    '<tr><td style="padding-top: 6vw" class="main-text">Thank you for verifying</td></tr>' +
    '<tr><td class="main-text">your logon details.</td></tr>' +
    '</table>' +
    '<div style="padding-top: 5vw"></div>' +
    '</div>' +
    '</div>' +
    '</body>' +
    '</html>';

const errmessage =
    '<!DOCTYPE html>' +
    '<html>' +
    '<head>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />' +
    '<title>Grass - Email Verification FAILED</title>' +
    '<style>' +
    '@import url("https://fonts.googleapis.com/css?family=Open+Sans");' +
    '</style>' +
    '<style type="text/css" rel="stylesheet" media="all"> ' +
    'table, td, tr { border: 0px solid red; align: center; text-align: center; } ' +
    'a { color: #525B65; text-decoration: none; }' +
    '.logo { float: left; } ' +
    '.inset-panel { background-color: rgba(255,255,255,0.7); color: red; margin-top: 2px; padding: 10px; max-width: 1200px; text-align: center;}' +
    '.main-text { font-size:5vw; color: #01458B; width: 100%; text-align: center; font-weight: 600; }' +
    '.bottom-text { padding-top: 9vw; font-size: 3vw; color: #525A66; width: 100%; text-align: center; font-weight: 600; }' +
    'body { font-family: "Open Sans", sans-serif; padding: 30px; text-align: center; }' +
    '@media only screen and (min-width: 1200px) {' +
    '.main-text { font-size: 60px !important; }' +
    '.bottom-text { font-size: 40px !important; }' +
    '}' +
    '@media only screen and (max-width: 768px) {' +
    '.main-text, .bottom-text { font-size: 17px !important; }' +
    '}' +
    '</style>' +
    '</head>' +
    '<body>' +
    '<div>' +
    '<div class="inset-panel" style="margin: 0 auto">' +
    '<table style="width: 100%">' +
    '<tr>' +
    '<td style="width: 33%;"></td>' +
    '<td style="width: 33%;">' +
    '<img style="width: 100%; padding-top: 1vw" class="logo" src="https://vms-images.ams3.cdn.digitaloceanspaces.com/pinpos/PinPos_POS.png" />' +
    '</td>' +
    '<td style="width: 33%;"></td>' +
    '</tr>' +
    '</table>' +
    '<table style="width: 100%">' +
    '<tr><td style="padding-top: 6vw" class="main-text">Sorry verifying failed</td></tr>' +
    '</table>' +
    '<div style="padding-top: 5vw"></div>' +
    '</div>' +
    '</div>' +
    '</body>' +
    '</html>';

const tokenmessage =
    '<!DOCTYPE html>' +
    '<html>' +
    '<head>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />' +
    '<title>Grass - Email Verification FAILED</title>' +
    '<style>' +
    '@import url("https://fonts.googleapis.com/css?family=Open+Sans");' +
    '</style>' +
    '<style type="text/css" rel="stylesheet" media="all"> ' +
    'table, td, tr { border: 0px solid red; align: center; text-align: center; } ' +
    'a { color: #525B65; text-decoration: none; }' +
    '.logo { float: left; } ' +
    '.inset-panel { background-color: rgba(255,255,255,0.7); color: red; margin-top: 2px; padding: 10px; max-width: 1200px; text-align: center;}' +
    '.main-text { font-size:5vw; color: #01458B; width: 100%; text-align: center; font-weight: 600; }' +
    '.bottom-text { padding-top: 9vw; font-size: 3vw; color: #525A66; width: 100%; text-align: center; font-weight: 600; }' +
    'body { font-family: "Open Sans", sans-serif; padding: 30px; text-align: center; }' +
    '@media only screen and (min-width: 1200px) {' +
    '.main-text { font-size: 60px !important; }' +
    '.bottom-text { font-size: 40px !important; }' +
    '}' +
    '@media only screen and (max-width: 768px) {' +
    '.main-text, .bottom-text { font-size: 17px !important; }' +
    '}' +
    '</style>' +
    '</head>' +
    '<body>' +
    '<div>' +
    '<div class="inset-panel" style="margin: 0 auto">' +
    '<table style="width: 100%">' +
    '<tr>' +
    '<td style="width: 33%;"></td>' +
    '<td style="width: 33%;">' +
    '<img style="width: 100%; padding-top: 1vw" class="logo" src="https://vms-images.ams3.cdn.digitaloceanspaces.com/pinpos/PinPos_POS.png" />' +
    '</td>' +
    '<td style="width: 33%;"></td>' +
    '</tr>' +
    '</table>' +
    '<table style="width: 100%">' +
    '<tr><td style="padding-top: 6vw" class="main-text">Sorry verifying failed (Invalid Token Sent)</td></tr>' +
    '</table>' +
    '<div style="padding-top: 5vw"></div>' +
    '</div>' +
    '</div>' +
    '</body>' +
    '</html>';

const missingmessage =
    '<!DOCTYPE html>' +
    '<html>' +
    '<head>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />' +
    '<title>Grass - Email Verification FAILED</title>' +
    '<style>' +
    '@import url("https://fonts.googleapis.com/css?family=Open+Sans");' +
    '</style>' +
    '<style type="text/css" rel="stylesheet" media="all"> ' +
    'table, td, tr { border: 0px solid red; align: center; text-align: center; } ' +
    'a { color: #525B65; text-decoration: none; }' +
    '.logo { float: left; } ' +
    '.inset-panel { background-color: rgba(255,255,255,0.7); color: red; margin-top: 2px; padding: 10px; max-width: 1200px; text-align: center;}' +
    '.main-text { font-size:5vw; color: #01458B; width: 100%; text-align: center; font-weight: 600; }' +
    '.bottom-text { padding-top: 9vw; font-size: 3vw; color: #525A66; width: 100%; text-align: center; font-weight: 600; }' +
    'body { font-family: "Open Sans", sans-serif; padding: 30px; text-align: center; }' +
    '@media only screen and (min-width: 1200px) {' +
    '.main-text { font-size: 60px !important; }' +
    '.bottom-text { font-size: 40px !important; }' +
    '}' +
    '@media only screen and (max-width: 768px) {' +
    '.main-text, .bottom-text { font-size: 17px !important; }' +
    '}' +
    '</style>' +
    '</head>' +
    '<body>' +
    '<div>' +
    '<div class="inset-panel" style="margin: 0 auto">' +
    '<table style="width: 100%">' +
    '<tr>' +
    '<td style="width: 33%;"></td>' +
    '<td style="width: 33%;">' +
    '<img style="width: 100%; padding-top: 1vw" class="logo" src="https://vms-images.ams3.cdn.digitaloceanspaces.com/pinpos/PinPos_POS.png" />' +
    '</td>' +
    '<td style="width: 33%;"></td>' +
    '</tr>' +
    '</table>' +
    '<table style="width: 100%">' +
    '<tr><td style="padding-top: 6vw" class="main-text">Sorry verifying failed (Invalid Email Sent)</td></tr>' +
    '</table>' +
    '<div style="padding-top: 5vw"></div>' +
    '</div>' +
    '</div>' +
    '</body>' +
    '</html>';

router.post("/check", async (req, res) => {
    try {
        const { user_email, token } = req.body;

        db = req.db;
        const thisDb = db.db("grass")

        var errMess = "";
        var owner = "";
        if (user_email === null || user_email === "") {
            errMess = "Email Missing";
        }

        if (errMess == "") {
            if (!validateEmail(user_email)) {
                errMess = "Invalid Email Sent";
            }
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
            // get Account details to check if Owner or Sub Account
            thisDb.collection("users").find(query).toArray(function (err, account) {
                if (err) {
                    console.log(err)
                    let res_json = { status: "ERROR", };
                    res_json.message = "Error Reading Account";
                    res.send({ res_json });
                } else {
                    if (account.length > 0) {
                        // console.log("Got Account 2")
                        if (account[0].token == token) {
                            // console.log("Token Ok")
                            account[0].sub_accounts = [];
                            account[0].venues = [];
                            // Owner or Sub-account
                            owner = user_email;
                            if (account[0].linked_from != "" && account[0].linked_from != null) {
                                // we are a Sub-account but need to use Owner email to get Venues
                                owner = account[0].linked_from;
                            } else {
                                // Owner. Get any sub-accounts
                                query = { linked_from: owner };
                                thisDb.collection("users").find(query).toArray(function (err, subs) {
                                    if (err) {
                                    } else {
                                        if (subs.length > 0) {
                                            account[0].sub_accounts = subs;
                                        }
                                    }
                                });
                            }
                            // get any Venues for Owner
                            query = { owner: owner };
                            thisDb.collection("venues").find(query).toArray(function (err, details) {
                                if (err) {
                                    let res_json = { status: "VERIFIED", }
                                    res_json.message = "Account Found";
                                    res_json.user_email = user_email;
                                    res_json.data = account[0];
                                    res.res_json = res_json;
                                    res.send({ res_json });
                                } else {
                                    if (details.length > 0) {
                                        account[0].venues = details;
                                        let res_json = { status: "VERIFIED", }
                                        res_json.message = "Account Found";
                                        res_json.user_email = user_email;
                                        res_json.data = account[0];
                                        res.res_json = res_json;
                                        res.send({ res_json });
                                    } else {
                                        let res_json = { status: "VERIFIED", }
                                        res_json.message = "Account Found";
                                        res_json.user_email = user_email;
                                        res_json.data = account[0];
                                        res.res_json = res_json;
                                        res.send({ res_json });
                                    }
                                }
                            });
                        } else {
                            let res_json = { status: "CHECKED", }
                            res_json.message = "Invalid Token Sent";
                            res_json.user_email = user_email;
                            res_json.data = account[0];
                            res.res_json = res_json;
                            res.send({ res_json });
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
        res_json.message = "Error in Checking Email.";
        // res_json.data = e;
        res.res_json = res_json;
        res.status(400).send({ message: "Error in Checking Email.", data: e });
    }

    function validateEmail(email) {
        var re = /\S+@\S+\.\S+/;
        return re.test(email);
    }
});

router.post("/delete", async (req, res) => {
    try {
        const { user_email, token, sub_account } = req.body;

        db = req.db;
        const thisDb = db.db("grass")

        var errMess = "";
        var ownername = "";
        var username = "";
        var message = "";
        var templatemodel = "";
        var client = "";
        var serverToken = "d42a8a18-8d6f-45d2-9d3e-c84488456ca4";

        if (user_email === null || user_email === "") {
            errMess = "Email Address Missing";
        }
        if (token === null || token === "") {
            errMess = "Token Missing";
        }
        var sub_acc = sub_account;
        if (sub_account == null || sub_account == "undefined") {
            sub_acc = "";
        }

        if (errMess == "") {
            if (!validateEmail(user_email)) {
                errMess = "Invalid Email Address Sent";
            }
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
                    res_json.message = "An error Fetching Email Details has occurred";
                    res.send({ res_json });
                } else {
                    if (item.length > 0) {
                        if (item[0].token == token) {
                            ownername = item[0].user_firstname + " " + item[0].user_surname;
                            // have we been sent a Sub-account to delete
                            if (sub_acc != "") {
                                // get sub-account
                                let query = { user_email: sub_acc };
                                thisDb.collection("users").find(query).toArray(function (err, sub_accs) {
                                    if (err) {
                                        let res_json = { status: "FAILED", };
                                        res_json.message = "Fetching Sub-Account Details";
                                        res.send({ res_json });
                                    } else {
                                        if (sub_accs.length > 0) {
                                            if (sub_accs[0].linked_from != user_email) {
                                                let res_json = { status: "FAILED", };
                                                res_json.message = "Only the Owner can delete this Sub-Account";
                                                res.send({ res_json });
                                            } else {
                                                username = sub_accs[0].user_firstname + " " + sub_acc[0].user_surname;
                                                thisDb.collection("users").deleteOne(query, function (err, item) {
                                                    if (err) {
                                                        console.log(err)
                                                        let res_json = { status: "FAILED", };
                                                        res_json.message = "Deleting Sub-Account: " + sub_acc;
                                                        res.send({ res_json });
                                                    } else {
                                                        let res_json = { status: "OK", }
                                                        res_json.message = "Sub-Account Deleted: " + sub_acc;
                                                        res.res_json = res_json;
                                                        res.send({ res_json });

                                                        // send email to Sub-Account
                                                        message = "Your account has been deleted.";
                                                        templatemodel = { "username": username, "subject": "Account Deleted", "account_number": sub_acc, "important_00": "Account Deleted", "info": [{ "infol": message }] };
                                                        client = new postmark.ServerClient(serverToken);

                                                        client.sendEmailWithTemplate({
                                                            "From": "admin@grass.app",
                                                            "To": sub_acc,
                                                            "TemplateAlias": "Default",
                                                            "TrackOpens": true,
                                                            "TemplateModel": templatemodel
                                                        }).then(resp => { });

                                                        // send email to Owner
                                                        message = "A Sub-account you created , has been deleted. Details above.";
                                                        templatemodel = { "username": username, "subject": "Sub-Account Deleted", "account_number": sub_acc, "important_00": "Sub-Account Deleted", "info": [{ "infol": message }] };
                                                        serverToken = "d42a8a18-8d6f-45d2-9d3e-c84488456ca4";
                                                        client = new postmark.ServerClient(serverToken);

                                                        client.sendEmailWithTemplate({
                                                            "From": "admin@grass.app",
                                                            "To": user_email,
                                                            "TemplateAlias": "Default",
                                                            "TrackOpens": true,
                                                            "TemplateModel": templatemodel
                                                        }).then(resp => { });

                                                        // update log
                                                        message = "Sub-account deleted. " + username;
                                                        let query = {
                                                            user_email: user_email,
                                                            owner: "",
                                                            venue: "",
                                                            venue_name: "",
                                                            course: "",
                                                            course_name: "",
                                                            message: message,
                                                            created: new Date(Date.now()),
                                                            unix_timestamp: Date.now()
                                                        };
                                                        thisDb.collection("logs").insertOne(query, function (err, result) { });
                                                    }
                                                });
                                            }
                                        } else {
                                            let res_json = { status: "FAILED", };
                                            res_json.message = "Sub-Account Details Missing";
                                            res.send({ res_json });
                                        }
                                    }
                                });
                            } else {
                                // delete owner account
                                query = { user_email: user_email };
                                thisDb.collection("users").deleteOne(query, function (err, item) {
                                    if (err) {
                                        console.log(err)
                                        let res_json = { status: "FAILED", };
                                        res_json.message = "Deleting Account: " + user_email;
                                        res.send({ res_json });
                                    } else {
                                        let res_json = { status: "OK", }
                                        res_json.message = "Account Deleted: " + user_email;
                                        res.res_json = res_json;
                                        res.send({ res_json });

                                        message = "Your Account has been deleted , with any Sub-accounts , Venues or Courses you may of created.";
                                        templatemodel = { "username": ownername, "subject": "Account Deleted", "account_number": user_email, "important_00": "Account Deleted", "info": [{ "infol": message }] };
                                        client = new postmark.ServerClient(serverToken);

                                        client.sendEmailWithTemplate({
                                            "From": "admin@grass.app",
                                            "To": user_email,
                                            "TemplateAlias": "Default",
                                            "TrackOpens": true,
                                            "TemplateModel": templatemodel
                                        }).then(resp => { });

                                        // Delete linked sub-accounts
                                        query = { linked_from: user_email };
                                        thisDb.collection("users").deleteMany(query, function (err, item) {
                                            if (err) {
                                                console.log("Delete Linked/Delete Account Error")
                                                console.log(err)
                                            } else { }
                                        });
                                        // Delete Venues
                                        query = { owner: user_email };
                                        thisDb.collection("venues").deleteMany(query, function (err, item) {
                                            if (err) {
                                                console.log("Delete Venue/Delete Account Error")
                                                console.log(err)
                                            } else { }
                                        });
                                        // Delete Courses
                                        query = { owner: user_email };
                                        thisDb.collection("courses").deleteMany(query, function (err, item) {
                                            if (err) {
                                                console.log("Delete Courses/Delete Account Error")
                                                console.log(err)
                                            } else { }
                                        });
                                        query = { user_email: user_email };
                                        thisDb.collection("logs").deleteMany(query, function (err, item) {
                                            if (err) {
                                                console.log("Delete Account Log")
                                                console.log(err)
                                            } else { }
                                        });
                                        query = { owner: user_email };
                                        thisDb.collection("logs").deleteMany(query, function (err, item) {
                                            if (err) {
                                                console.log("Delete Sub-Account Log")
                                                console.log(err)
                                            } else { }
                                        });
                                    }
                                });
                            }
                        } else {
                            let res_json = { status: "FAILED", };
                            res_json.message = "Invalid Token Sent. Another Device has Logged on.";
                            res.send({ res_json })
                        }
                    } else {
                        let res_json = { status: "FAILED", };
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
        res_json.message = "Error in Checking Email.";
        // res_json.data = e;
        res.res_json = res_json;
        res.status(400).send({ message: "Error in Checking Email.", data: e });
    }

    function validateEmail(email) {
        var re = /\S+@\S+\.\S+/;
        return re.test(email);
    }
});

router.post("/logon", async (req, res) => {
    try {
        const { user_email, token } = req.body;

        db = req.db;

        var errMess = "";
        if (user_email === null || user_email === "") {
            errMess = "Email Address Missing";
        }

        if (errMess == "") {
            if (!validateEmail(user_email)) {
                errMess = "Invalid Email Address Sent";
            }
        }

        var user_token = token;
        if (user_token == null) {
            user_token = "";
        }

        if (user_token == "") {
            errMess += " Token Missing";
        }

        if (errMess !== "") {
            let res_json = {
                status: "FAILED",
            }
            res_json.message = errMess;
            res.send({ res_json });
        }
        else {
            // const token = await generateApiKey({
            //     method: 'uuidv4',
            // });
            let query = { user_email: user_email };
            const thisDb = db.db("grass")
            thisDb.collection("users").find(query).toArray(function (err, item) {
                if (err) {
                    console.log(err)
                    let res_json = { status: "FAILED", };
                    res_json.message = "Fetching Logon Details";
                    res.send({ res_json });
                } else {
                    // zero index of item 'item[0]' below is because we are using 'toArray' function 
                    // and only need to send data from the object at the first index (since there is no other items in this array!)
                    if (item.length > 0) {
                        if (item[0].token == user_token) {
                            let res_json = { status: "OK", }
                            res_json.message = "Account Found.";
                            res_json.user_email = user_email;
                            res_json.token = user_token;
                            res_json.data = item;
                            res.res_json = res_json;
                            res.send({ res_json });
                        } else {
                            let newvalues = {
                                $set: {
                                    reg_token: user_token,
                                    updated: new Date(Date.now()),
                                    unix_timestamp: Date.now()
                                }
                            };
                            thisDb.collection("users").updateOne(query, newvalues, function (err, result) {
                                if (err) { } else { }
                            });
                            var username = item[0].user_firstname + " " + item[0].user_surname;
                            var userurl = user_token + "~L~";
                            var templatemodel = { "user_email": userurl, "booking": "Verify Account", "username": username, "subject": "Verify Account" };
                            var serverToken = "d42a8a18-8d6f-45d2-9d3e-c84488456ca4";
                            var client = new postmark.ServerClient(serverToken);

                            client.sendEmailWithTemplate({
                                "From": "admin@grass.app",
                                "To": user_email,
                                "TemplateAlias": "VerifyAccount",
                                "TrackOpens": true,
                                "TemplateModel": templatemodel
                            }).then(resp => { });
                            let res_json = { status: "WARNING", }
                            res_json.message = "Verified Reset. Verify Email Sent.";
                            res_json.user_email = user_email;
                            res_json.token = user_token;
                            res_json.old_token = item[0].token;
                            res_json.data = item;
                            res.res_json = res_json;
                            res.send({ res_json });
                        }
                    } else {
                        let res_json = { status: "FAILED", };
                        res_json.message = "Account Not Found. Please Register.";
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
        res_json.message = "Error in Checking Email.";
        // res_json.data = e;
        res.res_json = res_json;
        res.status(400).send({ message: "Error in Checking Email.", data: e });
    }

    function validateEmail(email) {
        var re = /\S+@\S+\.\S+/;
        return re.test(email);
    }
});

router.post("/logout", async (req, res) => {
    try {
        const { user_email, token } = req.body;

        db = req.db;
        const thisDb = db.db("grass")

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
        }
        else {
            let query = { user_email: user_email };
            thisDb.collection("users").find(query).toArray(function (err, item) {
                if (err) {
                    console.log(err)
                    let res_json = { status: "FAILED", };
                    res_json.message = "Fetching Account Details";
                    res.send({ res_json });
                } else {
                    if (item.length > 0) {
                        if (item[0].token == token) {
                            let newvalues = {
                                $set: {
                                    verified: "N",
                                    // token: "",
                                    updated: new Date(Date.now()),
                                    unix_timestamp: Date.now()
                                }
                            };
                            thisDb.collection("users").updateOne(query, newvalues, function (err, result) { });
                            item[0].verified = "N";
                            // item[0].token = "";
                            let res_json = { status: "WARNING", }
                            res_json.message = "Verified Reset. Logged Out.";
                            res_json.user_email = user_email;
                            res_json.data = item;
                            res.res_json = res_json;
                            res.send({ res_json });
                        } else {
                            let res_json = { status: "FAILED", };
                            res_json.message = "Invalid Token Sent. Another Device has Logged on.";
                            res.send({ res_json })
                        }
                    } else {
                        let res_json = { status: "FAILED", };
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
        res_json.message = "Error in Checking Email.";
        // res_json.data = e;
        res.res_json = res_json;
        res.status(400).send({ message: "Error in Checking Email.", data: e });
    }

    function validateEmail(email) {
        var re = /\S+@\S+\.\S+/;
        return re.test(email);
    }
});

router.get('/verify/:useremail', (req, res) => {
    const user_details = req.params.useremail;

    db = req.db;
    const thisDb = db.db("grass")

    user_array = user_details.split("~")
    user_token = user_array[0];
    user_type = user_array[1];
    // type = "Y" = re-verify (from new)
    // type = "N" = Verify  (from new)
    // type = "L" = Logging in

    let query = { reg_token: user_token };
    var returnstr = '';

    thisDb.collection("users").find(query).toArray(function (err, item) {
        if (err) {
            console.log(err)
            res.send(missingmessage);
            returnstr = { status: "FAILED" }
        } else {
            if (item.length > 0) {
                // if (item[0].token != user_token) {
                //     res.send(tokenmessage);
                //     returnstr = { status: "FAILED" }
                // } else {
                var lg_cnt = parseInt(item[0].logon_count) + 1;
                let newvalues = {
                    $set: {
                        verified: "Y",
                        token: user_token,
                        reg_token: "",
                        updated: new Date(Date.now()),
                        last_logon: new Date(Date.now()),
                        unix_timestamp: Date.now(),
                        logon_count: lg_cnt
                    }
                };
                var user_email = item[0].user_email;
                query = { user_email: user_email };
                thisDb.collection("users").updateOne(query, newvalues, function (err, result) {
                    if (err) {
                        res.send(errmessage);
                        returnstr = { status: "FAILED" }
                    } else {
                        res.send(message);
                        returnstr = { status: "OK" }
                    }
                });
                // }
            } else {
                res.send(errmessage);
                returnstr = { status: "FAILED" }
            }
        }
    });
    // socket emit to inform App we have verified the logon
    // const port = process.env.NODE_PORT;

    /*
    var host = 'http://localhost:';
    var url = host.concat(8080);
    var socket = clientSocket.connect(url);
    socket.emit("something", [returnstr, 'verify']);
    socket.on("ok", function (data) { socket.close(); socket.disconnect(true); });
    */
});

router.post("/new", async (req, res) => {
    try {
        const { user_email, user_firstname, user_surname, linked_from, user_token } = req.body;
        response.data = req.body;

        db = req.db;
        const thisDb = db.db("grass")

        var errMess = "";
        if (user_email === null || user_email === "") {
            errMess = "Email Address Missing";
        }
        if (errMess == "") {
            if (!validateEmail(user_email)) {
                errMess = "Invalid Email Address Sent";
            }
        }
        if (user_firstname == null || user_firstname == "") {
            errMess += " Account Firstname Missing";
        }
        if (user_surname == null || user_surname == "") {
            errMess += " Account Surname Missing";
        }
        if (user_token == null || user_token == "") {
            errMess += " Token Missing";
        }

        var linked_email = linked_from;
        if (linked_from == null) {
            linked_email = "";
        }

        var message = "";
        var serverToken = "d42a8a18-8d6f-45d2-9d3e-c84488456ca4";
        var client = new postmark.ServerClient(serverToken);
        var templatemodel = "";
        var username = user_firstname + " " + user_surname;

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
                    res_json.message = "Checking Account Details Exist";
                    res.send({ res_json });
                } else {
                    if (item.length > 0) {
                        let res_json = { status: "FAILED", }
                        res_json.message = "Account Already Exists.";
                        if (linked_email != "") {
                            res_json.message = "Sub-Account Already Exists.";
                        }
                        res_json.user_email = user_email;
                        res_json.token = user_token;
                        res.res_json = res_json;
                        res.send({ res_json });

                        if (linked_email != "") {
                            // trying to add a new Sub-account, send email to owner
                            message = "A Sub-account with this email Already Exists.";
                            templatemodel = { "username": username, "subject": "Sub-Account Exists", "account_number": user_email, "important_00": "Sub-Account Exists", "info": [{ "infol": message }] };

                            client.sendEmailWithTemplate({
                                "From": "admin@grass.app",
                                "To": linked_email,
                                "TemplateAlias": "Default",
                                "TrackOpens": true,
                                "TemplateModel": templatemodel
                            }).then(resp => { });
                        } else {
                            var userurl = user_token + "~Y~";
                            message = "Your email has been used to try to Register a New Account in the App. If this is NOT you , please ignore this Email.";
                            templatemodel = { "user_email": userurl, "booking": "Re-Verify Account", "username": username, "subject": "Re-Verify Account", "info": [{ "infol": message }] };

                            client.sendEmailWithTemplate({
                                "From": "admin@grass.app",
                                "To": user_email,
                                "TemplateAlias": "VerifyAccount",
                                "TrackOpens": true,
                                "TemplateModel": templatemodel
                            }).then(resp => {
                            });
                        }
                    } else {
                        // Create New Account Details
                        let query = {
                            user_email: user_email,
                            user_firstname: user_firstname,
                            user_surname: user_surname,
                            linked_from: linked_email,
                            verified: "N",
                            reg_token: user_token,
                            token: "",
                            created: new Date(Date.now()),
                            updated: new Date(Date.now()),
                            last_logon: "",
                            logon_count: 0,
                            unix_timestamp: Date.now()
                        };
                        thisDb.collection("users").insertOne(query, function (err, result) {
                            if (err) {
                                return res.status(500).json({
                                    status: "FAILED",
                                    message: "Error Creating Account",
                                    error: err
                                });
                            } else {
                                let res_json = {
                                    status: "OK",
                                }
                                res_json.message = "User Created.";
                                res_json.token = user_token;
                                res_json.user_email = user_email;
                                res.res_json = res_json;
                                res.send({ res_json });

                                templatemodel = "";
                                message = "";

                                // Send Emails

                                if (linked_email != "") {
                                    // adding a new Sub-account
                                    message = "A new Sub-account has been created for: " + username;
                                    templatemodel = { "username": username, "subject": "Sub-Account Created", "account_number": user_email, "important_00": "Sub-Account Created", "info": [{ "infol": message }] };

                                    client.sendEmailWithTemplate({
                                        "From": "admin@grass.app",
                                        "To": linked_email,
                                        "TemplateAlias": "Default",
                                        "TrackOpens": true,
                                        "TemplateModel": templatemodel
                                    }).then(resp => { });
                                    let query = {
                                        user_email: linked_email,
                                        owner: "",
                                        venue: "",
                                        venue_name: "",
                                        course: "",
                                        course_name: "",
                                        message: message,
                                        created: new Date(Date.now()),
                                        unix_timestamp: Date.now()
                                    };
                                    thisDb.collection("logs").insertOne(query, function (err, result) { });
                                }
                                var userurl = user_token + "~N~";
                                if (linked_email != "") {
                                    message = linked_email + " has created a new Sub-account for you.";
                                    templatemodel = { "user_email": userurl, "booking": "Verify New Account", "username": username, "subject": "Verify New Account", "info": [{ "infol": message }] };
                                } else {
                                    message = "New Account Setup";
                                    templatemodel = { "user_email": userurl, "booking": "Verify New Account", "username": username, "subject": "Verify New Account" };
                                }

                                client.sendEmailWithTemplate({
                                    "From": "admin@grass.app",
                                    "To": user_email,
                                    "TemplateAlias": "VerifyAccount",
                                    "TrackOpens": true,
                                    "TemplateModel": templatemodel
                                }).then(resp => { });

                                let query = {
                                    user_email: user_email,
                                    owner: linked_email,
                                    venue: "",
                                    venue_name: "",
                                    course: "",
                                    course_name: "",
                                    message: message,
                                    created: new Date(Date.now()),
                                    unix_timestamp: Date.now()
                                };
                                thisDb.collection("logs").insertOne(query, function (err, result) { });
                            }
                        });
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

router.post("/update", async (req, res) => {
    try {
        const { user_email, user_firstname, user_surname, linked_from, token } = req.body;
        response.data = req.body;

        db = req.db;

        var errMess = "";
        if (user_email === null || user_email === "") {
            errMess = "Email Address Missing";
        }
        if (errMess == "") {
            if (!validateEmail(user_email)) {
                errMess = "Invalid Email Address Sent";
            }
        }
        if (user_firstname === null || user_firstname === "") {
            errMess += " User Firstname Missing";
        }
        if (user_surname === null || user_surname === "") {
            errMess += " User Surname Missing";
        }
        var linked_email = linked_from;
        if (linked_from == null) {
            linked_email = "";
        }
        if (token == null || token == "") {
            errMess += " Invalid Token Sent";
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
            // Check if email already exists 
            let query = { user_email: user_email };
            const thisDb = db.db("grass")
            thisDb.collection("users").find(query).toArray(function (err, item) {
                if (err) {
                    console.log(err)
                    let res_json = { status: "FAILED", };
                    res_json.message = "An error Checking Email Details Exist";
                    res.send({ res_json });
                } else {
                    // zero index of item 'item[0]' below is because we are using 'toArray' function 
                    // and only need to send data from the object at the first index (since there is no other items in this array!)
                    if (item.length > 0) {
                        // if (item[0].verified == "Y" && item[0].token == token) {
                        if (item[0].token == token) {
                            let newvalues = {
                                $set: {
                                    user_firstname: user_firstname,
                                    user_surname: user_surname,
                                    updated: new Date(Date.now()),
                                    unix_timestamp: Date.now()
                                }
                            };
                            thisDb.collection("users").updateOne(query, newvalues, function (err, result) {
                                if (err) {
                                    return res.status(500).json({
                                        status: "FAILED",
                                        message: "Error Updating User",
                                        error: err
                                    });
                                } else {
                                    let res_json = {
                                        status: "OK",
                                    }
                                    res_json.message = "User Updated.";
                                    res_json.firstname = user_firstname;
                                    res_json.surname = user_surname;
                                    res.res_json = res_json;
                                    res.send({ res_json });
                                    let query = {
                                        user_email: user_email,
                                        owner: "",
                                        venue: "",
                                        venue_name: "",
                                        course: "",
                                        course_name: "",
                                        message: "Account Updated",
                                        created: new Date(Date.now()),
                                        unix_timestamp: Date.now()
                                    };
                                    thisDb.collection("logs").insertOne(query, function (err, result) { });
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
