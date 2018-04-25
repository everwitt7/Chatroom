// Require the packages we will use:
var http = require("http"),
socketio = require("socket.io"),
fs = require("fs");

// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
var app = http.createServer(function(req, resp){
	// This callback runs when a new connection is made to our HTTP server.

	fs.readFile("client.html", function(err, data){
		// This callback runs when the client.html file has been read from the filesystem.

		if(err) return resp.writeHead(500);
		resp.writeHead(200);
		resp.end(data);
	});

	fs.readFile("chat.css", function (err, data) {
        if (err) return resp.writeHead(500);
        resp.writeHead(200, {'Content-Type': 'text/css'});
        resp.end();
     });
});
app.listen(3456);

// Do the Socket.IO magic:
var io = socketio.listen(app);

var usernames = {};

var users = [];
var rooms = {};

var colors = {};
var swearWords = ['shit', 'fuck', 'damn', 'bitch', 'crap', 'piss', 'dick', 'darn',
'cock', 'pussy', 'penis', 'asshole' , 'fag', 'bastard', 'slut', 'douce', 'ass',
'buttfucker', 'bumfucker', 'cunt', 'dogshit', 'horseshit', 'gay', 'homo', 'bitchface', 'fuckface',
'fucker', 'fucks', 'dicks', 'bitches', 'cocks', 'pussyhead', 'penishole', 'assface'];
//http://www.hyperhero.com/en/insults.htm
//list of curse words

io.sockets.on("connection", function(socket){
	// This callback runs when a new Socket.IO connection is established.

	socket.on('message_to_server', function(data) {
		// This callback runs when the server receives a new message from the client.
		var rn = data["curroom"]
		var msg = data["message"]
		var user = data["username"]
		var c = colors[user];

		//console.log(msg, user);
		var curse = false;
		var words = msg.split(" ")

		for (swear in swearWords) {
			for (word in words) {
				if (swearWords[swear] == words[word]) {
					curse = true;
				}
			}
		}

		if(curse) {
			msg = "THIS MESSAGE CONTAINED PROFANITY";
		}

		io.sockets.in(rn).emit("message_to_client", { message:msg, username:user, color:c }) // broadcast the message to other users

	});

	socket.on('create_new_user', function(data) {
		// This callback runs when the server receives a new message from the client.
		var alreadyTaken = false;

		for(user in users) {
			if(users[user] == data["username"]) {
				alreadyTaken = true;
			}
		}

		if(!alreadyTaken) {
			users.push(data["username"]);
			usernames[data["username"]] = socket.id;
			colors[data['username']] = data['c'];
		}

		io.sockets.emit("load_room", { roomdata:rooms }) // broadcast the message to other users
	});

	socket.on('create_new_room', function(data) {
		// This callback runs when the server receives a new message from the client.
		var rn = data["roomname"]
		var rp = data["roompass"]
		var ro = data["username"]

		var roomJSON =
		{
			name: "",
			password: "",
			owner: "",
			bannedUsers: [],
			connectedUsers: []
		}

		roomJSON.name = rn;
		roomJSON.password = rp;
		roomJSON.owner = ro;

		rooms[rn] = roomJSON;

		io.sockets.emit("new_room", { roomname:rn }) // broadcast the message to other users
	});

	socket.on('join_new_room', function(data) {
		var rc = data["roomchoice"]
		var user = data["username"]
		var gp = data["guesspass"]

		var owner = rooms[rc].owner;
		var banned = false;
		var correctpass = false;

		if(rooms[rc].password === gp || rooms[rc].password == "") {
			correctpass = true;
		}

		for (var i = 0; i < rooms[rc].bannedUsers.length; i++) {
			if (user === rooms[rc].bannedUsers[i]) {
				banned = true;
			}
		}

		if(banned){
			socket.emit('isBanned');
		}

		else if(!correctpass) {
			socket.emit('badPass');
		}

		else {

			socket.join(rc);

			rooms[rc].connectedUsers.push(user)

			socket.emit('joinedRoom');

			io.sockets.in(rc).emit('update', { username:user, reason:"joined", info:rooms[rc].connectedUsers } );
			if (user === owner) {
				socket.emit('isOwner');
			}
		}
	});

	socket.on('leaveroom', function(data) {

		var rc = data["roomchoice"]
		var user = data["username"]

		const index = rooms[rc].connectedUsers.indexOf(user);
		rooms[rc].connectedUsers.splice(index, 1);

		socket.leave(rc);
		io.sockets.in(rc).emit('update', { username:user, reason:"left", info:rooms[rc].connectedUsers } );

		socket.emit('leftRoom', { user:user, message:"" });
	});

	socket.on('kick_user', function(data) {
		var rc = data["roomchoice"]
		var user = data["username"]

		const index = rooms[rc].connectedUsers.indexOf(user);
		rooms[rc].connectedUsers.splice(index, 1);

		io.sockets.in(rc).emit('update', { username:user, reason:"kicked", info:rooms[rc].connectedUsers } );
		io.sockets.connected[usernames[user]].emit('leftRoom', { message:"You were kicked from the room" });
	});

	socket.on('ban_user', function(data) {
		var rc = data["roomchoice"]
		var user = data["username"]

		const index = rooms[rc].connectedUsers.indexOf(user);
		rooms[rc].connectedUsers.splice(index, 1);
		rooms[rc].bannedUsers.push(user);

		io.sockets.in(rc).emit('update', { username:user, reason:"banned", info:rooms[rc].connectedUsers } );
		io.sockets.connected[usernames[user]].emit('leftRoom', { message:"You were banned from the room" });
	});

	socket.on('send_priv_message', function(data) {
		var rc = data["roomchoice"];
		var from = data["from"];
		var to = data["to"];
		var msg = data["message"];

		io.sockets.connected[usernames[to]].emit('priv_msg',  {to:to, from:from, msg:msg} );
	});

});
