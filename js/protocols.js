

var net = require('net');
let client = null; // node socket


var buffer = Buffer.alloc(0);
function onData(data) {
	buffer = Buffer.concat([buffer, data]);
	do {
		if (buffer.length < 8) break;
		var packetLength = buffer.readInt32LE(4) + 12;
		if (buffer.length < packetLength) break;
		packetReceived(buffer.readInt32LE(0),buffer.slice(0,packetLength));
		buffer = buffer.slice(packetLength,buffer.length);
	} while (buffer.length > 0);
}

function initConnToServer(ip, port) {
	if (!port) port = '9998';
	connecting(ip+':'+port);
	if (client) client.destroy();
	client = new net.Socket(); //return a Node socket
	client.connect(port, ip);
	client.ip = ip;
	client.port = port;
	client.on('connect', TCP_Connected);
	client.on('data', onData);
	client.on('error', function(err) {
		if (err.code = 'ECONNRESET') {
			if (!retryRegistration) { //part of pserver security plugin to work around local proxies like pdrug.
				retryRegistration = true;
				initConnToServer(client.ip,client.port);
			}
		} else {
			logmsg('Socket error: ' + err);
		}
	});
}

function TCP_Connected() {
	logmsg('Connected');
}



function parseRoom(p) {
	var roomPstring = function(b,offset) {
		var o = b.readInt16LE(offset)+52;
		return windows1252.decode(b.toString('binary',o+1,o+1+b.readInt8(o)));
	};

	var room = {id:p.readInt16LE(20),
				flags:p.readInt32LE(12),
				name:roomPstring(p,22),
				artist:roomPstring(p,26),
				background:roomPstring(p,24),
				password:'',
				looseprops:[],
				spots:[],
				pictures:[],
				draws:[]};


	var nxt = p.readInt16LE(46)+52;
	var count = p.readInt16LE(44);
	for (var i = 0; i < count; i++) { // make sure loop is correct
		room.looseprops.push({y:p.readInt16LE(nxt+20), x:p.readInt16LE(nxt+22), id:p.readInt32LE(nxt+4)});
		nxt = p.readInt16LE(nxt)+52;
	}

	nxt = p.readInt16LE(32)+52
	count = p.readInt16LE(30);

	for (var i = 0; i < count; i++) { //hotspots aka doors
		var flags = p.readInt32LE(nxt+4);
		var spot = {flags:flags,layer:(flags & 0x00000004 || flags & 0x00000040 || flags & 0x00000001)?1:0,
						y:p.readInt16LE(nxt+16),x:p.readInt16LE(nxt+18),id:p.readInt16LE(nxt+20),dest:p.readInt16LE(nxt+22),
						type:p.readInt16LE(nxt+28),state:p.readInt16LE(nxt+36),name:roomPstring(p,nxt+42),
						script:p.cString(p.readInt16LE(nxt+44)+52),
						points:[],statepics:[]};

		var ptsCount = p.readInt16LE(nxt+24);
		var ptsOffset = p.readInt16LE(nxt+26)+52;
  		for (var j = 0; j < ptsCount; j++) {
  			spot.points.push(p.readInt16LE(ptsOffset+2));
  			spot.points.push(p.readInt16LE(ptsOffset));
  			ptsOffset += 4;
  		}

  		var nbrStates = p.readInt16LE(nxt+38);
  		var stateRecOfst = p.readInt16LE(nxt+40)+52;
		for (var j = 0; j < nbrStates; j++) {
			spot.statepics.push({id:p.readInt16LE(stateRecOfst),
									x:p.readInt16LE(stateRecOfst+6),
									y:p.readInt16LE(stateRecOfst+4)});
			stateRecOfst += 8;
		}

		room.spots.push(spot);
		nxt += 48;
	}

	var nbrPics = p.readInt16LE(34);
	var picOffset = p.readInt16LE(36)+52;
	for (var i = 0; i < nbrPics; i++) {
		room.pictures.push({name:roomPstring(p,picOffset+6),id:p.readInt16LE(picOffset+4),trans:p.readInt16LE(picOffset+8)});
		picOffset += 12;
	}

	nxt = p.readInt16LE(40)+52;

	room.draws = [];
	var nbrDraws = p.readInt16LE(38);
	for (var i = 0; i < nbrDraws; i++) {
		var pos = p.readInt16LE(nxt+8)+52;
		room.draws.push(parseDraw( p.slice(pos,p.readInt16LE(nxt+6)+pos) , p.readInt16LE(nxt+4)));
		nxt=p.readInt16LE(nxt)+52;
	}

	loadRoom(room);
}

function parseUser(p) {
  var user = {name:p.pString(104),
				id:p.readInt32LE(8),
				x:p.readInt16LE(18),
				y:p.readInt16LE(16),
				color:p.readInt16LE(96),
				face:p.readInt16LE(94),
				props:[]};

	var nbrProps = p.readInt16LE(102);
	for (var j = 0; j < nbrProps; j++)
		user.props.push(p.readInt32LE(12+(j*8)));

	addRoomUser(user);
}

function parseUsers(p) {
	var users = [];
	var uOffset = 12;
	var count = p.readInt32LE(8);
	for (var i = 0; i < count; i++) {
		var user = {name:p.pString(uOffset+92),
					id:p.readInt32LE(uOffset),
					x:p.readInt16LE(uOffset+6),
					y:p.readInt16LE(uOffset+4),
					color:p.readInt16LE(uOffset+84),
					face:p.readInt16LE(uOffset+82),
					props:[]};

		var nbrProps = p.readInt16LE(90+uOffset);
		for (var j = 0; j < nbrProps; j++)
			user.props.push(p.readInt32LE(8+uOffset+(j*8)));

		users.push(user);
		uOffset += 124;
	}

	loadRoomUsers(users);
}

function buffer2Props(b) {
	var props = [];
	for (var i = 0; i < b.length-1; i += 8)
		props.push(b.readInt32LE(i));
	return props;
}

function parseRoomList(b) {
	var list = [];
	var count = b.readInt32LE(8);
	var add = 12;
	for (var i = 0; i < count; i++) {
		var nameLen = b.readInt8(add+8);
		list.push({name:windows1252.decode(b.toString('binary',add+9,add+9+nameLen)),
						id:b.readInt32LE(add),
						flags:b.readInt16LE(add+4),
						population:b.readInt16LE(add+6)});
		add = add+9+((nameLen + ( 4 - (nameLen & 3))) - 1);
	}
	loadRoomList(list);
}

function parseUserList(b) {
	var list = [];
	var count = b.readInt32LE(8);
	var add = 12;
	for (var i = 0; i < count; i++) {
		var nameLen = b.readInt8(add+8);
		list.push({name:windows1252.decode(b.toString('binary',add+9,add+9+nameLen)),
						userid:b.readInt32LE(add),
						flags:b.readInt16LE(add+4),
						roomid:b.readInt16LE(add+6)});
		add = add+9+((nameLen + ( 4 - (nameLen & 3))) - 1);
	}
	loadUserList(list);
}

function parseDraw(cmdData,type) {

	var nbrPoints,i,differential,pensize,r1,g1,b1,r2,g2,b2;
	var a1 = -1;
	var a2 = -1;
	var fillAlpha = 255;
	var penAlpha = 255;
	var jdraw = {type:type};

	if ((type & drawType.CLEAN) == 0 && (type & drawType.UNDO) == 0) {


		var shape = (type & drawType.SHAPE) != 0;
		pensize = cmdData.readInt16LE(0);
		differential = Math.trunc(pensize/2);
		nbrPoints = cmdData.readInt16LE(2);

		if (cmdData.length == (nbrPoints*4)+22) {
			r1 = cmdData.readUInt8(cmdData.length-7);
			g1 = cmdData.readUInt8(cmdData.length-6);
			b1 = cmdData.readUInt8(cmdData.length-5);
			a1 = cmdData.readUInt8(cmdData.length-8);

			r2 = cmdData.readUInt8(cmdData.length-3);
			g2 = cmdData.readUInt8(cmdData.length-2);
			b2 = cmdData.readUInt8(cmdData.length-1);
			a2 = cmdData.readUInt8(cmdData.length-4);
		} else {
			r1 = cmdData.readUInt8(4);
			g1 = cmdData.readUInt8(6);
			b1 = cmdData.readUInt8(8);
			r2 = r1;
			g2 = g2;
			b2 = b2;
			if (shape) pensize = 0; //old style fill
		}

		if ((type & drawType.TEXT) != 0) { //text
			pensize = cmdData.readInt16LE(0);

			jdraw.bold = (cmdData.readUInt8(18) & 1) != 0;
			jdraw.underline = (cmdData.readUInt8(18) & 2) != 0;
			jdraw.italic = (cmdData.readUInt8(18) & 4) != 0;

			var font = cmdData.pString(19);
			var aLen = font.length;
			jdraw.font = font;
			var msg = cmdData.cString(20+aLen); //must define utf8!
			jdraw.msg = msg;

			if (aLen+msg.length+29 == cmdData.length) {
				// might be executing color building twice, check for this later
				r1 = cmdData.readUInt8(cmdData.length-7);
				g1 = cmdData.readUInt8(cmdData.length-6);
				b1 = cmdData.readUInt8(cmdData.length-5);
				a1 = cmdData.readUInt8(cmdData.length-8);

				r2 = cmdData.readUInt8(cmdData.length-3);
				g2 = cmdData.readUInt8(cmdData.length-2);
				b2 = cmdData.readUInt8(cmdData.length-1);
				a2 = cmdData.readUInt8(cmdData.length-4);
				pensize=cmdData.readInt16LE(0);
			}

			jdraw.x = cmdData.readInt16LE(10);
			jdraw.y = cmdData.readInt16LE(12);

		} else if ((type & drawType.OVAL) != 0) { //oval
			var w = cmdData.readInt16LE(14);
			var h = cmdData.readInt16LE(16);
			jdraw.w = w;
			jdraw.h = h;
			jdraw.x = cmdData.readInt16LE(10) - Math.trunc(w/2);
			jdraw.y = cmdData.readInt16LE(12) - Math.trunc(h/2);
		} else {

			i = ((nbrPoints+1)*4)+9;

			var x = 0,y = 0,difference = 0;

			if ((type & 1) == 0 && !shape) difference = differential;

			var pts = [];
			for (var j = 10; j < i; j += 4) {
				y=y+cmdData.readInt16LE(j);
				x=x+cmdData.readInt16LE(j+2);
				pts.push(x+difference);
				pts.push(y+difference);
			}
			jdraw.points = pts;
		}
	}
	jdraw.pensize = pensize;

	if (a1 > -1) {
		jdraw.pencolor = "rgba("+r1+","+g1+","+b1+","+(a1/255)+")";
		jdraw.fillcolor = "rgba("+r2+","+g2+","+b2+","+(a2/255)+")";
	} else {
		jdraw.pencolor = "rgb("+r1+","+g1+","+b1+")";
		jdraw.fillcolor = jdraw.pencolor;
	}

	return jdraw;
}


function packetReceived(type,packet) {
	//logmsg('packet: '+packet.slice(0,4));
	switch(type) {
		case TCPmsgConsts.TIYID:
			sendRegistration();
			break;
		case TCPmsgConsts.HTTPSERVER:
			mediaUrl = packet.cString(12); // should make sure it ends with a forward slash!
			break;

		case TCPmsgConsts.SPOTMOVE:
			spotMove(packet.readInt16LE(12),packet.readInt16LE(14),packet.readInt16LE(18),packet.readInt16LE(16))
			break;
		case TCPmsgConsts.PICTMOVE:
			spotMovePic(packet.readInt16LE(12),packet.readInt16LE(14),packet.readInt16LE(18),packet.readInt16LE(16));
			break;
		case TCPmsgConsts.SPOTSTATE:
			spotStateChange(packet.readInt16LE(12),packet.readInt16LE(14),packet.readInt16LE(16),0);
  			break;
  		case TCPmsgConsts.DOORLOCK:
			spotStateChange(packet.readInt16LE(12),packet.readInt16LE(14),1,-1);
			break;
		case TCPmsgConsts.DOORUNLOCK:
			spotStateChange(packet.readInt16LE(12),packet.readInt16LE(14),0,1);
			break;
		case TCPmsgConsts.ROOMSETDESC:
		case TCPmsgConsts.ROOMDESC:
			parseRoom(packet);
			break;

		case TCPmsgConsts.NAVERROR:
			logmsg(navigationError(packet.readInt32LE(8)));
  			break;
		case TCPmsgConsts.LISTOFALLROOMS:
			parseRoomList(packet);
			break;
		case TCPmsgConsts.LISTOFALLUSERS:
			parseUserList(packet);
			break;

		case TCPmsgConsts.PROPDEL:
			loosePropDelete(packet.readInt32LE(12));
			break;
		case TCPmsgConsts.PROPNEW:
			loosePropAdd({x:packet.readInt16LE(22),y:packet.readInt16LE(20),id:packet.readInt32LE(12),crc:packet.readInt32LE(16)});
			break;
		case TCPmsgConsts.PROPMOVE:
			loosePropMove(packet.readInt16LE(18),packet.readInt16LE(16),packet.readInt32LE(12));
			break;
		case TCPmsgConsts.USERSTATUS:
			theUserID = packet.readInt32LE(8);
			theUserStatus = packet.readInt16LE(12);
			break;
		case TCPmsgConsts.SERVERINFO:
			serverInfo(packet.readInt32LE(12),packet.pString(16));
			break;

		case TCPmsgConsts.USERFACE:
			userFaceChange(packet.readInt32LE(8),packet.readInt16LE(12));
			break;
		case TCPmsgConsts.USERCOLOR:
			userColorChange(packet.readInt32LE(8),packet.readInt16LE(12));
			break;
		case TCPmsgConsts.USERPROP:
			userPropChange(packet.readInt32LE(8),buffer2Props( packet.slice(16,packet.length) ));
			break;
		case TCPmsgConsts.USERDESC:
			userAvatarChange(packet.readInt32LE(8),packet.readInt16LE(12),packet.readInt16LE(14),buffer2Props( packet.slice(20,packet.length) ));
			break;
		case TCPmsgConsts.USERNAME:
			userNameChange(packet.readInt32LE(8),packet.pString(12));
			break;
		case TCPmsgConsts.USERLOG:
			userLogOn(packet.readInt32LE(8),packet.readInt32LE(12));
			break;
		case TCPmsgConsts.LOGOFF:
			userLogOff(packet.readInt32LE(8),packet.readInt32LE(12));
			break;
		case TCPmsgConsts.USERMOVE:
			userMove(packet.readInt32LE(8),packet.readInt16LE(14),packet.readInt16LE(12));
			break;
		case TCPmsgConsts.USEREXIT:
			userRemove(packet.readInt32LE(8));
			break;
		case TCPmsgConsts.USERNEW:
			parseUser(packet);
			break;
		case TCPmsgConsts.USERLIST:
			parseUsers(packet);
			break;
		case TCPmsgConsts.XWHISPER:
			userChat({id:packet.readInt32LE(8),chatstr:crypt.Decrypt(packet.slice(14,14+packet.readInt16LE(12)-3)),whisper:true});
			break;
		case TCPmsgConsts.XTALK:
			userChat({id:packet.readInt32LE(8),chatstr:crypt.Decrypt(packet.slice(14,14+packet.readInt16LE(12)-3)),whisper:false});
  			break;
		case TCPmsgConsts.TALK:
			userChat({id:packet.readInt32LE(8),chatstr:packet.cString(12),whisper:false});
  			break;
  		case TCPmsgConsts.WHISPER:
			userChat({id:0,chatstr:packet.cString(12),whisper:true});
  			break;
  		case TCPmsgConsts.PING:
  			sendPong();
  			break;
  		case TCPmsgConsts.DRAW:
  			roomDraw(parseDraw(packet.slice(22,packet.length),packet.readUInt16LE(16)));
  			break;
		case TCPmsgConsts.ASSETQUERY:
		case TCPmsgConsts.ALTLOGONREPLY:
		case TCPmsgConsts.ROOMDESCEND:
		case TCPmsgConsts.EXTENDEDINFO:
		case TCPmsgConsts.VERSION:
			//trash
			break;
		default:
			logmsg('unhandled packet: '+packet.slice(0,4));
			break;
	}
}

function navigationError(type) { //maybe change this to css eventually
	switch(type) {
		case 0:
			return 'Internal Server Error!';
		case 1:
			return 'Unknown room.';
		case 2:
			return 'Room is full.';
		case 3:
			return 'Room is closed.';
		case 4:
			return 'You can\'t author.';
		case 5:
			return 'The Server is full.';
		default:
			return "Unknown navigation error.";
	}
}

function sendDraw(draw) {

	var drawCmd = 0,i,x = 0,y = 0,x1,y1;

	if (draw.type) drawCmd = 0x0100;
	if (draw.front) drawCmd = drawCmd ^ 0x8000;
	var n = draw.points.length;
	var packet = Buffer.alloc((n*2)+40);

	//header data
	packet.writeInt32LE(TCPmsgConsts.DRAW,0);
	packet.writeInt32LE((n*2)+28,4); //packetlength
	//packet.long(8)=0 'userID
	//link
	//packet.writeInt16LE(12)=0
	//packet.writeInt16LE(14)=0
	//drawCmd

	packet.writeInt16LE(drawCmd,16,true); //flag...... not sure if applying correct value
	//cmdLength

	packet.writeInt16LE((n*2)+18,18);
	packet.writeInt16LE(draw.size,22); //pensize

	packet.writeInt16LE((n/2)-1,24); //nbrPts

	var red = Number(draw.color[0]);
	var green = Number(draw.color[1]);
	var blue = Number(draw.color[2]);
	var alpha = (Number(draw.color[3]) * 255).fastRound();

	packet.writeUInt8(red,26);
	packet.writeUInt8(red,27);
	packet.writeUInt8(green,28);
	packet.writeUInt8(green,29);
	packet.writeUInt8(blue,30);
	packet.writeUInt8(blue,31);

	//for i=1 to n-1 step 2
	for (i = 1; i < n; i += 2) {
		x1=draw.points[i-1];
		y1=draw.points[i];
		packet.writeInt16LE(y1-y,(i*2)+30);
		packet.writeInt16LE(x1-x,(i*2)+32);
		x=x1;
		y=y1;
	}

	packet.writeUInt8(alpha,packet.length-8);
	packet.writeUInt8(red,packet.length-7);
	packet.writeUInt8(green,packet.length-6);
	packet.writeUInt8(blue,packet.length-5);

	red = Number(draw.fill[0]);
	green = Number(draw.fill[1]);
	blue = Number(draw.fill[2]);
	alpha = (Number(draw.fill[3]) * 255).fastRound();

	packet.writeUInt8(alpha,packet.length-4);
	packet.writeUInt8(red,packet.length-3);
	packet.writeUInt8(green,packet.length-2);
	packet.writeUInt8(blue,packet.length-1);

	client.write(packet);
}

function sendDrawClear(drawCmd) {
	var packet = Buffer.alloc(22);
	packet.writeInt32LE(TCPmsgConsts.DRAW,0);
	packet.writeInt32LE(10,4);
	packet.writeInt16LE(drawCmd,16);
	client.write(packet);
}

function sendOperatorRequest(password) {
	password = windows1252.encode(password);
	var leng = password.length;
	var packet = Buffer.alloc(13+leng);
	packet.writeInt32LE(TCPmsgConsts.SUPERUSER,0);
	packet.writeInt32LE(leng+1,4);
	var data = crypt.Encrypt(Buffer.from(password));
	packet.writeInt8(data.length,12);
	data.copy(packet,13);
	client.write(packet);
}

function sendPong() {
	var packet = Buffer.alloc(12);
	packet.writeInt32LE(TCPmsgConsts.PONG,0);
	client.write(packet);
}

function sendWhisper(msg,whisperID) {
	msg = windows1252.encode(msg);
	var leng = msg.length;
	var packet = Buffer.alloc(19+leng);
	packet.writeInt32LE(TCPmsgConsts.XWHISPER,0);
	packet.writeInt32LE(leng+7,4);
	packet.writeInt32LE(whisperID,12);
	packet.writeInt16LE(leng+3,16);
	crypt.Encrypt(Buffer.from(msg,'binary')).copy(packet,18);
	client.write(packet);
}

function sendXtlk(msg) {
	msg = windows1252.encode(msg);
	var leng = msg.length;
	var packet = Buffer.alloc(15+leng);
	packet.writeInt32LE(TCPmsgConsts.XTALK,0);
	packet.writeInt32LE(leng+3,4);
	packet.writeInt16LE(leng+3,12);
	crypt.Encrypt(Buffer.from(msg,'binary')).copy(packet,14);
	client.write(packet);
}

function sendRoomNav(id) {
	var packet = Buffer.alloc(14);
	packet.writeInt32LE(TCPmsgConsts.ROOMGOTO,0);
	packet.writeInt32LE(2,4);
	packet.writeInt16LE(id,12);
	client.write(packet);
}

function sendRoomListRequest() {
	var packet = Buffer.alloc(12);
	packet.writeInt32LE(TCPmsgConsts.LISTOFALLROOMS,0);
	client.write(packet);
}

function sendUserListRequest() {
	var packet = Buffer.alloc(12);
	packet.writeInt32LE(TCPmsgConsts.LISTOFALLUSERS,0);
	client.write(packet);
}

function sendPropDress() {
	var length = theUser.props.length;
	var packet = Buffer.alloc(16+length*8);

	packet.writeInt32LE(TCPmsgConsts.USERPROP,0);
	packet.writeInt32LE(length*8+4,4);
	packet.writeInt32LE(length,12);
	for (var i = 0; i < length; i++)
		packet.writeInt32LE(theUser.props[i],16+i*8);

	client.write(packet);
}

function sendPropDelete(idx) {
	var packet = Buffer.alloc(16);
	packet.writeInt32LE(TCPmsgConsts.PROPDEL,0);
	packet.writeInt32LE(4,4);
	packet.writeInt32LE(idx,12);
	client.write(packet);
}

function sendPropDrop(x,y,id) {
	var packet = Buffer.alloc(24);
	packet.writeInt32LE(TCPmsgConsts.PROPNEW,0);
	packet.writeInt32LE(12,4);
	packet.writeInt32LE(id,12);
	packet.writeInt16LE(y,20);
	packet.writeInt16LE(x,22);
	client.write(packet);
}

function sendPropMove(x,y,index) {
	var packet = Buffer.alloc(20);
	packet.writeInt32LE(TCPmsgConsts.PROPMOVE,0);
	packet.writeInt32LE(8,4);
	packet.writeInt32LE(index,12);
	packet.writeInt16LE(y,16);
	packet.writeInt16LE(x,18);
	client.write(packet);
}

function sendPropDelete(index) {
	var packet = Buffer.alloc(16);
	packet.writeInt32LE(TCPmsgConsts.PROPDEL,0);
	packet.writeInt32LE(4,4);
	packet.writeInt32LE(index,12);
	client.write(packet);
}

function sendUserLocation(x,y) {
	var packet = Buffer.alloc(16);
	packet.writeInt32LE(TCPmsgConsts.USERMOVE,0);
	packet.writeInt32LE(4,4);
	packet.writeInt16LE(y,12);
	packet.writeInt16LE(x,14);
	client.write(packet);
}

function sendUserName(name) {

	name = windows1252.encode(name);
	var packet = Buffer.alloc(name.length+13);
	packet.writeInt32LE(TCPmsgConsts.USERNAME,0);
	packet.writeInt32LE(name.length+1,4);
	packet.writeInt8(name.length,12);
	packet.write(name,13,'binary');
	client.write(packet);
}

var retryRegistration = null; //pserver plugin security bull
function sendRegistration() {
	var reg =  Buffer.alloc(140);
	reg.writeInt32LE(TCPmsgConsts.LOGON,0);
	reg.writeInt32LE(128,4); //fixed packet length

	reg.writeInt32LE(regi.key,12);
	reg.writeInt32LE(regi.crc,16);

	var name = windows1252.encode(getGeneralPref('userName'));
	reg.writeInt8(name.length,20);
	reg.write(name,21,'binary'); //should truncate to 31 bytes max

	if (/^win/.test(process.platform)) { //add linux/unix identifier.
		reg.writeUInt32LE(0x80000004,84); //must validate since value is
	} else {
		reg.writeUInt32LE(0x80000002,84);
	}

	reg.writeInt32LE(regi.puidCrc,88);
	reg.writeInt32LE(regi.puid,92);

	reg.writeInt32LE(0x00011940,96);
	reg.writeInt32LE(0x00011940,100);
	reg.writeInt32LE(0x00011940,104);
	//reg.writeInt16LE(0,108); //optional room ID to land in (if server allows it)

	reg.write('PC5000',110,6);

	reg.writeInt32LE(0x00000041,120);
	if (retryRegistration) {
		reg.writeInt32LE(0x00000111,124); //original value required by a security pserver plugin
	} else {
		reg.writeInt32LE(0x00000151,124); //a protocol required by a different security pserver plugins
	}
	reg.writeInt32LE(0x00000001,128);
	reg.writeInt32LE(0x00000001,132);

	client.write(reg);
}


function PalaceRegistration(seed,p) {
	this.CRC_MAGIC = 0xa95ade76;
	this.MAGIC_LONG = 0x9602c9bf;
	this.OBFUSCATE_LONG = 0xD7AA3702;

	this.key = this.computeLicenseCRC(seed);
	this.crc = ( ( seed ^ this.MAGIC_LONG ) ^ this.key );

	this.puid = this.computeLicenseCRC(p);
	this.puidCrc = (p ^ this.puid);
}
PalaceRegistration.prototype.computeLicenseCRC = function(v) {

	var CRCMask = [-337536108,1980030580,-470165935,1615844882,-393642964,-1379661536,
	938270647,860457453,674546491,-1949106667,-873463385,-1114195498,828255456,
	1326872708,-1534479946,-1524860318,1415718454,197138172,1759391010,1016934476,
	1157433083,-1145833614,-700981095,-2070238727,1596197256,-130597961,808947847,
	-948819868,-1331517885,-483303311,-1787826820,-1771072643,-1723486698,
	-256755762,573864352,-667576446,95296393,-479907182,-1018238451,647094210,
	-384540847,-643137739,-943442866,1131473825,507740990,1665912600,206627435,
	105455896,-141849602,1596701020,-1544858458,504734448,1824528519,-565283835,
	471692148,-2055897109,-479047298,-1684440633,-210237464,419000885,1683625115,
	-1789475121,-209120866,493666181,-1451881243,-1450850817,1598928244,320302252,
	789883525,-182418644,-769726185,1865448027,-1040514618,423711608,2038407875,
	619979905,1332030512,968622829,300786135,-1938185930,1809021574,-2135730962,
	-1004216218,-1428069337,1809038866,-2037543369,-774620076,1298270239,1127241431,
	-219886846,71288226,-1650094940,517354273,543661862,-1282783400,-2073814537,
	1809605458,-1410153907,1085028460,660112776,1578808037,1992157908,1900301618,
	50094212,-1831124485,-276382997,-136816854,-1218778433,-2065933165,-876529535,
	1679650419,213023385,-556570202,1635671546,613142846,-1202098842,-1690916358,
	1391308572,1013290884,342750617,278907624,-907196351,-1084670135,-917868941,
	1526336815,-1308405758,-894234364,2085575298,-355912136,1677480837,-552817146,
	652565475,690076088,-1207225336,-1854008451,310003900,-533625462,1914835927,
	767334138,1398403346,-1423613927,1848276334,1304833910,646460126,1501619576,
	-751258008,-287120169,536842182,-1692930800,-202981873,-1044734600,-1148808251,
	617971392,1566837485,-293103717,-1775092207,-860088831,243528763,741307541,
	1595214634,1896511458,672879068,595972156,1730386943,-1491474183,566475230,
	642292770,233212297,-898265331,1098812626,1743610360,-782254079,1000534642,
	1474492329,-417089405,-1857141791,1906989975,-51700767,2147110873,1738585236,
	1578923038,-926767642,-516186008,609375560,964336886,1037948118,-1239014580,
	971485261,919218079,-1985043577,-806799479,81884699,-1654518052,1855844839,
	1242947494,-733593172,964257641,1829119543,-110645451,-575364557,1212183168,
	-1443746178,-645427353,-1604633663,-389471366,-2117155522,1273314928,1613794910,
	-264378078,-1491947653,-1151244108,-865331787,790636405,809838563,-752107034,
	-1164607400,-1608551916,-957820528,-1416171189,409377156,1335075717,1077631808,
	1476875761,1507741928,-146378081,-9470649,-2145195468,-1303704627,-158881844,
	2123741875,-1916708803,189022185,-421243368,575501423,-217701189,-1220382120,
	-946988609,-772892506,1723759930,2032022575,1758177968,-1145752227,-1915055999,
	-601409828,1462982061,-1006637979,-377552272,-962435608,-640380590,1270045659,
	-1580745754,363030938,-425845067,2094900240,1216743903,-778667821,0];

	var crc = this.CRC_MAGIC;
	var p = Buffer.alloc(4);
	p.writeIntBE(v,0,4);

	for (var i = 0; i < 4; i++) {
		if ((crc & 0x80000000) == 0) {
			crc = (crc << 1) ^ CRCMask[p.readUInt8(i)];
		} else {
			crc = ((crc << 1) + 1) ^ CRCMask[p.readUInt8(i)];
		}
	}

	return crc;
};





function PalaceCrypt() {
	this.gSeed = 1;
	var saveSeed = this.gSeed;
	this.MySRand(666666);

	this.gEncryptTable = new Array(512);
	for (var i = 0; i < 512; i++)
		this.gEncryptTable[i] = (this.MyRandom(256) & 0xff);

	this.MySRand(saveSeed);
}
PalaceCrypt.prototype.R_A = 16807;
PalaceCrypt.prototype.R_M = 2147483647;
PalaceCrypt.prototype.R_Q = 127773;
PalaceCrypt.prototype.R_R = 2836;
PalaceCrypt.prototype.Encrypt = function(b) {
	if (b == null || b.length == 0) return '';
	var rc = 0;
	var lastChar = 0;
	var i = b.length;
	while(i--) {
		b.writeUInt8(b.readUInt8(i)^(this.gEncryptTable[rc]^lastChar),i);
		lastChar = b.readUInt8(i)^this.gEncryptTable[rc+1];
		rc += 2;
	}
	return b;
};
PalaceCrypt.prototype.Decrypt = function(b) {
	if (b == null || b.length == 0) return '';

	var rc = 0;
	var tmp = 0;
	var lastChar = 0;
	var i = b.length;
	while(i--) {
		tmp = b.readUInt8(i);
		b.writeUInt8(tmp^(this.gEncryptTable[rc]^lastChar),i);
		lastChar = tmp^this.gEncryptTable[rc+1];
		rc += 2;
	}
	return windows1252.decode(b.toString('binary'));
};
PalaceCrypt.prototype.LongRandom = function() {
	var hi = (this.gSeed / this.R_Q) & 0xffffffff;
	var lo = (this.gSeed % this.R_Q) & 0xffffffff;
	var test = (this.R_A * lo - this.R_R * hi) & 0xffffffff;

	if (test > 0) {
		this.gSeed = test;
	} else {
		this.gSeed = test + this.R_M;
	}
	return this.gSeed;
};
PalaceCrypt.prototype.MyRandom = function(max) {
	return (this.LongRandom() / this.R_M) * max;
};
PalaceCrypt.prototype.MySRand = function(s) {
	this.gSeed = s;
	if (this.gSeed == 0) this.gSeed = 1;
};


var crypt = new PalaceCrypt();
var regi = new PalaceRegistration(prefs.registration.regi,prefs.registration.puid);
gotourl(getGeneralPref('home'));
