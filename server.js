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

/*
const apps = express();
const http = require('http').Server(apps);
*/

const db = {
	url: database_url
}

MongoClient.connect(db.url, (err, database) => {
	if (err) return console.log(err)

	/*
	var io = require('socket.io')(http, { maxHttpBufferSize: 1e8, pingTimeout: 20000, pingInterval: 25000, perMessageDeflate: false });
	io.on('connection', function (client) {
		client.on("connect", function (data) {
			console.log('Connect');
		});
		client.on("something", function (data) {
			console.log('something ' + data[1] + ' ' + data[0]);
			client.emit('ok', "OK")
			client.broadcast.emit(data[1], data[0]);
		});
	});
	http.listen(8080, () => {
		console.log('Socket live on port 8080');
	});
	*/

	// require('./app/routes')(app, database, io);
	require('./app/routes')(app, database);
	app.listen(port, () => {
		console.log('Pin Positions API - v1.0');
		console.log('We are live on port ' + port);
	});
});
