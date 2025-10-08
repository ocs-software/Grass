const InitiateMongoServer = require("../config/db");
InitiateMongoServer();
const mongoose = require("mongoose");

const Token = require("../routes/api_keys/model/Token");
const TokenUsage = require("../routes/api_keys/model/TokenUsage");

module.exports = async function (req, res, next) {
  // console.log("req.header", req.header)
  if (!req.header("Authorization")) return res.status(401).json({ message: "Auth Error" });
  const bearer = req.header("Authorization").split(' ');
  const token = bearer[1];
  if (!token) return res.status(401).json({ message: "Auth Error" });

  try {
    // const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // if (decoded.user.status == "pending") return res.status(403).json({ message: "Email not verified." });
    // req.user = decoded.user;

    // Lookup token in MongoDB
    let origin_url = req.get('Origin')
    console.log(origin_url)
    const token_lookup = await Token.find( { 'token': token, referer: origin_url });
    if (!token_lookup[0]) { return res.status(401).json({ message: "Token not found" })}
    new_token_usage = new TokenUsage({
      token_id: token_lookup[0]._id,
      token: token_lookup[0].token
    });

    new_token_usage.save();
    next();
  } catch (e) {
    console.log(e)
    res.status(401).send({ message: "Invalid Token" });
  }
};
