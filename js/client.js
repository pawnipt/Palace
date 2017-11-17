// @flow

var net = require('net');

class PalaceProtocol {
	constructor(regi,puid) {
		this.crypt = new PalaceCrypt(1);
		this.regi = new PalaceRegistration(regi,puid);
		this.soc = new net.Socket(); // node socket
		this.soc.on('connect', function() {logmsg('Connected');});
		this.soc.on('data', (data) => this.onData(data));
		this.soc.on('error', (err) => this.onError(err));
	}

	static toArrayBuffer(b) { // node buffer to ArrayBuffer
		return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
	}
	static pString(b,offset) {
		return palace.textDecoding.decode(
			PalaceProtocol.toArrayBuffer(
				b.slice(offset+1,offset+1+b.readUInt8(offset))
			)
		);
	}
	static cString(b,offset) {
		return palace.textDecoding.decode(
			PalaceProtocol.toArrayBuffer(
				b.slice(offset,b.indexOf(0,offset))
			)
		);
	}

	connect(ip,port) {
		this.textDecoding = new TextDecoder('windows-1252'); // default server encoding
		this.textEncoding = new TextEncoder('windows-1252', { NONSTANDARD_allowLegacyEncoding: true }); // palace default! :\
		if (!port) port = '9998';
		this.ip = ip;
		this.port = port;
		this.buffer = Buffer.alloc(0);
		this.connecting();
		this.soc.connect(port, ip);
	}

	onData(data) {
		this.buffer = Buffer.concat([this.buffer, data]);
		do {
			if (this.buffer.length < 8) break;
			var packetLength = this.buffer.readInt32LE(4) + 12;
			if (this.buffer.length < packetLength) break;
			this.packetReceived(this.buffer.slice(0,packetLength));
			this.buffer = this.buffer.slice(packetLength,this.buffer.length);
		} while (this.buffer.length > 0);
	}

	onError(err) {
		if (err.code = 'ECONNRESET') {
			if (!this.retryRegistration) { //part of pserver security plugin to work around local proxies like pdrug.
				this.retryRegistration = true;
				this.buffer = Buffer.alloc(0);
				this.soc.connect(this.port,this.ip);
			}
		} else {
			logmsg('Socket error: ' + err);
		}
	}

	packetReceived(buffer) {
		var packet = {type:buffer.readInt32LE(0),
					reference:buffer.readInt32LE(8), // reference is sub identifier; usually a user ID
					data:buffer};

		switch(packet.type) {
			case TCPmsgConsts.USERMOVE:
				this.parseUserMove(packet);
				break;
			case TCPmsgConsts.USERFACE:
				this.parseUserFace(packet);
				break;
			case TCPmsgConsts.USERCOLOR:
				this.parseUserColor(packet);
				break;
			case TCPmsgConsts.USERPROP:
				this.parseUserProp(packet);
				break;
			case TCPmsgConsts.USERDESC:
				this.parseUserDesc(packet);
				break;
			case TCPmsgConsts.DRAW:
				this.parseDrawing(packet);
				break;
			case TCPmsgConsts.XWHISPER:
				this.parseXwhisper(packet);
				break;
			case TCPmsgConsts.XTALK:
				this.parseXtalk(packet);
				break;
			case TCPmsgConsts.TALK:
				this.parseTalk(packet);
				break;
			case TCPmsgConsts.WHISPER:
				this.parseWhisper(packet);
				break;
			case TCPmsgConsts.USEREXIT:
				this.parseUserExit(packet);
				break;
			case TCPmsgConsts.USERNEW:
				this.parseUser(packet);
				break;
			case TCPmsgConsts.USERLOG:
				this.parseUserLog(packet);
				break;
			case TCPmsgConsts.LOGOFF:
				this.parseLogOff(packet);
				break;
			case TCPmsgConsts.USERNAME:
				this.parseUserName(packet);
				break;
			case TCPmsgConsts.TIYID:
				this.sendRegistration();
				break;
			case TCPmsgConsts.HTTPSERVER:
				this.parseHttpServer(packet);
				break;
			case TCPmsgConsts.SPOTMOVE:
				this.parseSpotMove(packet);
				break;
			case TCPmsgConsts.PICTMOVE:
				this.parsePicMove(packet);
				break;
			case TCPmsgConsts.SPOTSTATE:
				this.parseSpotState(packet);
				break;
			case TCPmsgConsts.DOORLOCK:
				this.parseDoorLock(packet);
				break;
			case TCPmsgConsts.DOORUNLOCK:
				this.parseDoorUnlock(packet);
				break;
			case TCPmsgConsts.ROOMSETDESC:
			case TCPmsgConsts.ROOMDESC:
				this.parseRoom(packet);
				break;
			case TCPmsgConsts.NAVERROR:
				this.parseNavError(packet);
				break;
			case TCPmsgConsts.LISTOFALLROOMS:
				this.parseRoomList(packet);
				break;
			case TCPmsgConsts.LISTOFALLUSERS:
				this.parseUserList(packet);
				break;
			case TCPmsgConsts.PROPDEL:
				this.parsePropDelete(packet);
				break;
			case TCPmsgConsts.PROPNEW:
				this.parsePropNew(packet);
				break;
			case TCPmsgConsts.PROPMOVE:
				this.parsePropMove(packet);
				break;
			case TCPmsgConsts.USERSTATUS:
				this.parseUserStatus(packet);
				break;
			case TCPmsgConsts.SERVERINFO:
				this.parseServerInfo(packet);
				break;
			case TCPmsgConsts.USERLIST:
				this.parseUsers(packet);
				break;
			case TCPmsgConsts.PING:
				this.sendPong();
				break;
			case TCPmsgConsts.BLOWTHRU:
				this.parseBlowThru(packet);
				break;
			case TCPmsgConsts.ASSETQUERY:
			case TCPmsgConsts.ALTLOGONREPLY:
			case TCPmsgConsts.ROOMDESCEND:
			case TCPmsgConsts.EXTENDEDINFO:
			case TCPmsgConsts.VERSION:
				//trash
				break;
			default:
				console.log('unhandled packet: '+packet.slice(0,4));
				break;
		}
	}

	parseBlowThru(p) {
		if (p.data.readInt32LE(8) == 0x4f434e45) { // pserver plugin that sets encoding for the server
			var encoding = p.data.toString('binary',12,p.data.readInt32LE(4) + 12);
			this.textDecoding = new TextDecoder(encoding);
			this.textEncoding = new TextEncoder(encoding, { NONSTANDARD_allowLegacyEncoding: true });
		}
	}

	parseSpotMove(p) {
		p.data = {roomid:p.data.readInt16LE(12),
			spotid:p.data.readInt16LE(14),
			x:p.data.readInt16LE(18),
			y:p.data.readInt16LE(16)};
		this.passData(p);
	}

	parsePicMove(p) {
		p.data = {roomid:p.data.readInt16LE(12),
			spotid:p.data.readInt16LE(14),
			x:p.data.readInt16LE(18),
			y:p.data.readInt16LE(16)};
		this.passData(p);
	}

	parseSpotState(p) {
		p.data = {roomid:p.data.readInt16LE(12),
			spotid:p.data.readInt16LE(14),
			state:p.data.readInt16LE(16),
			lock:null};
		this.passData(p);
	}

	parseDoorLock(p) {
		p.data = {roomid:p.data.readInt16LE(12),
			spotid:p.data.readInt16LE(14),
			state:1,
			lock:true};
		this.passData(p);
	}

	parseDoorUnlock(p) {
		p.data = {roomid:p.data.readInt16LE(12),
			spotid:p.data.readInt16LE(14),
			state:0,
			lock:false};
		this.passData(p);
	}

	parseHttpServer(p) {
		p.data = PalaceProtocol.cString(p.data,12).replace(/\/?$/, '/'); // make sure it ends with a forward slash!
		this.passData(p);
	}

	parseRoom(p) {
		var readPointer = function(b,offset) {
			return b.readInt16LE(offset)+52;
		};
		var roomPstring = function(b,offset) {
			return PalaceProtocol.pString(b,readPointer(b,offset));
		};

		var room = {id:p.data.readInt16LE(20),
					flags:p.data.readInt32LE(12),
					name:roomPstring(p.data,22),
					artist:roomPstring(p.data,26),
					background:roomPstring(p.data,24),
					password:'',
					looseProps:[],
					spots:[],
					pictures:[],
					draws:[]};


		var nxt = readPointer(p.data,46);
		var count = p.data.readInt16LE(44);
		for (var i = 0; i < count; i++) {
			room.looseProps.push({y:p.data.readInt16LE(nxt+20),
				x:p.data.readInt16LE(nxt+22),
				id:p.data.readInt32LE(nxt+4)});
			nxt = readPointer(p.data,nxt);
		}

		nxt = readPointer(p.data,32);
		count = p.data.readInt16LE(30);

		for (var i = 0; i < count; i++) { //hotspots aka doors
			var flags = p.data.readInt32LE(nxt+4);
			var spot = {flags:flags,
							layer:(flags & 0x00000004 || flags & 0x00000040 || flags & 0x00000001)?1:0,
							y:p.data.readInt16LE(nxt+16),
							x:p.data.readInt16LE(nxt+18),
							id:p.data.readInt16LE(nxt+20),
							dest:p.data.readInt16LE(nxt+22),
							type:p.data.readInt16LE(nxt+28),
							state:p.data.readInt16LE(nxt+36),
							name:roomPstring(p.data,nxt+42),
							script:PalaceProtocol.cString(p.data,readPointer(p.data,nxt+44)),
							points:[],
							statepics:[]};

			var ptsCount = p.data.readInt16LE(nxt+24);
			var ptsOffset = readPointer(p.data,nxt+26);
			for (var j = 0; j < ptsCount; j++) {
				spot.points.push(p.data.readInt16LE(ptsOffset+2));
				spot.points.push(p.data.readInt16LE(ptsOffset));
				ptsOffset += 4;
			}

			var nbrStates = p.data.readInt16LE(nxt+38);
			var stateRecOfst = readPointer(p.data,nxt+40);
			for (var j = 0; j < nbrStates; j++) {
				spot.statepics.push({id:p.data.readInt16LE(stateRecOfst),
										x:p.data.readInt16LE(stateRecOfst+6),
										y:p.data.readInt16LE(stateRecOfst+4)});
				stateRecOfst += 8;
			}

			room.spots.push(spot);
			nxt += 48;
		}

		var nbrPics = p.data.readInt16LE(34);
		var picOffset = readPointer(p.data,36);
		for (var i = 0; i < nbrPics; i++) {
			room.pictures.push({name:roomPstring(p.data,picOffset+6),
				id:p.data.readInt16LE(picOffset+4),
				trans:p.data.readInt16LE(picOffset+8)});
			picOffset += 12;
		}

		nxt = readPointer(p.data,40);

		room.draws = [];
		var nbrDraws = p.data.readInt16LE(38);
		for (var i = 0; i < nbrDraws; i++) {
			var pos = readPointer(p.data,nxt+8);
			room.draws.push(PalaceProtocol.parseDraw( p.data.slice(pos,p.data.readInt16LE(nxt+6)+pos) , p.data.readInt16LE(nxt+4)));
			nxt = readPointer(p.data,nxt);
		}

		p.data = room;
		this.passData(p);
	}

	parseNavError(p) {
		p.data = p.reference;
		this.passData(p);
	}

	parseRoomList(p) {
		var list = [];
		var count = p.data.readInt32LE(8);
		var add = 12;
		for (var i = 0; i < count; i++) {
			var nameLen = p.data.readInt8(add+8);
			list.push({name:palace.textDecoding.decode(PalaceProtocol.toArrayBuffer(p.data.slice(add+9,add+9+nameLen))),
							id:p.data.readInt32LE(add),
							flags:p.data.readInt16LE(add+4),
							population:p.data.readInt16LE(add+6)});
			add = add+9+((nameLen + ( 4 - (nameLen & 3))) - 1);
		}
		p.data = list;
		this.passData(p);
	}

	parseUserList(p) {
		var list = [];
		var count = p.data.readInt32LE(8);
		var add = 12;
		for (var i = 0; i < count; i++) {
			var nameLen = p.data.readInt8(add+8);
			list.push({name:palace.textDecoding.decode(PalaceProtocol.toArrayBuffer(p.data.slice(add+9,add+9+nameLen))),
							userid:p.data.readInt32LE(add),
							flags:p.data.readInt16LE(add+4),
							roomid:p.data.readInt16LE(add+6)});
			add = add+9+((nameLen + ( 4 - (nameLen & 3))) - 1);
		}
		p.data = list;
		this.passData(p);
	}

	parsePropDelete(p) {
		p.data = p.data.readInt32LE(12);
		this.passData(p);
	}
	parsePropNew(p) {
		p.data = {x:p.data.readInt16LE(22),
			y:p.data.readInt16LE(20),
			id:p.data.readInt32LE(12),
			crc:p.data.readInt32LE(16)};
		this.passData(p);
	}
	parsePropMove(p) {
		p.data = {x:p.data.readInt16LE(18),
			y:p.data.readInt16LE(16),
			index:p.data.readInt32LE(12)};
		this.passData(p);
	}

	parseUserStatus(p) {
		p.data = {id:p.reference,
			status:p.data.readInt16LE(12)};
		this.passData(p);
	}

	parseServerInfo(p) {
		p.data = {flags:p.data.readInt32LE(12),
			name:PalaceProtocol.pString(p.data,16)};
		this.passData(p);
	}


	parseUserFace(p) {
		p.data = {id:p.reference,
			face:p.data.readInt16LE(12)};
		this.passData(p);
	}
	parseUserColor(p) {
		p.data = {id:p.reference,
			color:p.data.readInt16LE(12)};
		this.passData(p);
	}
	parseUserProp(p) {
		p.data = {id:p.reference,
			props:PalaceProtocol.buffer2Props(p.data.slice(16,p.data.length))};
		this.passData(p);
	}
	parseUserDesc(p) {
		p.data = {id:p.reference,
			face:p.data.readInt16LE(12),
			color:p.data.readInt16LE(14),
			props:PalaceProtocol.buffer2Props(p.data.slice(20,p.data.length))};
		this.passData(p);
	}

	parseUserName(p) {
		p.data = {id:p.reference,
			name:PalaceProtocol.pString(p.data,12)};
		this.passData(p);
	}

	parseUserLog(p) {
		p.data = {id:p.reference,
			count:p.data.readInt32LE(12)};
		this.passData(p);
	}

	parseLogOff(p) {
		p.data = {id:p.reference,
			count:p.data.readInt32LE(12)};
		this.passData(p);
	}

	parseUserMove(p) {
		p.data = {id:p.reference,
			x:p.data.readInt16LE(14),
			y:p.data.readInt16LE(12)};
		this.passData(p);
	}

	parseWhisper(p) {
		p.data = {id:0,
			chatstr:PalaceProtocol.cString(p.data,12),
			whisper:true};
		this.passData(p);
	}

	parseTalk(p) {
		p.data = {id:p.reference,
			chatstr:PalaceProtocol.cString(p.data,12),
			whisper:false};
		this.passData(p);
	}

	parseXtalk(p) {
		p.data = {id:p.reference,
			chatstr:this.crypt.Decrypt(p.data.slice(14,14+p.data.readInt16LE(12)-3)),
			whisper:false};
		this.passData(p);
	}

	parseXwhisper(p) {
		p.data = {id:p.reference,
			chatstr:this.crypt.Decrypt(p.data.slice(14,14+p.data.readInt16LE(12)-3)),
			whisper:true};
		this.passData(p);
	}

	parseUserExit(p) {
		p.data = {id:p.reference,
			logoff:false};
		this.passData(p);
	}

	parseDrawing(p) {
		p.data = PalaceProtocol.parseDraw(p.data.slice(22,p.data.length),p.data.readUInt16LE(16));
		this.passData(p);
	}

	parseUser(p) {
	  var user = {name:PalaceProtocol.pString(p.data,104),
					id:p.reference,
					x:p.data.readInt16LE(18),
					y:p.data.readInt16LE(16),
					color:p.data.readInt16LE(96),
					face:p.data.readInt16LE(94),
					props:[]};

		var nbrProps = p.data.readInt16LE(102);
		for (var j = 0; j < nbrProps; j++) {
			user.props.push(p.data.readInt32LE(20+(j*8)));
		}

		p.data = user;
		this.passData(p);
	}

	parseUsers(p) {
		var users = [];
		var uOffset = 12;
		var count = p.reference;
		for (var i = 0; i < count; i++) {
			var user = {name:PalaceProtocol.pString(p.data,uOffset+92),
						id:p.data.readInt32LE(uOffset),
						x:p.data.readInt16LE(uOffset+6),
						y:p.data.readInt16LE(uOffset+4),
						color:p.data.readInt16LE(uOffset+84),
						face:p.data.readInt16LE(uOffset+82),
						props:[]};

			var nbrProps = p.data.readInt16LE(90+uOffset);
			for (var j = 0; j < nbrProps; j++)
				user.props.push(p.data.readInt32LE(8+uOffset+(j*8)));

			users.push(user);
			uOffset += 124;
		}

		p.data = users;
		this.passData(p);
	}



	static buffer2Props(b) {
		var props = [];
		for (var i = 0; i < b.length-1; i += 8)
			props.push(b.readInt32LE(i));
		return props;
	}


	static parseDraw(cmdData,type) { // one old hack of a packet

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

				var font = PalaceProtocol.pString(cmdData,19);
				var aLen = font.length;
				jdraw.font = font;
				var msg = PalaceProtocol.cString(cmdData,20+aLen); //must define utf8!
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




	sendDraw(draw) {

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

		this.soc.write(packet);
	}

	sendDrawClear(drawCmd) {
		var packet = Buffer.alloc(22);
		packet.writeInt32LE(TCPmsgConsts.DRAW,0);
		packet.writeInt32LE(10,4);
		packet.writeInt16LE(drawCmd,16);
		this.soc.write(packet);
	}

	sendUnlockRoom(spotid) {
		var packet = Buffer.alloc(16);
		packet.writeInt32LE(TCPmsgConsts.DOORUNLOCK,0);
		packet.writeInt32LE(4,4);
		packet.writeInt16LE(this.theRoom.id,12);
		packet.writeInt16LE(spotid,14);
		this.soc.write(packet);
	}

	sendLockRoom(spotid) {
		var packet = Buffer.alloc(16);
		packet.writeInt32LE(TCPmsgConsts.DOORLOCK,0);
		packet.writeInt32LE(4,4);
		packet.writeInt16LE(this.theRoom.id,12);
		packet.writeInt16LE(spotid,14);
		this.soc.write(packet);
	}

	sendOperatorRequest(password) {
		password = Buffer.from(this.textEncoding.encode(password));
		var leng = password.length;
		var packet = Buffer.alloc(13+leng);
		packet.writeInt32LE(TCPmsgConsts.SUPERUSER,0);
		packet.writeInt32LE(leng+1,4);
		var data = this.crypt.Encrypt(password);
		packet.writeInt8(data.length,12);
		data.copy(packet,13);
		this.soc.write(packet);
	}

	sendPong() {
		var packet = Buffer.alloc(12);
		packet.writeInt32LE(TCPmsgConsts.PONG,0);
		this.soc.write(packet);
	}

	sendWhisper(msg,whisperID) {
		msg = Buffer.from(this.textEncoding.encode(msg));
		var leng = msg.length;
		var packet = Buffer.alloc(19+leng);
		packet.writeInt32LE(TCPmsgConsts.XWHISPER,0);
		packet.writeInt32LE(leng+7,4);
		packet.writeInt32LE(whisperID,12);
		packet.writeInt16LE(leng+3,16);
		this.crypt.Encrypt(msg).copy(packet,18);
		this.soc.write(packet);
	}

	sendXtlk(msg) {
		msg = Buffer.from(this.textEncoding.encode(msg));
		var leng = msg.length;
		var packet = Buffer.alloc(15+leng);
		packet.writeInt32LE(TCPmsgConsts.XTALK,0);
		packet.writeInt32LE(leng+3,4);
		packet.writeInt16LE(leng+3,12);
		this.crypt.Encrypt(msg).copy(packet,14);
		this.soc.write(packet);
	}

	sendRoomNav(id) {
		var packet = Buffer.alloc(14);
		packet.writeInt32LE(TCPmsgConsts.ROOMGOTO,0);
		packet.writeInt32LE(2,4);
		packet.writeInt16LE(id,12);
		this.soc.write(packet);
	}

	sendRoomListRequest() {
		var packet = Buffer.alloc(12);
		packet.writeInt32LE(TCPmsgConsts.LISTOFALLROOMS,0);
		this.soc.write(packet);
	}

	sendUserListRequest() {
		var packet = Buffer.alloc(12);
		packet.writeInt32LE(TCPmsgConsts.LISTOFALLUSERS,0);
		this.soc.write(packet);
	}

	sendPropDress(props) {
		var length = props.length;
		var packet = Buffer.alloc(16+length*8);

		packet.writeInt32LE(TCPmsgConsts.USERPROP,0);
		packet.writeInt32LE(length*8+4,4);
		packet.writeInt32LE(length,12);
		for (var i = 0; i < length; i++)
			packet.writeInt32LE(props[i],16+i*8);

		this.soc.write(packet);
	}

	sendPropDrop(x,y,id) {
		var packet = Buffer.alloc(24);
		packet.writeInt32LE(TCPmsgConsts.PROPNEW,0);
		packet.writeInt32LE(12,4);
		packet.writeInt32LE(id,12);
		packet.writeInt16LE(y,20);
		packet.writeInt16LE(x,22);
		this.soc.write(packet);
	}

	sendPropMove(x,y,index) {
		var packet = Buffer.alloc(20);
		packet.writeInt32LE(TCPmsgConsts.PROPMOVE,0);
		packet.writeInt32LE(8,4);
		packet.writeInt32LE(index,12);
		packet.writeInt16LE(y,16);
		packet.writeInt16LE(x,18);
		this.soc.write(packet);
	}

	sendPropDelete(index) {
		var packet = Buffer.alloc(16);
		packet.writeInt32LE(TCPmsgConsts.PROPDEL,0);
		packet.writeInt32LE(4,4);
		packet.writeInt32LE(index,12);
		this.soc.write(packet);
	}

	sendUserLocation(x,y) {
		var packet = Buffer.alloc(16);
		packet.writeInt32LE(TCPmsgConsts.USERMOVE,0);
		packet.writeInt32LE(4,4);
		packet.writeInt16LE(y,12);
		packet.writeInt16LE(x,14);
		this.soc.write(packet);
	}

	sendUserName(name) {
		name = Buffer.from(this.textEncoding.encode(name));
		var packet = Buffer.alloc(name.length+13);
		packet.writeInt32LE(TCPmsgConsts.USERNAME,0);
		packet.writeInt32LE(name.length+1,4);
		packet.writeInt8(name.length,12);
		name.copy(packet,13);
		this.soc.write(packet);
	}

	sendFace(face) {
		var packet = Buffer.alloc(14);
		packet.writeInt32LE(TCPmsgConsts.USERFACE,0);
		packet.writeInt32LE(2,4);
		packet.writeInt16LE(face,12);
		this.soc.write(packet);
	}

	sendFaceColor(color) {
		var packet = Buffer.alloc(14);
		packet.writeInt32LE(TCPmsgConsts.USERCOLOR,0);
		packet.writeInt32LE(2,4);
		packet.writeInt16LE(color,12);
		this.soc.write(packet);
	}

	sendRegistration() {
		var reg =  Buffer.alloc(140);
		reg.writeInt32LE(TCPmsgConsts.LOGON,0);
		reg.writeInt32LE(128,4); //fixed packet length

		reg.writeInt32LE(this.regi.key,12);
		reg.writeInt32LE(this.regi.crc,16);

		var name = Buffer.from(this.textEncoding.encode(prefs.general.userName));
		reg.writeInt8(name.length,20);
		name.copy(reg,21);//should truncate to 31 bytes max

		if (/^win/.test(process.platform)) { //add linux/unix identifier.
			reg.writeUInt32LE(0x80000004,84); //must validate since value is
		} else {
			reg.writeUInt32LE(0x80000002,84);
		}

		reg.writeInt32LE(this.regi.puidCrc,88);
		reg.writeInt32LE(this.regi.puid,92);

		reg.writeInt32LE(0x00011940,96);
		reg.writeInt32LE(0x00011940,100);
		reg.writeInt32LE(0x00011940,104);
		//reg.writeInt16LE(0,108); //optional room ID to land in (if server allows it)
		reg.write('PC5'+remote.app.getVersion().replace(/\./g, ''),110,6);

		reg.writeInt32LE(0x00000041,120);
		if (this.retryRegistration) {
			reg.writeInt32LE(0x00000111,124); //original value required by a security pserver plugin
		} else {
			reg.writeInt32LE(0x00000151,124); //a protocol required by a different security pserver plugins
		}
		reg.writeInt32LE(0x00000001,128);
		reg.writeInt32LE(0x00000001,132);

		this.soc.write(reg);
	}
}

class PalaceClient extends PalaceProtocol {
	constructor(regi,puid) {
		super(regi,puid);
	}

	connecting() {
		this.serverDown();
		setEnviornment(window.innerWidth-logField.offsetWidth,window.innerHeight-45-document.getElementById('chatbox').offsetHeight,'');
		toggleLoadingBG(true);
		setUserInterfaceAvailability(true);
	}

	serverDown(msg) { // still gotta implement this in the protocol lol
		this.mediaUrl = "";
		allProps = {};
		this.lastUserLogOnTime = 0;
		this.lastUserLogOnID = 0;
		this.serverUserCount = 0;
		this.theUser = null;
		this.theUserID = null;
		this.roomList = null;
		this.userList = null;
		this.lastLoadedBG = '';
		PalaceRoom.removeAllSpotPics();

		Bubble.deleteAllBubbles();
		unloadBgVideo();
		if (this.theRoom) {
			this.theRoom.stopAllUserAnimations();
			//delete this.theRoom;
			this.theRoom.spots = [];
			this.theRoom.draws = [];
			this.theRoom.looseProps = [];
			this.theRoom.pics = [];
			this.theRoom.users = [];
			this.theRoom.refresh();
		}

		if (msg) {
			bgError(true);
			logmsg(msg.msg);
		}

	}

	serverInfo(info) {
		this.servername = info.name;
		this.serverflags = info.flags;
		var addressBar = document.getElementById('palaceserver');
		addressBar.title = info.name;
		if (addressBar != document.activeElement) addressBar.innerText = this.servername;
	}




	userLogOn(info) {
		this.lastUserLogOnID = info.id;
		this.lastUserLogOnTime = ticks();
		this.serverUserCount = info.count;
		if (this.theRoom) this.theRoom.setUserCount();
	}
	userLogOff(info) {
		this.serverUserCount = info.count;
		if (this.theRoom) {
			if (this.theRoom.removeUser(info.id,true) && !prefs.general.disableSounds) systemAudio.signoff.play();
			this.theRoom.setUserCount();
		}
	}

	addSelfProp(pid) {
		if (this.theUser && this.theUser.props.length < 9 && this.theUser.props.indexOf(pid) == -1) {
			this.theUser.propsChanged = true;
			this.theUser.props.push(pid);
			this.theUser.animator();
			this.theRoom.reDraw();
			return true;
		}
	}

	removeSelfProp(pid) {
		if (this.theUser) {
			var i = this.theUser.props.indexOf(pid);
			if (this.theUser.props.length > 0 && i > -1) {
				this.theUser.propsChanged = true;
				this.theUser.props.splice(i,1);
				this.theUser.animator();
				this.theRoom.reDraw();
				return true;
			}
		}
	}

	selfPropChange() {
		if (this.theUser) {
			this.sendPropDress(this.theUser.props);
		}
		this.theUser.propsChanged = false;
		enablePropButtons();
	}

	passData(p) {
		//console.log(p);
		switch(p.type) {
			case TCPmsgConsts.TALK:
			case TCPmsgConsts.WHISPER:
			case TCPmsgConsts.XWHISPER:
			case TCPmsgConsts.XTALK:
				this.theRoom.userChat(p.data);
				break;
			case TCPmsgConsts.USERMOVE:
				this.theRoom.userMove(p.data);
				break;
			case TCPmsgConsts.USERFACE:
				this.theRoom.userFaceChange(p.data);
				break;
			case TCPmsgConsts.USERCOLOR:
				this.theRoom.userColorChange(p.data);
				break;
			case TCPmsgConsts.USERPROP:
				this.theRoom.userPropChange(p.data);
				break;
			case TCPmsgConsts.USERDESC:
				this.theRoom.userAvatarChange(p.data);
				break;
			case TCPmsgConsts.USERNAME:
				this.theRoom.userNameChange(p.data);
				break;
			case TCPmsgConsts.DRAW:
				this.theRoom.draw(p.data);
				break;
			case TCPmsgConsts.USERLOG:
				this.userLogOn(p.data);
				break;
			case TCPmsgConsts.LOGOFF:
				this.userLogOff(p.data);
				break;
			case TCPmsgConsts.USEREXIT:
				this.theRoom.removeUser(p.data);
				break;
			case TCPmsgConsts.USERNEW:
				this.theRoom.addUser(p.data);
				break;
			case TCPmsgConsts.HTTPSERVER:
				this.mediaUrl = p.data;
				break;
			case TCPmsgConsts.SPOTMOVE:
				this.theRoom.spotMove(p.data);
				break;
			case TCPmsgConsts.PICTMOVE:
				this.theRoom.spotMovePic(p.data);
				break;
			case TCPmsgConsts.SPOTSTATE:
				this.theRoom.spotStateChange(p.data);
				break;
			case TCPmsgConsts.DOORLOCK:
				this.theRoom.spotStateChange(p.data);
				break;
			case TCPmsgConsts.DOORUNLOCK:
				this.theRoom.spotStateChange(p.data);
				break;
			case TCPmsgConsts.ROOMSETDESC:
			case TCPmsgConsts.ROOMDESC:
				var users;
				if (this.theRoom && this.theRoom.users) users = this.theRoom.users; // if editing room, god save the people!
				this.theRoom = new PalaceRoom(p.data);
				this.theRoom.users = users;
				if (users) this.theRoom.refresh();
				break;
			case TCPmsgConsts.NAVERROR:
				this.theRoom.navigationError(p.data);
				break;
			case TCPmsgConsts.LISTOFALLROOMS:
				loadRoomList(p.data);
				break;
			case TCPmsgConsts.LISTOFALLUSERS:
				loadUserList(p.data);
				break;
			case TCPmsgConsts.PROPDEL:
				this.theRoom.loosePropDelete(p.data);
				break;
			case TCPmsgConsts.PROPNEW:
				this.theRoom.loosePropAdd(p.data);
				break;
			case TCPmsgConsts.PROPMOVE:
				this.theRoom.loosePropMove(p.data);
				break;
			case TCPmsgConsts.USERSTATUS:
				this.theUserID = p.data.id;
				this.theUserStatus = p.data.status;
				break;
			case TCPmsgConsts.SERVERINFO:
				this.serverInfo(p.data);
				break;
			case TCPmsgConsts.USERLIST:
				this.theRoom.loadUsers(p.data);
				break;
			default:
				console.log(p);
				break;
		}
	}

}





class PalaceRegistration {
	constructor(seed,p) {
		this.key = this.computeLicenseCRC(seed);
		this.crc = ( ( seed ^ PalaceRegistration.MAGIC_LONG ) ^ this.key );
		this.puid = this.computeLicenseCRC(p);
		this.puidCrc = (p ^ this.puid);
	}

	static get CRC_MAGIC() { return 0xa95ade76; }
	static get MAGIC_LONG() { return 0x9602c9bf; }
	//static get OBFUSCATE_LONG() { return 0xD7AA3702; }

	static get CRCMask() {
		return [-337536108,1980030580,-470165935,1615844882,-393642964,-1379661536,
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
	}

	computeLicenseCRC(v) {
		var mask = PalaceRegistration.CRCMask;
		var crc = PalaceRegistration.CRC_MAGIC;
		var p = Buffer.alloc(4);
		p.writeIntBE(v,0,4);
		for (var i = 0; i < 4; i++) {
			if ((crc & 0x80000000) == 0) {
				crc = (crc << 1) ^ mask[p.readUInt8(i)];
			} else {
				crc = ((crc << 1) + 1) ^ mask[p.readUInt8(i)];
			}
		}
		return crc;
	}

}





class PalaceCrypt {
	constructor(seed) {
		this.gSeed = seed;
		this.MySRand(666666);
		this.gEncryptTable = new Array(512);
		for (var i = 0; i < 512; i++) {
			this.gEncryptTable[i] = (this.MyRandom(256) & 0xff);
		}
		this.MySRand(seed);
	}

	static get R_A() { return 16807; }
	static get R_M() { return 2147483647; }
	static get R_Q() { return 127773; }
	static get R_R() { return 2836; }

	Encrypt(b) {
		if (b == null || b.length == 0) return '';
		var rc = 0,lastChar = 0,i = b.length;
		while(i--) {
			b.writeUInt8(b.readUInt8(i)^(this.gEncryptTable[rc]^lastChar),i);
			lastChar = b.readUInt8(i)^this.gEncryptTable[rc+1];
			rc += 2;
		}
		return b;
	}

	Decrypt(b) {
		if (b == null || b.length == 0) return '';
		var rc = 0,tmp = 0,lastChar = 0,i = b.length;
		while(i--) {
			tmp = b.readUInt8(i);
			b.writeUInt8(tmp^(this.gEncryptTable[rc]^lastChar),i);
			lastChar = tmp^this.gEncryptTable[rc+1];
			rc += 2;
		}
		return palace.textDecoding.decode(PalaceProtocol.toArrayBuffer(b));
	}

	get LongRandom() {
		var hi = (this.gSeed / PalaceCrypt.R_Q) & 0xffffffff;
		var lo = (this.gSeed % PalaceCrypt.R_Q) & 0xffffffff;
		var test = (PalaceCrypt.R_A * lo - PalaceCrypt.R_R * hi) & 0xffffffff;

		if (test > 0) {
			this.gSeed = test;
		} else {
			this.gSeed = test + PalaceCrypt.R_M;
		}
		return this.gSeed;
	}

	MyRandom(max) {
		return (this.LongRandom / PalaceCrypt.R_M) * max;
	}

	MySRand(s) {
		this.gSeed = s;
		if (this.gSeed == 0) this.gSeed = 1;
	}
}
