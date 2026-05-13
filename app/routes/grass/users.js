'use strict';

const { response } = require("express");
const express = require("express");
const router = express.Router({ mergeParams: true });
const mongodb = require("mongodb");
const postmark = require("postmark");
const axios = require('axios');
const { generateApiKey } = require('generate-api-key');
const clientSocket = require('socket.io-client');
let ObjectID = require('mongodb').ObjectID;
const { getAppConfig } = require("../../config/app_config");
const { logError } = require("../../logs/errorLogger");

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
    '</html>' +
'';

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
    '</html>' +
'';

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
    '</html>' +
'';

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
    '</html>' +
'';

router.post('/check', async (req, res) => {
    try {
        const db = req.db;
        const thisDb = db.db("grass");
        const appConfig = getAppConfig();
        const suffix = app_config.suffix;

        let table;
        let query;
        
        const { user_email, token } = req.body;

        let errMess = '';
        let owner = '';

        if (user_email === null || user_email === '') {
            errMess = 'Email Missing';
        }

        if (errMess == '') {
            if (!validateEmail(user_email)) {
                errMess = 'Invalid Email Sent';
            }
        }

        if (errMess !== '') {
            await logError({
                thisDb,
                type: "validation",
                action: "users/check",
                error: errMess,
                payload: req.body,
            });
            let res_json = {status: 'FAILED'};

            res_json.message = errMess;

            res.send({ res_json });
        }
        else {
            query = { user_email: user_email };
            table = "users" + suffix;

            // get Account details to check if Owner or Sub Account
            const account = await thisDb.collection(table).find(query).toArray();
            if (account.length > 0) {
                if (account[0].token == token) {
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
                        const subs = await thisDb.collection(table).find(query).toArray();
                        if (subs.length > 0) {
                            account[0].sub_accounts = subs;
                        }
                    }
                    let res_json = {status: "VERIFIED"};

                    res_json.message = "Account Found";
                    res_json.user_email = user_email;
                    res_json.data = account[0];
                    res.res_json = res_json;

                    res.send({ res_json });

                } else {
                    let res_json = {status: "CHECKED"};
                    res_json.message = "Invalid Token Sent";
                    res_json.user_email = user_email;
                    res_json.data = account[0];
                    res.res_json = res_json;

                    await logError({
                        thisDb,
                        type: "validation",
                        action: "users/check",
                        error: res_json.message,
                        payload: req.body,
                        user: user_email,
                        table: table,
                    });

                    res.send({ res_json });
                }
            } else {
                let res_json = {status: "ERROR"};
                res_json.message = "Account Not Found";

                await logError({
                    thisDb,
                    type: "validation",
                    action: "users/check",
                    error: res_json.message,
                    payload: req.body,
                    user: user_email,
                    table: table,
                });

                res.send({ res_json });
            }
        }
    }
    catch (e) {
        await logError({
            thisDb,
            type: "other",
            action: "users/delete",
            error: e,
            payload: req.body,
            query,
            table,
            user: user_email,
        });

        let res_json = {status: "FAILED"};

        res_json.message = "Error in Checking Email.";
        // res_json.data = e;
        res.res_json = res_json;

        res.status(400).send({ message: "Error in Checking Email.", data: e });
    }

    function validateEmail(email) {
        const re = /\S+@\S+\.\S+/;

        return re.test(email);
    }
});

router.post("/delete", async (req, res) => {
    try {
        const db = req.db;
        const thisDb = db.db("grass");
        const appConfig = getAppConfig();
        const suffix = app_config.suffix;

        let table;
        let query;
        
        const { user_email, token, sub_account } = req.body;

        let errMess = "";
        let ownername = "";
        let username = "";
        let message = "";
        let templatemodel = "";
        let client = "";
        // let serverToken = "d42a8a18-8d6f-45d2-9d3e-c84488456ca4";
        let serverToken = process.env.POSTMARK;

        if (user_email === null || user_email === "") {
            errMess = "Email Address Missing";
        }

        if (token === null || token === "") {
            errMess = "Token Missing";
        }

        let sub_acc = sub_account;

        if (sub_account == null || sub_account == "undefined") {
            sub_acc = "";
        }

        if (errMess == "") {
            if (!validateEmail(user_email)) {
                errMess = "Invalid Email Address Sent";
            }
        }

        if (errMess !== "") {
            await logError({
                thisDb,
                type: "validation",
                action: "users/delete",
                error: errMess,
                payload: req.body,
            });
            let res_json = {status: "FAILED"};

            res_json.message = errMess;

            res.send({ res_json });
        } else {
            let superToken = false;

            if (token == process.env.TOKEN)
                superToken = true;

            query = { user_email: user_email };
            table = "users" + suffix;

            const item = await thisDb.collection(table).find(query).toArray();
            if (item.length > 0) {
                if (item[0].token == token || superToken) {
                    ownername = item[0].user_firstname + " " + item[0].user_surname;
                    // have we been sent a Sub-account to delete
                    if (sub_acc != "") {
                        // get sub-account
                        query = { user_email: sub_acc };
                        const sub_accs = await thisDb.collection(table).find(query).toArray();
                        if (sub_accs.length > 0) {
                            if (sub_accs[0].linked_from != user_email) {
                                let res_json = {status: "FAILED"};
                                res_json.message = "Only the Owner can delete this Sub-Account";

                                await logError({
                                    thisDb,
                                    type: "validation",
                                    action: "users/delete",
                                    error: res_json.message,
                                    payload: req.body,
                                    query,
                                    table,
                                    user: user_email,
                                });

                                res.send({ res_json });
                            } else {
                                username = sub_accs[0].user_firstname + " " + sub_acc[0].user_surname;
                                const del = await thisDb.collection(table).deleteOne(query);
                                let res_json = {status: "OK"};

                                res_json.message = "Sub-Account Deleted: " + sub_acc;
                                res.res_json = res_json;

                                res.send({ res_json });

                                if (!superToken) {
                                    // send email to Sub-Account
                                    message = "Your account has been deleted.";
                                    templatemodel = { "username": username, "subject": "Account Deleted", "account_number": sub_acc, "important_00": "Account Deleted", "info": [{ "infol": message }] };
                                    client = new postmark.ServerClient(serverToken);

                                    client.sendEmailWithTemplate({
                                        "From": "admin@thegrass.app",
                                        "To": sub_acc,
                                        "TemplateAlias": "Default",
                                        "TrackOpens": true,
                                        "TemplateModel": templatemodel
                                    });

                                    // send email to Owner
                                    message = "A Sub-account you created , has been deleted. Details above.";
                                    templatemodel = { "username": username, "subject": "Sub-Account Deleted", "account_number": sub_acc, "important_00": "Sub-Account Deleted", "info": [{ "infol": message }] };
                                    serverToken = process.env.POSTMARK;
                                    client = new postmark.ServerClient(serverToken);

                                    client.sendEmailWithTemplate({
                                        "From": "admin@thegrass.app",
                                        "To": user_email,
                                        "TemplateAlias": "Default",
                                        "TrackOpens": true,
                                        "TemplateModel": templatemodel
                                    });
                                }

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
                                    unix_timestamp: Date.now(),
                                };

                                thisDb.collection("logs").insertOne(query, function (err, result) { });
                            }
                        } else {
                            let res_json = {status: "FAILED"};

                            res_json.message = "Sub-Account Details Missing";

                            res.send({ res_json });
                        }
                    } else {
                        // delete owner account
                        query = { user_email: user_email };
                        thisDb.collection(table).deleteOne(query, function (err, item) {
                            if (err) {
                                console.log(err);

                                let res_json = {status: "FAILED"};

                                res_json.message = "Deleting Account: " + user_email;

                                res.send({ res_json });
                            }
                            else {
                                let res_json = {status: "OK"};

                                res_json.message = "Account Deleted: " + user_email;
                                res.res_json = res_json;

                                res.send({ res_json });

                                if (!superToken) {
                                    message = "Your Account has been deleted , with any Sub-accounts , Venues or Courses you may of created.";
                                    templatemodel = { "username": ownername, "subject": "Account Deleted", "account_number": user_email, "important_00": "Account Deleted", "info": [{ "infol": message }] };
                                    client = new postmark.ServerClient(serverToken);

                                    client.sendEmailWithTemplate({
                                        "From": "admin@thegrass.app",
                                        "To": user_email,
                                        "TemplateAlias": "Default",
                                        "TrackOpens": true,
                                        "TemplateModel": templatemodel,
                                    });
                                }

                                // Delete linked sub-accounts
                                query = { linked_from: user_email };
                                thisDb.collection(table).deleteMany(query, function (err, item) {
                                    if (err) {
                                        console.log("Delete Linked/Delete Account Error");
                                        console.log(err);
                                    }
                                });

                                query = { user_email: user_email };
                                thisDb.collection("logs").deleteMany(query, function (err, item) {
                                    if (err) {
                                        console.log("Delete Account Log");
                                        console.log(err);
                                    }
                                });

                                query = { owner: user_email };
                                thisDb.collection("logs").deleteMany(query, function (err, item) {
                                    if (err) {
                                        console.log("Delete Sub-Account Log");
                                        console.log(err);
                                    }
                                });
                            }
                        });
                    }
                } else {
                    let res_json = {status: "FAILED"};
                    res_json.message = "Invalid Token Sent. Another Device has Logged on.";
                    await logError({
                        thisDb,
                        type: "validation",
                        action: "users/delete",
                        error: res_json.message,
                        payload: req.body,
                        query,
                        table,
                        user: user_email,
                    });

                    res.send({ res_json });
                }
            } else {
                let res_json = {status: "FAILED"};
                res_json.message = "Account Not Found";

                await logError({
                    thisDb,
                    type: "validation",
                    action: "users/delete",
                    error: res_json.message,
                    payload: req.body,
                    query,
                    table,
                    user: user_email,
                });

                res.send({ res_json });
            }
        }
    }
    catch (e) {
        await logError({
            thisDb,
            type: "other",
            action: "users/delete",
            error: e,
            payload: req.body,
            query,
            table,
            user: user_email,
        });

        let res_json = {status: "FAILED"};

        res_json.message = "Error in Checking Email.";
        res.res_json = res_json;

        res.status(400).send({ message: "Error in Checking Email.", data: e });
    }

    function validateEmail(email) {
        const re = /\S+@\S+\.\S+/;

        return re.test(email);
    }
});

router.post("/logon", async (req, res) => {
    try {
        const db = req.db;
        const thisDb = db.db("grass")
        const appConfig = getAppConfig();
        const suffix = app_config.suffix;

        let table;
        let query;

        const { user_email, token } = req.body;

        let errMess = "";

        if (user_email === null || user_email === "") {
            errMess = "Email Address Missing";
        }

        if (errMess == "") {
            if (!validateEmail(user_email)) {
                errMess = "Invalid Email Address Sent";
            }
        }

        let user_token = token;

        if (user_token == null) {
            user_token = "";
        }

        if (user_token == "") {
            errMess += " Token Missing";
        }

        if (errMess !== "") {
            await logError({
                thisDb,
                type: "validation",
                action: "users/logon",
                error: errMess,
                payload: req.body,
            });
            let res_json = {status: "FAILED"};

            res_json.message = errMess;

            res.send({ res_json });
        } else {
            // const token = await generateApiKey({
            //     method: 'uuidv4',
            // });
            query = { user_email: user_email };
            table = "users" + suffix;
            const item = await thisDb.collection(table).find(query).toArray();
            // zero index of item 'item[0]' below is because we are using 'toArray' function
            // and only need to send data from the object at the first index (since there is no other items in this array!)
            if (item.length > 0) {
                if (item[0].token == user_token) {
                    let res_json = {status: "OK"};

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
                            unix_timestamp: Date.now(),
                        },
                    };

                    const result = await thisDb.collection(table).updateOne(query, newvalues);

                    const username = item[0].user_firstname + " " + item[0].user_surname;
                    const userurl = user_token + "~L~";
                    const templatemodel = { "user_email": userurl, "booking": "Verify Account", "username": username, "subject": "Verify Account" };
                    const serverToken = process.env.POSTMARK;
                    const client = new postmark.ServerClient(serverToken);

                    client.sendEmailWithTemplate({
                        "From": "admin@thegrass.app",
                        "To": user_email,
                        "TemplateAlias": "VerifyAccount",
                        "TrackOpens": true,
                        "TemplateModel": templatemodel
                    }).then(resp => { });

                    let res_json = {status: "WARNING"};

                    res_json.message = "Verified Reset. Verify Email Sent.";
                    res_json.user_email = user_email;
                    res_json.token = user_token;
                    res_json.old_token = item[0].token;
                    res_json.data = item;

                    res.res_json = res_json;
                    res.send({ res_json });
                }
            } else {
                let res_json = {status: "FAILED"};
                res_json.message = "Account Not Found. Please Register.";

                await logError({
                    thisDb,
                    type: "validation",
                    action: "users/logon",
                    error: res_json.message,
                    payload: req.body,
                    query,
                    table,
                    user: user_email,
                });

                res.send({ res_json });
            }
        }
    } catch (e) {
        await logError({
            thisDb,
            type: "other",
            action: "users/logon",
            error: e,
            payload: req.body,
            query,
            table,
            user: user_email,
        });

        let res_json = {status: "FAILED"};

        res_json.message = "Error in Checking Email.";

        res.res_json = res_json;
        res.status(400).send({ message: "Error in Checking Email.", data: e });
    }

    function validateEmail(email) {
        const re = /\S+@\S+\.\S+/;

        return re.test(email);
    }
});

router.post("/logout", async (req, res) => {
    try {
        const db = req.db;
        const thisDb = db.db("grass");
        const appConfig = getAppConfig();
        const suffix = app_config.suffix;

        let table;
        let query;

        const { user_email, token } = req.body;

        let errMess = "";

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
            await logError({
                thisDb,
                type: "validation",
                action: "users/logout",
                error: errMess,
                payload: req.body,
            });
            let res_json = {status: "FAILED"};

            res_json.message = errMess;

            res.send({ res_json });
        }
        else {
            query = { user_email: user_email };

            table = "users" + suffix;
            const item = await thisDb.collection(table).find(query).toArray();
            if (item.length > 0) {
                if (item[0].token == token) {
                    let newvalues = {
                        $set: {
                            verified: "N",
                            // token: "",
                            updated: new Date(Date.now()),
                            unix_timestamp: Date.now()
                        },
                    };
                    const result = await thisDb.collection(table).updateOne(query, newvalues);

                    item[0].verified = "N";
                    // item[0].token = "";

                    let res_json = {status: "WARNING"};

                    res_json.message = "Verified Reset. Logged Out.";
                    res_json.user_email = user_email;
                    res_json.data = item;

                    res.res_json = res_json;
                    res.send({ res_json });
                }
                else {
                    await logError({
                        thisDb,
                        type: "validation",
                        action: "users/logout",
                        error: "Invalid Token Sent. Another Device has Logged on.",
                        payload: req.body,
                        query,
                        table,
                        user: user_email,
                    });
                    let res_json = {status: "FAILED"};

                    res_json.message = "Invalid Token Sent. Another Device has Logged on.";

                    res.send({ res_json })
                }
            }
            else {
                await logError({
                    thisDb,
                    type: "validation",
                    action: "users/logout",
                    error: "Account Not Found",
                    payload: req.body,
                    query,
                    table,
                    user: user_email,
                });

                let res_json = {status: "FAILED"};

                res_json.message = "Account Not Found";

                res.send({ res_json })
            }
        }
    }
    catch (e) {
        await logError({
            thisDb,
            type: "other",
            action: "users/logout",
            error: e,
            payload: req.body,
            query,
            table,
            user: user_email,
        });

        let res_json = {status: "FAILED"};

        res_json.message = "Error in Checking Email.";
        // res_json.data = e;

        res.res_json = res_json;
        res.status(400).send({ message: "Error in Checking Email.", data: e });
    }

    function validateEmail(email) {
        const re = /\S+@\S+\.\S+/;

        return re.test(email);
    }
});

router.get('/verify/:useremail', async (req, res) => {
    try {
        const db = req.db;
        const thisDb = db.db("grass");
        const appConfig = getAppConfig();
        const suffix = app_config.suffix;

        let table;
        let query;

        const user_details = req.params.useremail;

        const user_array = user_details.split("~")
        const user_token = user_array[0];
        const user_type = user_array[1];
        // type = "Y" = re-verify (from new)
        // type = "N" = Verify  (from new)
        // type = "L" = Logging in

        query = { reg_token: user_token };
        table = "users" + suffix;
        let returnstr = '';

        const item = await thisDb.collection(table).find(query).toArray();
        if (item.length > 0) {
            // if (item[0].token != user_token) {
            //     res.send(tokenmessage);
            //     returnstr = { status: "FAILED" }
            // } else {
            const lg_cnt = parseInt(item[0].logon_count) + 1;

            let newvalues = {
                $set: {
                    verified: "Y",
                    token: user_token,
                    reg_token: "",
                    updated: new Date(Date.now()),
                    last_logon: new Date(Date.now()),
                    unix_timestamp: Date.now(),
                    logon_count: lg_cnt,
                },
            };

            const user_email = item[0].user_email;

            query = { user_email: user_email };
            const result = await thisDb.collection(table).updateOne(query, newvalues);
            res.send(message);
            returnstr = { status: "OK" }
        } else {
            await logError({
                thisDb,
                type: "validation",
                action: "users/verify",
                error: "Not found",
                payload: req.body,
                query,
                table,
                user: user_email,
            });
            res.send(errmessage);
            returnstr = { status: "FAILED" };
        }
    } catch(e) {
        await logError({
            thisDb,
            type: "other",
            action: "users/verify",
            error: e,
            payload: req.body,
            query,
            table,
            user: user_email,
        });

        let res_json = {status: "FAILED"};

        res_json.message = "Error in Fetching data.";

        res.res_json = res_json;
        res.status(400).send({ message: "Error in Fetching data.", data: e });
    }
});

router.post("/new", async (req, res) => {
    try {
        const db = req.db;
        const thisDb = db.db("grass");
        const appConfig = getAppConfig();
        const suffix = app_config.suffix;

        let table;
        let query;

        const { user_email, user_firstname, user_surname, linked_from, user_token } = req.body;

        response.data = req.body;

        let errMess = "";

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

        const serverToken = process.env.POSTMARK;
        const client = new postmark.ServerClient(serverToken);
        const username = user_firstname + " " + user_surname;

        let message = "";
        let templatemodel = "";

        if (errMess !== "") {
            await logError({
                thisDb,
                type: "validation",
                action: "users/new",
                error: errMess,
                payload: req.body,
            });
            let res_json = {status: "FAILED"};

            res_json.message = errMess;

            res.res_json = res_json;
            res.send({ res_json });
        }
        else {
            // Check if email already exists
            query = { user_email: user_email };
            table = "users" + suffix;
            const item = await thisDb.collection(table).find(query).toArray();
            if (item.length > 0) {
                let res_json = {status: "FAILED"};

                res_json.message = "Account Already Exists.";

                if (linked_email != "") {
                    res_json.message = "Sub-Account Already Exists.";
                }

                res_json.user_email = user_email;
                res_json.token = user_token;

                res.res_json = res_json;
                res.send({ res_json });

                await logError({
                    thisDb,
                    type: "validation",
                    action: "users/new",
                    error: res_json.message,
                    payload: req.body,
                    query,
                    table: table,
                });

                if (linked_email != "") {
                    // trying to add a new Sub-account, send email to owner
                    message = "A Sub-account with this email Already Exists.";
                    templatemodel = { "username": username, "subject": "Sub-Account Exists", "account_number": user_email, "important_00": "Sub-Account Exists", "info": [{ "infol": message }] };

                    client.sendEmailWithTemplate({
                        "From": "admin@thegrass.app",
                        "To": linked_email,
                        "TemplateAlias": "Default",
                        "TrackOpens": true,
                        "TemplateModel": templatemodel
                    }).then(resp => { });
                } else {
                    const userurl = user_token + "~Y~";

                    message = "Your email has been used to try to Register a New Account in the App. If this is NOT you , please ignore this Email.";
                    templatemodel = { "user_email": userurl, "booking": "Re-Verify Account", "username": username, "subject": "Re-Verify Account", "info": [{ "infol": message }] };

                    client.sendEmailWithTemplate({
                        "From": "admin@thegrass.app",
                        "To": user_email,
                        "TemplateAlias": "VerifyAccount",
                        "TrackOpens": true,
                        "TemplateModel": templatemodel
                    }).then(resp => { });
                }
            } else {
                // Create New Account Details
                query = {
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

                const result = await thisDb.collection(table).insertOne(query)
                let res_json = {status: "OK"};

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
                        "From": "admin@thegrass.app",
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
                    "From": "admin@thegrass.app",
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
        }
    } catch (e) {
        await logError({
            thisDb,
            type: "other",
            action: "users/update",
            error: e,
            payload: req.body,
            query,
            table,
            user: user_email,
        });

        let res_json = {status: "FAILED"};

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
        const db = req.db;

        let table;
        let query;

        const appConfig = getAppConfig();
        const suffix = app_config.suffix;
        const thisDb = db.db("grass");

        const {
            user_email,
            user_firstname,
            user_surname,
            user_dob,
            user_residence,
            count_strokes,
            show_vspar,
            handicap_index,
            gender,
            playing_status,
            unit_measure,
            unit_speed,
            unit_temperature,
            linked_from,
            token,
        } = req.body;

        response.data = req.body;

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
            await logError({
                thisDb,
                type: "validation",
                action: "users/update",
                error: errMess,
                payload: req.body,
            });
            let res_json = {status: "FAILED"};

            res_json.message = errMess;

            res.res_json = res_json;
            res.send({ res_json });
        } else {
            var superToken = false;

            if (token == process.env.TOKEN)
                superToken = true;

            // Check if email already exists
            query = { user_email: user_email };
            table = "users" + suffix;

            const item = await thisDb.collection(table).find(query).toArray();
            // zero index of item 'item[0]' below is because we are using 'toArray' function
            // and only need to send data from the object at the first index (since there is no other items in this array!)
            if (item.length > 0) {
                // if (item[0].verified == "Y" && item[0].token == token) {
                if (item[0].token == token || superToken) {
                    let newvalues = {
                        $set: {
                            user_firstname: user_firstname,
                            user_surname: user_surname,
                            user_dob: user_dob,
                            user_residence: user_residence,
                            count_strokes: count_strokes,
                            show_vspar: show_vspar,
                            handicap_index: handicap_index,
                            gender: gender,
                            playing_status: playing_status,
                            unit_measure: unit_measure,
                            unit_speed: unit_speed,
                            unit_temperature: unit_temperature,
                            updated: new Date(Date.now()),
                            unix_timestamp: Date.now()
                        },
                    };

                    const result =thisDb.collection(table).updateOne(query, newvalues);
                    let res_json = {status: "OK"};

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
                } else {
                    await logError({
                        thisDb,
                        type: "validation",
                        action: "users/update",
                        error: "Invalid Token Sent. Another Device has Logged on.",
                        payload: req.body,
                        query,
                        table,
                    });
                    let res_json = {status: "FAILED"};

                    res_json.message = "Invalid Token Sent. Another Device has Logged on.";
                    res_json.user_email = user_email;
                    res.res_json = res_json;

                    res.send({ res_json });
                }
            } else {
                await logError({
                    thisDb,
                    type: "validation",
                    action: "users/update",
                    error: "Email Does Not Exist",
                    payload: req.body,
                    query,
                    table,
                });
                let res_json = {status: "FAILED"};

                res_json.message = "Email Does Not Exist";
                res_json.user_email = user_email;
                res.res_json = res_json;

                res.send({ res_json });
            }
        }
    } catch (e) {
        await logError({
            thisDb,
            type: "other",
            action: "users/update",
            error: e,
            payload: req.body,
            query,
            table,
            user: user_email,
        });

        let res_json = {status: "FAILED"};

        res_json.message = "Error in Fetching data.";
        res.res_json = res_json;

        res.status(400).send({ message: "Error in Fetching data.", data: e });
    }

    function validateEmail(email) {
        const re = /\S+@\S+\.\S+/;

        return re.test(email);
    }
});

router.post("/golfbag", async (req, res) => {
    try {
        const db = req.db;

        let query;
        let table;

        const thisDb = db.db("grass");
        const appConfig = getAppConfig();
        const suffix = app_config.suffix;

        const {
            user_email,
            golf_bag,
            token,
        } = req.body;

        response.data = req.body;

        var errMess = "";

        if (user_email === null || user_email === "") {
            errMess = "Email Address Missing";
        }

        if (!golf_bag) {
            errMess = " Golf Bag data missing";
        }

        if (token == null || token == "") {
            errMess += " Invalid Token Sent";
        }

        if (errMess !== "") {
            await logError({
                thisDb,
                type: "validation",
                action: "users/golbag",
                error: errMess,
                payload: req.body,
            });
            let res_json = {status: "FAILED"};

            res_json.message = errMess;

            res.res_json = res_json;
            res.send({ res_json });
        }
        else {
            var superToken = false;

            if (token == process.env.TOKEN)
                superToken = true;

            // Check if email already exists
            query = { user_email: user_email };
            table = "users" + suffix;

            const item = await thisDb.collection(table).find(query).toArray();

            // zero index of item 'item[0]' below is because we are using 'toArray' function
            // and only need to send data from the object at the first index (since there is no other items in this array!)
            if (item.length > 0) {
                // if (item[0].verified == "Y" && item[0].token == token) {
                if (item[0].token == token || superToken) {
                    let newvalues = {
                        $set: {
                            golf_bag: JSON.parse(golf_bag),
                            updated: new Date(Date.now()),
                            unix_timestamp: Date.now()
                        },
                    };

                    table = "users" + suffix;

                    const result = await thisDb.collection(table).updateOne(query, newvalues);
                    let res_json = {status: "OK"};

                    res_json.message = "Golf Bag Updated.";
                    res_json.golf_bag = golf_bag;
                    res.res_json = res_json;

                    res.send({ res_json });

                    query = {
                        user_email: user_email,
                        owner: "",
                        venue: "",
                        venue_name: "",
                        course: "",
                        course_name: "",
                        message: "Golf Bag Updated",
                        created: new Date(Date.now()),
                        unix_timestamp: Date.now()
                    };

                    table = "logs" + suffix;

                    await thisDb.collection(table).insertOne(query);
                } else { 
                    await logError({
                        thisDb,
                        type: "validation",
                        action: "users/golbag",
                        error: "Invalid Token Sent. Another Device has Logged on.",
                        payload: token,
                        table: table,
                        user: user_email,
                        query,
                    });
                    let res_json = {status: "FAILED"};

                    res_json.message = "Invalid Token Sent. Another Device has Logged on.";
                    res_json.user_email = user_email;
                    res.res_json = res_json;

                    res.send({ res_json });
                }
            }
            else {
                await logError({
                    thisDb,
                    type: "validation",
                    action: "users/golbag",
                    error: "Email Does not Exist",
                    payload: req.body,
                    table: table,
                    user: user_email,
                    query,
                });
                let res_json = {status: "FAILED"};

                res_json.message = "Email Does Not Exist";
                res_json.user_email = user_email;
                res.res_json = res_json;

                res.send({ res_json });
            }
        }
    }
    catch (e) {
        await logError({
            thisDb,
            type: "other",
            action: "users/golfbag",
            error: e,
            query || null,
            payload: req.body,
            table: table
        });

        let res_json = {status: "FAILED"};

        res_json.message = "Error in Fetching data.";
        res.res_json = res_json;

        res.status(400).send({ message: "Error in Fetching data.", data: e });
    }

    function validateEmail(email) {
        const re = /\S+@\S+\.\S+/;

        return re.test(email);
    }
});

router.post("/import", async (req, res) => {
    try {
        const db = req.db;
        const appConfig = getAppConfig();
        const suffix = app_config.suffix;
        const thisDb = db.db("grass");
        const data = req.body;

        let table = "";
        let obj_keys = [];
        let token = "";
        
        const user_obj = {};
        const tour_obj = {};

        if (typeof data === "object") {
            obj_keys = Object.keys(data);
        } else {
            await logError({
                thisDb,
                type: "validation",
                action: "users/import",
                error: "Invalid data sent",
                payload: data,
            });
            return res.status(500).send({status: "FAILED", message: "Invalid data sent"});
        }

        for (const key of obj_keys) {
            const value = data[key];
            if (key == "token") {
                token = value;
            } else if (key != "tour") {
                user_obj[key] = typeof value === "string" ? value.replace(/\|'/g, "'") : value;
            } else {
                if (typeof value === "object") {
                    const tour_data = value;
                    const tour_keys = Object.keys(tour_data);
                    if (tour_keys.length > 0) {
                        for (const tkey of tour_keys) {
                            const tvalue = tour_data[tkey];
                            tour_obj[tkey] = typeof tvalue === "string" ? tvalue.replace(/\|'/g, "'") : tvalue;
                        }
                    }
                }
            }
        }
        
        var errMess = "";

        const user_email = user_obj.user_email;

        if (user_email === null || user_email === "") {
            errMess = "Email Address Missing";
        }

        if (errMess == "") {
            if (!validateEmail(user_email)) {
                errMess = "Invalid Email Address Sent";
            }
        }
/* 
        if (token == null || token == "") {
            errMess += " Invalid Token Sent";
        }
 */
        if (errMess !== "") {
            await logError({
                thisDb,
                type: "validation",
                action: "users/import",
                error: errMess,
                payload: data,
            });
            let res_json = {status: "FAILED"};

            res_json.message = errMess;

            res.res_json = res_json;
            return res.status(203).send({ res_json });
        } else {
            var superToken = true;
            table = "users" + suffix;
            // if (token == process.env.TOKEN)
            //     superToken = true;

            let query = { user_email: user_email };
            const usersDb = thisDb.collection(table);

            let users = await usersDb.find(query).toArray();

            let old_values = {};
            const setFields = {};
            const comparisons = [];
            if (users.length > 0) {
                old_values = users[0];
            }

            for (const [key, value] of Object.entries(user_obj)) {
                if (key !== "user_email") {
                    if (old_values[key] == null) {
                        setFields[key] = value;
                        comparisons.push({
                            $ne: [key, value]
                        });
                    }
                }
            }

            let user_changes = false;
            if (Object.keys(setFields).length === 0) {
                if (tour_obj && typeof tour_obj === "object" && !Array.isArray(tour_obj) && Object.keys(tour_obj).length > 0) {
                    
                } else {
                    return res.status(201).send({status: "OK", message: "Nothing to change"});
                }
            } else {
                let result = await usersDb.updateOne(
                    query,
                    [
                        {
                            $set: {
                                ...setFields, // only set fields sent by form
                                updated: {
                                    $cond: [
                                        { $or: comparisons }, // only update "updated" timestamp if something changed
                                        "$$NOW",
                                        "$updated"
                                    ]
                                },
                                created: {
                                    $ifNull: ["$created", "$$NOW"] // if record does not exist, add field created;
                                },
                                playing_status: {
                                    $ifNull: ["$playing_status", tour_obj?.playing_status ?? "A"]
                                }
                            }
                        }
                    ],
                    { upsert: true }
                );

                if (result.matchedCount === 0 && !result.upsertedId) {
                    // Failed
                    return res.status(500).json({
                        status: "FAILED",
                        message: "No User Document found/inserted",
                    });
                } else {
                    user_changes = (result.modifiedCount > 0 || result.upsertedId);
                }
                // update/insert tour info
                let _id;
                
                if (old_values?._id) {
                    _id = old_values._id;
                } else {
                    if (result.upsertedId) {
                        _id = result.upsertedId;
                    } else {
 // TODO: same email with 2 different memberID, it happens almost at the same time so read the table again to get old_values.
                        users = await usersDb.find(query).toArray();
                        if (users.length > 0) {
                            old_values = users[0];
                        }
                        if (old_values?._id) {
                            _id = old_values._id;
                        } else {
                            _id = user_email;
                        }
                    }
                }

                if (Object.keys(tour_obj).length > 0) {
                    table = "tours" + suffix;
                    const toursDb = thisDb.collection(table);
                    const tour = tour_obj.tour;

                    query = {user_id: _id, tour: tour};

                    // TODO: When already exist, if member changed, save the old value in another field inside the document(may have multiple values)
                    const new_data = [{
                        $set: {
                            ...tour_obj,
                            history: {
                                $cond: [
                                    {
                                        $and: [
                                            { $ne: ["$member", tour_obj.member] },
                                            { $ne: [{ $type: "$member"}, "missing"] }
                                        ]
                                    },
                                    {
                                        $concatArrays: [
                                            { $ifNull: ["$history", []] },
                                            [
                                                {
                                                    member: "$member",
                                                    updated_at: "$updated_at"
                                                }
                                            ]
                                        ]
                                    },
                                    {
                                        $ifNull: ["$history", []]
                                    }
                                ]
                            },
                            updated_at: new Date(),
                            created_at: {
                                $ifNull: ["$created_at", "$$NOW"]
                            }
                        }
                    }];

                    result = await toursDb.updateOne(query, new_data, {upsert: true});

                    if (result.matchedCount === 0 && !result.upsertedId) {
                        return res.status(500).json({
                            status: "FAILED",
                            message: "No Tour Document found/inserted",
                        });
                    } else {
                        const tour_changes = result.modifiedCount > 0 || result.upsertedId;
                        await endImport(old_values, user_obj, thisDb, tour_obj, user_changes, tour_changes, ext);
                    }
                } else {
                    await endImport(old_values, user_obj, thisDb, null, user_changes, false, ext);
                }
            }

        }
    } catch (e) {
        await logError({
            thisDb,
            type: "other",
            action: "users/import",
            error: e,
            query || null,
            payload: data,
            table: table
        });

        let res_json = {status: "FAILED"};

        res_json.message = "Error in Fetching data.";
        res.res_json = res_json;

        res.status(400).send({ message: "Error in Fetching data.", data: e });
    }

    async function endImport(old_user_obj, user_obj, thisDb, tour_added, user_changed, tour_changed, ext) {

        let res_json = {status: "OK"};

        const user_email = old_user_obj?.user_email ?? user_obj?.user_email;

        const _id = old_user_obj?._id ?? await getUserId(user_email, thisDb, "users" + ext);

        if (user_obj?.user_email) {
            delete user_obj.user_email;
        }

        res_json.message = "User Import.";
        res_json.firstname = old_user_obj?.user_firstname ?? user_obj?.user_firstname;
        res_json.surname = old_user_obj?.user_surname ?? user_obj?.user_surname;;
        res.res_json = res_json;

        let query = {};

        const logsDb = thisDb.collection("logs" + ext);

        if (user_changed) {
            const old_values = {};
            if (old_user_obj && typeof old_user_obj === "object" && user_obj && typeof user_obj === "object") {
                const keys = Object.keys(user_obj);

                keys.forEach((key) => {
                    if (old_user_obj[key] != user_obj[key])
                        old_values[key] = old_user_obj[key];
                });
            }
            
            query = {
                user_id: _id,
                user_email: user_email,
                message: "Account Updated",
                channel: "Import",
                old_values: old_values,
                new_values: user_obj,
                created: new Date(Date.now()),
                unix_timestamp: Date.now()
            };

            await logsDb.insertOne(query, function (err, result) { });
        }
        

        if (tour_added && tour_changed) {
            query = {
                user_id: _id,
                user_email: user_email,
                message: "Tour Updated/Inserted",
                channel: "Import",
                new_values: tour_added,
                created: new Date(Date.now()),
                unix_timestamp: Date.now()
            }
            await logsDb.insertOne(query, function (err, result) { });
        }

        res.status(200).send(res_json);
    }

    async function getUserId(user_email, thisDb, table) {
        const usersDb = thisDb.collection(table);

        const query = {user_email: user_email};

        const result = await usersDb.findOne(query);

        return result?._id ?? user_email;
    }

    function validateEmail(email) {
        const re = /\S+@\S+\.\S+/;

        return re.test(email);
    }
});

module.exports = router;