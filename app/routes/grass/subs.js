const { response } = require("express");
const express = require("express");
const router = express.Router({ mergeParams: true });
const mongodb = require("mongodb");
let ObjectID = require('mongodb').ObjectID
const axios = require('axios');
const Stripe = require("stripe");
const { getAppConfig } = require("../../config/app_config");
const { logError } = require("../../logs/errorLogger");

router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    let event;
    const db = req.db;
    const thisDb = db.db("grass");

    let query;
    let table;
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;

    try {
        event = req.body

        switch (event.type) {
            case "invoice.paid": {
                const invoice = event.data.object;
                const lines = invoice.lines;
                if (lines.total_count > 1) {
                    let count = 1;
                    for (var i = 0; i < lines.total_count; i++) {
                        const line = lines.data[i];
                        const res_ret = await check_line(line, invoice.customer, false, invoice.period_end);
                        if (res_ret !== 200) {
                            return res.sendStatus(res_ret);
                        } else {
                            if (lines.total_count == count) {
                                return res.sendStatus(200);
                            }
                        }
                        count++;
                    }
                } else {
                    const line = lines.data[0];
                    const res_ret = await check_line(line, invoice.customer, true);
                    return res.sendStatus(res_ret);
                }

                break;
            }
            case "invoice.payment_failed": {
                const invoice = event.data.object;
                // should we change subscription to basic?
                return res.sendStatus(200);
                break;
            }

            case "customer.subscription.deleted": {
                const subscription = event.data.object;

                const period = new Date(subscription.lines.data[0].period.end * 1000);
                const plan = {period: period};
                const ret_code = await revokeAccess(invoice.customer, plan, true);
                res.sendStatus(ret_code);
                break;
            }
            case "customer.subscription.paused": {
                const subscription = event.data.object;

                const period = new Date(subscription.lines.data[0].period.end * 1000);
                const plan = {period: period};
                const ret_code = await revokeAccess(invoice.customer, plan, true);
                res.sendStatus(ret_code);
                break;
            }
            case "customer.subscription.resumed": {
                const subscription = event.data.object;

                const ret_code = await grantAccess(invoice.customer);
                res.sendStatus(ret_code);
                break;
            }
            case "customer.subscription.updated": {
                const subscription = event.data.object;

                // const ret_code = await grantAccess(invoice.customer);
                // res.sendStatus(ret_code);
                res.sendStatus(200);
                break;
            }
            case "checkout.session.completed": {
                const session = event.data.object;
                const userId = session.client_reference_id ? session.client_reference_id : session.customer_email;
                const stripeCustomerId = session.customer;
                const ret_code = await updateCustID(userId, stripeCustomerId);
                res.sendStatus(ret_code);
                break;
            }
            default:
                // Ignore everything else
                return res.sendStatus(200);
                break;
      }
    } catch (err) {
        await logError({
            thisDb,
            type: "other",
            action: "subs/webhook",
            error: err,
            query,
            payload: event,
            table: table,
        });
        return res.sendStatus(500);
    }

    async function check_line(line, customer, basic, period_end) { 
        if (line.parent?.type === "subscription_item_details" || line.type === "subscription") {
            const stripe = Stripe(appConfig.stripe.skey);

            const priceId = line.price?.id || line.pricing?.price_details?.price;
            const price = await stripe.prices.retrieve(priceId);
            const plan = {};
            if (price.metadata.app !== "grass") { // not a grass subscription, just making sure that we do not process something that do not belong to grass subscriptions
                return 200;
            } else {
                plan.name = price.metadata.plan;
                plan.interval = price.recurring.interval;
                plan.stripe_price_id = priceId;
                plan.type = price.metadata.type;
                plan.start = new Date(line.period.start * 1000);
                if (line.amount >= 0) {
                    const period = new Date(line.period.end * 1000);
                    plan.period = period;
                    const ret_code = await grantAccess(customer, plan);
                    return 200;
                } else {
                    if (basic && period_end) {
                        const period = new Date(period_end * 1000);
                        plan.period = period;
                    } else {
                        const period = new Date(line.period.end * 1000);
                        plan.period = period;
                    }
                    const ret_code = await revokeAccess(customer, plan, basic);
                    return ret_code;
                }
            }
        } else {
            return 200;
        }
    }

    async function grantAccess(user, plan) {
        // Update/create subscription record.
        try {
            let query = { cust_id: user };
            table = "users" + suffix;
            const items = await thisDb.collection(table).find(query).toArray();
            table = "subs" + suffix;
            const subscriptions = thisDb.collection(table);
            if (items.length > 0) {
                const userId = items[0]["_id"];
                query = {user_id: userId, status: "Active"};
                const activeSubscription = await subscriptions.findOne(query);

                // No active subscription yet: create first one
                const now = new Date();
                if (!activeSubscription) {
                    const result = await subscriptions.insertOne({
                        user_id: userId,
                        plan: plan.stripe_price_id,
                        plan_name: plan.name,
                        plan_type: plan.type,
                        status: "Active",
                        started_at: plan.start,
                        end_interval: plan.period,
                        interval: plan.interval,
                        created_at: now,
                        updated_at: now,
                    });

                    return 200;
                } else if (activeSubscription.plan === plan.stripe_price_id) {
                // Same plan: renewal, update existing active subscription
                    await subscriptions.updateOne(
                        { _id: activeSubscription._id },
                        {
                        $set: {
                            end_interval: plan.period,
                            renewed_at: plan.start
                        },
                        $currentDate: {
                            updated_at: true
                        }
                        }
                    );

                    return 200;
                } else {
                    // Different plan: end old subscription, create new one
                    await subscriptions.updateOne(
                        { _id: activeSubscription._id },
                        {
                            $set: {
                                status: "Ended",
                                ended_at: plan.start
                            },
                            $currentDate: {
                                updated_at: true
                            }
                        }
                    );

                    const result = await subscriptions.insertOne({
                        user_id: userId,
                        plan: plan.stripe_price_id,
                        plan_name: plan.name,
                        plan_type: plan.type,
                        status: "Active",
                        started_at: plan.start,
                        end_interval: plan.period,
                        interval: plan.interval,
                        previous_subscription_id: activeSubscription._id,
                        created_at: now,
                        updated_at: now,
                    });

                    return 200;
                }
            }
        } catch (err) {
            await logError({
                thisDb,
                type: "other",
                action: "subs/grantAccess",
                error: err,
                query,
                payload: plan,
                table: table,
                user: user,
            });
            return 423;
        }
    }

    async function revokeAccess(user, plan, createBasic) {
        try {
            query = { cust_id: user };
            table = "users" + suffix;
            const users = await thisDb.collection(table).find(query).toArray();
            if (users.length > 0) {
                const userId = users[0]["_id"];
                table = "subs" + suffix;
                query = {user_id: userId, status: "Active"};
                const subscriptions = thisDb.collection(table);
                const activeSubscription = await subscriptions.findOne(query);
                if (activeSubscription) {
                    // Reset subscription record to "Basic".
                    if (activeSubscription.plan_name !== "Basic") {
                        await subscriptions.updateOne(
                            { _id: activeSubscription._id },
                            {
                                $set: {
                                    status: "Ended",
                                    ended_at: plan.period
                                },
                                $currentDate: {
                                    updated_at: true
                                }
                            }
                        );

                        if (createBasic) {
                            const newdate = new Date();
                            query = {
                                user_id: userId,
                                plan: null,
                                plan_name: "Basic",
                                plan_type: "B",
                                status: "Active",
                                started_at: plan.period,
                                end_interval: "not set",
                                interval: "not set",
                                previous_subscription_id: activeSubscription._id,
                                created_at: newdate,
                                updated_at: newdate,
                            };
                            await subscriptions.insertOne(query);
                        }

                        return 200;
                    } else {
                        return 200;
                    }
                } else {
                    table = "subs" + suffix;
                    const subscriptions = thisDb.collection(table);
                    // create a basic "subscription"
                    if (createBasic) {
                        const newdate = new Date();
                        query = {
                            user_id: userId,
                            plan: null,
                            plan_name: "Basic",
                            plan_type: "B",
                            status: "Active",
                            started_at: newdate,
                            end_interval: "not set",
                            interval: "not set",
                            previous_subscription_id: activeSubscription._id,
                            created_at: newdate,
                            updated_at: newdate,
                        };
                        const result = await subscriptions.insertOne(query);
                    }
                    return 200;
                }
            }
        } catch (err) {
            await logError({
                thisDb,
                type: "other",
                action: "subs/revokeAccess",
                error: err,
                query,
                payload: plan,
                table: table,
                user: user,
            });
            return 422;
        }
    }

    async function updateCustID(email, cust_id) {
        try {
            table = "users" + suffix;
            query = { user_email: email };
            const users = thisDb.collection(table);

            const item = await users.find(query).toArray();

            if (item.length === 0) {
                await logError({
                    thisDb,
                    type: "validation",
                    action: "subs/updateCustID",
                    error: "User not found",
                    query,
                    payload: cust_id,
                    table: table,
                    user: email,
                });
                return 420;
            }

            const result = await users.updateOne(
                query,
                {
                    $set: {
                        cust_id: cust_id
                    }
                }
            );

            if (result.matchedCount === 0) {
                return 420;
            }

            return 200;

        } catch (err) {
            await logError({
                thisDb,
                type: "other",
                action: "subs/updateCustID",
                error: err,
                query,
                payload: cust_id,
                table: table,
                user: email,
            });
            return 501;
        }
    }
});

router.get("/user/active", async (req, res) => {
    try {
        const db = req.db;
        const thisDb = db.db("grass");
        let query;
        let table;
        const appConfig = getAppConfig();
        const suffix = appConfig.suffix;
        const { user_email, token } = req.query;

        let errMess = '';

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
                action: "subs/user/active",
                error: errMess,
                payload: user_email,
            });
            let res_json = {status: 'FAILED'};

            res_json.message = errMess;

            res.send({ res_json });
        } else {
            query = { user_email: user_email };
            table = "users" + suffix;

            // get Account details to check
            const users = await thisDb.collection(table).find(query).toArray();

            if (users.length > 0) {
                const user = users[0];
                if (user.token == token) {
                    query = {user_id: user._id, status: "Active"};
                    table = "subs" + suffix;
                    const subs = await thisDb.collection(table).findOne(query);
                    if (!subs) {
                        let res_json = {status: "OK"};

                        res_json.plan = "Basic";
                        res_json.type = "B";
                        res.res_json = res_json;

                        res.send({ res_json });
                    } else {
                        let res_json = {status: "OK"};

                        res_json.plan = subs.plan_name;
                        res_json.type = subs.plan_type;
                        res.res_json = res_json;

                        res.send({ res_json });
                    }
                } else {
                    let res_json = {status: "FAILED"};

                    res_json.message = "Invalid Token Sent. Another Device has Logged on.";
                    await logError({
                        thisDb,
                        type: "validation",
                        action: "subs/user/active",
                        error: res_json.message,
                        payload: user,
                        user: user._id,
                        table: table,
                        query
                    });

                    res.send({ res_json });
                }
            } else {
                let res_json = {status: "FAILED"};
                res_json.message = "Account Not Found";

                await logError({
                    thisDb,
                    type: "validation",
                    action: "subs/user/active",
                    error: res_json.message,
                    payload: users,
                    user: user_email,
                    table: table,
                    query
                });

                res.send({ res_json });
            }
        }
    } catch (err) {
        await logError({
            thisDb,
            type: "other",
            action: "subs/updateCustID",
            error: err,
            query,
            payload: cust_id,
            table: table,
            user: email,
        });

        let res_json = {status: "FAILED"};

        res_json.message = "Error in getting Subscription Type.";
        res.res_json = res_json;

        res.status(421).send({ message: "Error in getting Subscription Type.", data: err });
    }

    function validateEmail(email) {
        const re = /\S+@\S+\.\S+/;

        return re.test(email);
    }
});

router.get("/search", async (req, res) => {
    const db = req.db;
    const thisDb = db.db("grass");
    let query = req.query;
    let table;
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;
    const { plan, status, periodEnd } = req.query;

    try {
        table = "subs" + suffix;
        const subscriptions = thisDb.collection(table);

        const match = {};

        if (plan) {
            match.plan = plan;
        }

        if (status) {
            match.status = status; // active, ended, outstanding
        }

        if (periodEnd === "future") {
            match.current_period_end = { $gt: new Date() };
        }

        const results = await subscriptions
            .aggregate([
                { $match: match },

                {
                    $lookup: {
                        from: "users",
                        localField: "user_id",
                        foreignField: "_id",
                        as: "user"
                    }
                },

                {
                $unwind: {
                    path: "$user",
                    preserveNullAndEmptyArrays: true
                }
                },

                {
                    $project: {
                        _id: 1,
                        user_id: 1,
                        plan: 1,
                        status: 1,
                        started_at: 1,
                        renewed_at: 1,
                        ended_at: 1,
                        current_period_start: 1,
                        current_period_end: 1,
                        created_at: 1,
                        updated_at: 1,

                        user: {
                        _id: "$user._id",
                        name: "$user.name",
                        email: "$user.email"
                        }
                    }
                },

                { $sort: { updated_at: -1 } }
            ])
        .toArray();

        return res.status(200).json({
            success: true,
            count: results.length,
            data: results
        });

    } catch (err) {
        await logError({
            thisDb,
            type: "other",
            action: "subs/search",
            error: err,
            query,
            table: table,
        });

        return res.status(502).json({
            success: false,
            message: "Error searching subscriptions"
        });
    }
});
module.exports = router;