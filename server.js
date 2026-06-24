// server.js
require('dotenv').config()
const MongoClient = require('mongodb').MongoClient;
const bodyParser = require('body-parser');
const Log = require("./app/logs/log");

const express = require('express');
const app = express();
const port = process.env.NODE_PORT;
const database_url = process.env.DATABASE_URL

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(Log);

const db = {
	url: database_url
}

async function initializeIndexes(database, suffix) {
    const dbConn = database.db("grass"); // if you're using MongoClient

    const myroundsDb = dbConn.collection("myrounds" + suffix);
    const statsDb = dbConn.collection("stats" + suffix);
    const rankingDb = dbConn.collection("ranking_cache" + suffix);
    const criteriaDb = dbConn.collection("stats_criteria_usage" + suffix);

    await myroundsDb.createIndex(
        { user_id: 1, id: 1 },
        { unique: true }
    );

    await myroundsDb.createIndex(
        { user_id: 1, date: -1 }
    );

    await myroundsDb.createIndex(
        { user_id: 1, id_course: 1, date: -1 }
    );

    await statsDb.createIndex(
        { user_id: 1, round_id: 1, hole: 1 },
        { unique: true }
    );

    await statsDb.createIndex(
        { user_id: 1, round_id: 1 }
    );

    await statsDb.createIndex(
        { user_id: 1, date: -1 }
    );

    await statsDb.createIndex(
        { user_id: 1, id_course: 1, date: -1 }
    );

    await statsDb.createIndex(
        {id_course: 1, date: -1 }
    );

    await statsDb.createIndex(
        {id_course: 1 }
    );

    await rankingDb.createIndex(
        { filter_hash: 1, user_id: 1 },
        { unique: true }
    );

    await rankingDb.createIndex(
        { status: 1, updated_at: 1 }
    );

    await rankingDb.createIndex(
        { status: 1, updated_at: 1 }
    );

    await criteriaDb.createIndex(
        { filter_hash: 1 },
        { unique: true }
    );

    await criteriaDb.createIndex(
        { usage_count: -1, last_used_at: -1 }
    );
    
    console.log("Indexes initialized");
}

MongoClient.connect(db.url, async (err, database) => {
	if (err) 
		return console.log(err)

	const { getAppConfig } = require("./app/config/app_config");
    const appConfig = getAppConfig();
    const suffix = appConfig.suffix;

	await initializeIndexes(database, suffix);

	require('./app/routes')(app, database);
	app.listen(port, () => {
		console.log('GRASS- v1.0');
		console.log('We are live on port ' + port);
	});
});
