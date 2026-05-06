const { response } = require("express");
const express = require("express");
const router = express.Router({ mergeParams: true });
const mongodb = require("mongodb");
let ObjectID = require('mongodb').ObjectID
const axios = require('axios');
const Stripe = require("stripe");
const { getAppConfig } = require("../../config/stripe_keys");

router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    let event;
    const db = req.db;
    const thisDb = db.db("grass");

    try {
        // event = JSON.parse(req.body.toString('utf8'))
        event = req.body

        switch (event.type) {
            case "invoice.paid": {
                const invoice = event.data.object;
                const lines = invoice.lines;
                const plan = {};
                const line = lines.data.find(
                    (element) => element.parent?.type === "subscription_item_details" || element.type === "subscription"
                );

                if (line) {
                    const appConfig = getAppConfig();
                    const stripe = Stripe(appConfig.stripe.skey);

                    const priceId = line.price?.id || line.pricing?.price_details?.price;
                    const price = await stripe.prices.retrieve(priceId);

                    plan.name = price.metadata.plan;
                    plan.interval = price.recurring.interval;
                    plan.stripe_price_id = priceId;
                    const period = new Date(line.period.end * 1000);
                    plan.period = period;
                    if (line.amount > 0) {
                        const ret_code = await grantAccess(invoice.customer, plan, thisDb);
                        res.sendStatus(ret_code);
                    }
                } else {
                    return res.sendStatus(200);
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

                const ret_code = await revokeAccess(invoice.customer, thisDb);
                res.sendStatus(ret_code);
                break;
            }
            case "checkout.session.completed": {
                const session = event.data.object;
                const userId = session.client_reference_id;
                const stripeCustomerId = session.customer;
                const ret_code = await updateCustID(userId, stripeCustomerId, thisDb);
                res.sendStatus(ret_code);
                break;
            }
            default:
                // Ignore everything else
                return res.sendStatus(200);
                break;
      }
    } catch (err) {
        console.error("Webhook handler failed:", err);
        return res.sendStatus(500);
    }

    async function grantAccess(user, plan, thisDb) {
        // Update/create subscription record.
        try {
            const subscriptions = thisDb.collection("subs");
            let query = { cust_id: user };
            const items = await thisDb.collection("users").find(query).toArray();
            if (items.length > 0) {
                const userId = items[0]["_id"];
                query = {user_id: userId, status: "Active"};
                const activeSubscription = await subscriptions.findOne(query);

                // No active subscription yet: create first one
                if (!activeSubscription) {
                    const result = await subscriptions.insertOne({
                        user_id: userId,
                        plan: plan.stripe_price_id,
                        plan_name: plan.name,
                        plan_type: plan.name == "Pro" ? "P" : "E",
                        status: "Active",
                        started_at: plan.start,
                        end_interval: plan.period,
                        interval: plan.interval,
                        renewed_at: null,
                        ended_at: null,
                        created_at: plan.start,
                        updated_at: plan.start,
                    });

                    return 200;
                } else if (activeSubscription.plan === pan.stripe_price_id) {
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
                        plan_type: plan.name == "Pro" ? "P" : "E",
                        status: "Active",
                        started_at: plan.start,
                        end_interval: plan.period,
                        interval: plan.interval,
                        previous_subscription_id: activeSubscription._id,
                        renewed_at: null,
                        ended_at: null,
                        created_at: plan.start,
                        updated_at: plan.start,
                    });

                    return 200;
                }
            }
        } catch (err) {
            console.log(err);
            return 423;
        }
    }

    async function revokeAccess(user, plan, thisDb) {
        try {
            const subscriptions = thisDb.collection("subs");
            let query = { cust_id: user };
            const items = await thisDb.collection("users").find(query).toArray();
            if (items.length > 0) {
                const userId = items[0]["_id"];
                query = {user_id: userId, status: "Active"};
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

                        const result = await subscriptions.insertOne({
                            user_id: userId,
                            plan: null,
                            plan_name: "Basic",
                            plan_type: "B",
                            status: "Active",
                            started_at: plan.period,
                            end_interval: "not set",
                            interval: "not set",
                            previous_subscription_id: activeSubscription._id,
                            renewed_at: null,
                            ended_at: null,
                            created_at: plan.period,
                            updated_at: plan.period,
                        });
                        return 200;
                    } else {
                        return 200;
                    }
                } else {
                    // create a basic "subscription"
                    const result = await subscriptions.insertOne({
                        user_id: userId,
                        plan: null,
                        plan_name: "Basic",
                        plan_type: "B",
                        status: "Active",
                        started_at: new Date(),
                        end_interval: "not set",
                        interval: "not set",
                        previous_subscription_id: activeSubscription._id,
                        renewed_at: null,
                        ended_at: null,
                        created_at: new Date(),
                        updated_at: new Date(),
                    });
                    return 200;
                }
            }
        } catch (err) {
            console.log(err);
            return 422;
        }
    }

    async function updateCustID(email, cust_id, thisDb) {
        try {
            const users = thisDb.collection("users");

            const item = await users.find({ email }).toArray();

            if (item.length === 0) {
            console.log("User not found");
            return 420;
            }

            const result = await users.updateOne(
            { email },
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
            console.log(err);
            return 501;
        }
    }
});

router.get("/user/active", async (req, res) => {
    try {
        const db = req.db;
        const thisDb = db.db("grass");
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
            let res_json = {status: 'FAILED'};

            res_json.message = errMess;

            res.send({ res_json });
        } else {
            let query = { user_email: user_email };

            // get Account details to check
            const users = await thisDb.collection('users').find(query).toArray();

            if (users.length > 0) {
                const user = users[0];
                if (user.token == token) {
                    query = {user_id: user._id, status: "Active"};
                    const subs = await thisDb.collection("subs").findOne(query);
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

                    res.send({ res_json });
                }
            } else {
                let res_json = {status: "FAILED"};

                res_json.message = "Account Not Found";

                res.send({ res_json });
            }
        }
    } catch (err) {
        console.log(err);

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
    const { plan, status, periodEnd } = req.query;

    try {
        const subscriptions = thisDb.collection("subs");

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
        console.error("Error searching subscriptions:", err);

        return res.status(502).json({
        success: false,
        message: "Error searching subscriptions"
        });
    }
});
module.exports = router;