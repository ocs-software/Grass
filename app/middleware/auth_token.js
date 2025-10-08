const InitiateMongoServer = require("../config/db");
InitiateMongoServer();
const { ObjectId } = require('mongodb');

module.exports = async function (req, res, next) {
  try {
    const { dbid, tourid, id } = req.params
    // still needs a lot of work , was just creating a log (we had 2.6 million)
    return next();
    
    if (req.subdomains.length < 1) { return next() }
    // if (!req.header("Authorization")) return res.status(401).json({ message: "Auth Error" });
    let token = ""
    if (req.header("Authorization")) {
      const bearer = req.header("Authorization").split(' ');
      token = bearer[1];
    }

    // Block request if no token (only make live once TV companies have had time to make change)
    // if (!token) return res.status(401).json({ message: "Auth Error" });

    // Get origin url (if it exists, otherwise express.js sets this value to null)
    const origin_url = req.get('origin')
    // Get subdomain and look for 'api' if its just 'api' then we move on with the request as it is one that has busted through the CF cache (correctly, as CF cache needs to be updated)
    const subdomains = req.subdomains
    const subd_includes = 'tv-'

    const sub_domain_check = subdomains.length >= 2 ? subdomains[1] : subdomains[0];

    let sub_check = sub_domain_check.includes(subd_includes)
    if (!sub_check) {
      return next();
    }
    // console.log("run here")
    // console.log("subdomains 2")
    // console.log(subdomains)
    // Lookup token
    const manage_db = require('./auth_db')
    const thisDb = manage_db.choose_db(req, req.db, )
    // let query = { _id: new ObjectId(token) }
    // let token_lookup = await thisDb.collection('tokens').findOne(query);
    // // console.log("token_lookup")
    // // console.log(token_lookup)
    // if (!token_lookup) { return res.status(401).json({ message: "Token not found" })}

    // Store usage of token for stats and rate limits
    const usage_record = {
      token,
      origin_url,
      subdomains,
      createdAt: new Date()
    }
    const insert = await thisDb.collection('token_usage').insertOne(usage_record);
    console.log("Mongo insert result")
    console.log(insert)
    next();
  } catch (e) {
    console.log(e)
    res.status(401).send({ message: "Invalid Token" });
  }
};
