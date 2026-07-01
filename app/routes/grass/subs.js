const { response } = require("express");
const express = require("express");
const router = express.Router({ mergeParams: true });
const mongodb = require("mongodb");
let ObjectID = require('mongodb').ObjectID
const axios = require('axios');
const Stripe = require("stripe");
const { getAppConfig } = require("../../config/app_config");
const { sendError } = require("../../util/commonFunctions");

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

                const period = new Date(subscription.ended_at * 1000);
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
        return await sendError(res, 400, {
            thisDb,
            errMess: err.message || "Error in subs wehook.",
            type: "other",
            action: "subs/webhook",
            error: err,
            payload: event,
            functionName: "subs/webhook"
        });
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
            return await sendError(res, 400, {
                thisDb,
                errMess: err.message,
                type: "other",
                action: "subs/webhook",
                error: err,
                payload: plan,
                query: query,
                functionName: "subs/grantAccess"
            });
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
            return await sendError(res, 400, {
                thisDb,
                errMess: err.message,
                type: "other",
                action: "subs/webhook",
                error: err,
                payload: plan,
                query: query,
                functionName: "subs/revokeAccess"
            });
        }
    }

    async function updateCustID(email, cust_id) {
        try {
            table = "users" + suffix;
            email = email.trim().toLowerCase();
            query = { user_email: email };
            const users = thisDb.collection(table);

            const item = await users.find(query).toArray();

            if (item.length === 0) {
                return await sendError(res, 200, {
                    thisDb,
                    errMess: "User not found.",
                    type: "validation",
                    action: "subs/webhook",
                    payload: cust_id,
                    query: email,
                    functionName: "subs/updateCustID"
                });
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
            return await sendError(res, 400, {
                thisDb,
                errMess: err.message,
                type: "other",
                action: "subs/webhook",
                error: err,
                payload: cust_id,
                query: query,
                functionName: "subs/updateCustID"
            });
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
        const email = user_email.trim().toLowerCase();

        if (email === null || email === '') {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Email missing.",
                type: "validation",
                action: "subs/user/active",
                payload: req.query,
                functionName: "subs/user/active"
            });
        }

        if (!validateEmail(email)) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Invalid Email sent.",
                type: "validation",
                action: "subs/user/active",
                payload: req.query,
                functionName: "subs/user/active"
            });
        }

        user_email = email.trim().toLowerCase();
        query = { user_email: email };
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
                return await sendError(res, 200, {
                    thisDb,
                    errMess: "Token sent does not match with user.",
                    type: "validation",
                    action: "subs/user/active",
                    payload: user,
                    functionName: "subs/user/active"
                });
            }
        } else {
            return await sendError(res, 200, {
                thisDb,
                errMess: "User not found",
                type: "validation",
                action: "subs/user/active",
                payload: users,
                user: email,
                functionName: "subs/user/active"
            });
        }
    } catch (err) {
        return await sendError(res, 400, {
            thisDb,
            errMess: err.message,
            type: "other",
            action: "subs/webhook",
            error: err,
            payload: req.query,
            functionName: "subs/user/active"
        });
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
        return await sendError(res, 400, {
            thisDb,
            errMess: err.message,
            type: "other",
            action: "subs/search",
            error: err,
            payload: cust_id,
            query: query,
            functionName: "subs/search"
        });
    }
});

module.exports = router;