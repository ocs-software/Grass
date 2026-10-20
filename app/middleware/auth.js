/**
 * API-token authentication middleware used by routes that rely on the
 * Mongoose Token/TokenUsage models.
 *
 * A bearer token is accepted only when a Token record exists for both the
 * supplied token and request Origin. Successful use is recorded through the
 * TokenUsage model before the request continues.
 *
 * Note: the Token and TokenUsage model implementations are outside the Grass
 * folder supplied for this documentation pass.
 */
const InitiateMongoServer = require("../config/db");
InitiateMongoServer();
const mongoose = require("mongoose");

const Token = require("../routes/api_keys/model/Token");
const TokenUsage = require("../routes/api_keys/model/TokenUsage");

/** Validates the request bearer token and records successful token usage. */
module.exports = async function (req, res, next) {
    if (!req.header("Authorization"))
        return res.status(401).json({ message: "Auth Error" });
    const bearer = req.header("Authorization").split(" ");
    const token = bearer[1];
    if (!token) return res.status(401).json({ message: "Auth Error" });

    try {
        // const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // if (decoded.user.status == "pending") return res.status(403).json({ message: "Email not verified." });
        // req.user = decoded.user;

        // Lookup token in MongoDB
        let origin_url = req.get("Origin");
        const token_lookup = await Token.find({
            token: token,
            referer: origin_url
        });
        if (!token_lookup[0]) {
            return res.status(401).json({ message: "Token not found" });
        }
        new_token_usage = new TokenUsage({
            token_id: token_lookup[0]._id,
            token: token_lookup[0].token
        });

        new_token_usage.save();
        next();
    } catch (e) {
        console.error(
            "API token authentication failed:",
            e && e.message ? e.message : "Unknown error"
        );

        res.status(401).send({ message: "Invalid Token" });
    }
};
