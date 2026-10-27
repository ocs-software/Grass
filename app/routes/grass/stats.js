/**
 * Player statistics and golf AI routes.
 *
 * Provides the legacy statistics/reporting endpoints used by Grass together
 * with the production and diagnostic endpoints for the newer golf analytics
 * AI layer. Player identity is resolved and authenticated by this route before
 * any analytics or AI operation is allowed to use that player's data.
 */
const express = require("express");
const router = express.Router({ mergeParams: true });
let ObjectID = require("mongodb").ObjectID;
const { getAppConfig } = require("../../config/app_config");
const { logDocumentChange } = require("../../logs/changeLogger");
const {
    getPlayerReportOnTheFly,
    getPlayerLastNReport
} = require("../../util/rankingRound");
const { sendError } = require("../../util/commonFunctions");
const {
    analyseRound,
    aggregateRounds,
    buildAnalyticsContext,
    getPlayerRounds,
    compareAggregates,
    buildPlayerAnalyticsReport
} = require("../../util/golfAnalytics");

const { executeGolfAITool } = require("../../util/golfAIOpenAITools");

const { askGolfAI } = require("../../util/golfAIClient");

/**
 * Builds an on-demand player statistics report for the requested metric.
 *
 * The caller supplies player-specific criteria and optional peer criteria.
 * Authentication is performed against the token stored on the user document,
 * then rankingRound builds the canonical report from the requested filters.
 */
router.post("/get", async (req, res) => {
    db = req.db;
    const thisDb = db.db("grass");
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;
    const data = req.body;

    try {
        if (!data.user_id) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "User ID not sent.",
                type: "validation",
                action: "stats/get",
                payload: data,
                functionName: "stats/get"
            });
        }

        if (!data.token) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Token not sent.",
                type: "validation",
                action: "stats/get",
                payload: data,
                functionName: "stats/get"
            });
        }

        const user = await thisDb
            .collection("users" + suffix)
            .findOne({ _id: new ObjectID(data.user_id) });

        if (!user) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "User not found.",
                type: "validation",
                action: "stats/get",
                user: data.user_id,
                payload: data
            });
        }

        if (data.token != user.token) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Token sent does not match with user.",
                type: "validation",
                action: "stats/get",
                user: data.user_id,
                payload: data
            });
        }
        const criteria = data.criteria || {};
        const peerCriteria = data.peerCriteria || {};
        const stat = data.fieldSelected || "total_score";

        if (
            !criteria ||
            (typeof criteria !== "object" &&
                Array.isArray(criteria) &&
                Object.keys(criteria).length < 1)
        ) {
            return await sendError(res, 200, {
                thisDb,
                errMess:
                    "No filter sent. This operation can only be done with something to filter for.",
                type: "validation",
                action: "stats/get",
                payload: data,
                functionName: "stats/get"
            });
        }

        const report = await getPlayerReportOnTheFly({
            thisDb,
            suffix,
            userId: data.user_id,
            criteria,
            peerCriteria,
            stat
        });

        logDocumentChange({
            thisDb,
            table: "",
            channel: "stats/get",
            resp: report,
            newData: {},
            my_round: "",
            user_id: data.user_id
        }).catch((err) => {
            console.error("Change log failed:", err);
        });

        res.send(report);
    } catch (e) {
        return await sendError(res, 400, {
            thisDb,
            errMess: e.message || "Error in creating stats report.",
            type: "other",
            action: "stats/get",
            error: e,
            payload: data,
            functionName: "stats/get"
        });
    }
});

/**
 * Returns a Last-N report for one club and statistic.
 *
 * The club code is first checked against the OPTIONS lookup table. Defaults are
 * applied for the statistic, subjective quality threshold and record count when
 * those values are omitted by the caller.
 */
router.post("/average", async (req, res) => {
    db = req.db;
    const thisDb = db.db("grass");
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;
    const data = req.body;

    try {
        const userId = data.user_id;
        const token = data.token;
        const club = data.club_used;
        let stat = data.stat;
        let qos = data.qos;
        let lastRecords = data.lastRecords;

        if (!userId) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "User ID not sent.",
                type: "validation",
                action: "stats/average",
                payload: data,
                functionName: "stats/average"
            });
        }

        if (!token) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Token not sent.",
                type: "validation",
                action: "stats/average",
                payload: data,
                functionName: "stats/average"
            });
        }

        const user = await thisDb
            .collection("users" + suffix)
            .findOne({ _id: new ObjectID(userId) });

        if (!user) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "User not found.",
                type: "validation",
                action: "stats/average",
                user: userId,
                payload: data
            });
        }

        if (token != user.token) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Token sent does not match with user.",
                type: "validation",
                action: "stats/average",
                user: userId,
                payload: data
            });
        }

        if (!club) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Club not sent.",
                type: "validation",
                action: "stats/average",
                payload: data,
                functionName: "stats/average"
            });
        }

        const item = await thisDb
            .collection("table")
            .findOne({ table_id: "OPTIONS" });

        if (!item) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Table OPTIONS not found.",
                type: "validation",
                action: "stats/average",
                user: userId,
                payload: data
            });
        }

        const clubRec = item.as_clubs.find(
            (itemClub) => itemClub.code == club
        )?.code;

        if (clubRec != club) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Club sent not found at table OPTIONS.",
                type: "validation",
                action: "stats/average",
                user: userId,
                payload: data
            });
        }

        if (!stat) {
            stat = "distance";
        }

        if (!qos) {
            qos = 3;
        }

        if (!lastRecords) {
            lastRecords = 10;
        }

        return await getPlayerLastNReport({
            thisDb,
            suffix,
            userId,
            criteria: { club_used: club, qos: qos },
            stat,
            lastRecords
        });
    } catch (e) {
        return await sendError(res, 400, {
            thisDb,
            errMess: e.message || "Error in creating stats report.",
            type: "other",
            action: "stats/average",
            error: e,
            payload: data,
            functionName: "stats/average"
        });
    }
});

/**
 * Production golf-AI endpoint.
 *
 * The route authenticates the player, constructs the deterministic analytics
 * lookup context, and passes only the authenticated server-side player id to
 * the AI client. The model therefore cannot select an arbitrary player through
 * its tool arguments. The public response deliberately excludes provider/model
 * details and internal tool history; the frontend receives only the answer and
 * deterministic visual payloads.
 */
router.post("/ai/golf", async (req, res) => {
    db = req.db;

    const thisDb = db.db("grass");
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;
    const data = req.body;

    try {
        if (!data.user_id) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "User ID not sent.",
                type: "validation",
                action: "stats/ai/golf",
                payload: data,
                functionName: "stats/ai/golf"
            });
        }

        if (!data.token) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Token not sent.",
                type: "validation",
                action: "stats/ai/golf",
                payload: data,
                functionName: "stats/ai/golf"
            });
        }

        if (
            typeof data.question !== "string" ||
            data.question.trim().length === 0
        ) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Question not sent.",
                type: "validation",
                action: "stats/ai/golf",
                payload: data,
                functionName: "stats/ai/golf"
            });
        }

        /*
         * Keep the first production limit deliberately conservative.
         * This prevents accidental or abusive very large prompts.
         */
        if (data.question.trim().length > 1000) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Question is too long.",
                type: "validation",
                action: "stats/ai/golf",
                payload: data,
                functionName: "stats/ai/golf"
            });
        }

        let userObjectId;

        try {
            userObjectId = new ObjectID(data.user_id);
        } catch (error) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Invalid User ID.",
                type: "validation",
                action: "stats/ai/golf",
                payload: data,
                functionName: "stats/ai/golf"
            });
        }

        const user = await thisDb.collection("users" + suffix).findOne({
            _id: userObjectId
        });

        if (!user) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "User not found.",
                type: "validation",
                action: "stats/ai/golf",
                user: data.user_id,
                payload: data,
                functionName: "stats/ai/golf"
            });
        }

        if (data.token != user.token) {
            return await sendError(res, 200, {
                thisDb,
                errMess: "Token sent does not match with user.",
                type: "validation",
                action: "stats/ai/golf",
                user: data.user_id,
                payload: data,
                functionName: "stats/ai/golf"
            });
        }

        /*
         * Conversation ownership is always derived from the authenticated
         * player. A supplied conversation id is accepted only when that
         * conversation belongs to the current user.
         *
         * For a new conversation, reserve an ObjectID in memory but do not
         * persist the conversation yet. The conversation is inserted only
         * after the first AI request succeeds, preventing failed or timed-out
         * first turns from leaving empty conversation records behind.
         */
        const conversationsCollection = thisDb.collection(
            "ai_conversations" + suffix
        );
        const messagesCollection = thisDb.collection("ai_messages" + suffix);

        let conversation;
        let isNewConversation = false;

        if (data.conversation_id) {
            let conversationObjectId;

            try {
                conversationObjectId = new ObjectID(data.conversation_id);
            } catch (error) {
                return await sendError(res, 200, {
                    thisDb,
                    errMess: "Invalid Conversation ID.",
                    type: "validation",
                    action: "stats/ai/golf",
                    user: data.user_id,
                    payload: data,
                    functionName: "stats/ai/golf"
                });
            }

            conversation = await conversationsCollection.findOne({
                _id: conversationObjectId,
                user_id: user._id,
                status: "active"
            });

            if (!conversation) {
                return await sendError(res, 200, {
                    thisDb,
                    errMess: "Conversation not found.",
                    type: "validation",
                    action: "stats/ai/golf",
                    user: data.user_id,
                    payload: data,
                    functionName: "stats/ai/golf"
                });
            }
        } else {
            isNewConversation = true;

            conversation = {
                _id: new ObjectID(),
                user_id: user._id,
                title: data.question.trim().substring(0, 120),
                status: "active"
            };
        }

        const table = await thisDb.collection("table").findOne({
            as_oos: { $exists: true }
        });

        if (!table) {
            return await sendError(res, 400, {
                thisDb,
                errMess: "Golf analytics options table not found.",
                type: "other",
                action: "stats/ai/golf",
                user: data.user_id,
                functionName: "stats/ai/golf"
            });
        }

        /*
         * Convert the OPTIONS document into the semantic lookup maps consumed
         * by the analytics/tool layer (clubs, positions, outcomes, etc.).
         */
        const analyticsContext = buildAnalyticsContext(table);

        /*
         * Bound the complete AI operation, including any model-requested tool
         * rounds. Promise.race protects the HTTP request from waiting forever;
         * it does not itself cancel an already-running provider request.
         */
        const AI_REQUEST_TIMEOUT_MS = 90000;

        /*
         * Load only a bounded amount of conversation history. The query remains
         * scoped to both the verified conversation and authenticated user so that
         * messages from another user can never enter the AI context.
         *
         * Fetch newest first so MongoDB can apply the limit efficiently, then
         * reverse the result to restore chronological order for the AI provider.
         */
        const conversationHistory = await messagesCollection
            .find({
                conversation_id: conversation._id,
                user_id: user._id
            })
            .sort({
                created_at: -1,
                _id: -1
            })
            .limit(10)
            .toArray();

        conversationHistory.reverse();

        const conversationMessages = conversationHistory.map(
            function (message) {
                return {
                    role: message.role,
                    content: message.content
                };
            }
        );

        let timeoutId;

        const timeoutPromise = new Promise(function (_, reject) {
            timeoutId = setTimeout(function () {
                const error = new Error("Golf AI request timed out.");

                error.code = "GOLF_AI_TIMEOUT";

                reject(error);
            }, AI_REQUEST_TIMEOUT_MS);
        });

        let result;

        try {
            /*
             * user._id is supplied from the authenticated database record, not
             * from model-controlled tool arguments. This is the security
             * boundary that scopes all AI analytics to the current player.
             */
            result = await Promise.race([
                askGolfAI(data.question.trim(), {
                    thisDb,
                    collectionName: "myrounds" + suffix,
                    userId: user._id,
                    analyticsContext,
                    conversationMessages
                }),
                timeoutPromise
            ]);
        } finally {
            clearTimeout(timeoutId);
        }

        const messageCreatedAt = new Date();

        /*
         * A new conversation becomes persistent only after its first AI
         * response succeeds. Existing conversations were already ownership-
         * checked above and only need their updated_at timestamp refreshed.
         */
        if (isNewConversation) {
            await conversationsCollection.insertOne({
                _id: conversation._id,
                user_id: user._id,
                title: conversation.title,
                status: conversation.status,
                created_at: messageCreatedAt,
                updated_at: messageCreatedAt
            });
        }

        /*
         * Persist the complete successful turn together. Failed/timed-out AI
         * requests therefore do not leave a user message without a matching
         * assistant response.
         */
        await messagesCollection.insertMany([
            {
                conversation_id: conversation._id,
                user_id: user._id,
                role: "user",
                content: data.question.trim(),
                created_at: messageCreatedAt
            },
            {
                conversation_id: conversation._id,
                user_id: user._id,
                role: "assistant",
                content: result.content || "",
                created_at: messageCreatedAt
            }
        ]);

        await conversationsCollection.updateOne(
            {
                _id: conversation._id,
                user_id: user._id
            },
            {
                $set: {
                    updated_at: messageCreatedAt
                }
            }
        );

        /*
         * Keep the production contract intentionally small. Internal model and
         * tool diagnostics remain server-side and are not exposed to the frontend.
         */
        return res.json({
            conversation_id: conversation._id.toString(),
            answer: result.content || "",
            visuals: Array.isArray(result.visuals) ? result.visuals : [],
            suggestions: []
        });
    } catch (e) {
        if (e && e.code === "GOLF_AI_TIMEOUT") {
            return await sendError(res, 504, {
                thisDb,
                errMess:
                    "Golf AI is taking too long to respond. Please try again.",
                type: "timeout",
                action: "stats/ai/golf",
                user: data.user_id,
                payload: {
                    user_id: data.user_id
                },
                functionName: "stats/ai/golf"
            });
        }

        return await sendError(res, 400, {
            thisDb,
            errMess: e.message || "Error processing golf AI request.",
            type: "other",
            action: "stats/ai/golf",
            error: e,

            /*
             * Do not put the token or full question into error
             * logging through the request payload.
             */
            payload: {
                user_id: data.user_id
            },

            functionName: "stats/ai/golf"
        });
    }
});

module.exports = router;
