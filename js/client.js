// @flow

const	MSG_ASSETNEW = 0x61417374,
		MSG_ASSETQUERY = 0x71417374,
		MSG_ASSETREGI = 0x72417374,
		MSG_ASSETSEND = 0x73417374,
		MSG_AUTHENTICATE = 0x61757468,
		MSG_AUTHRESPONSE = 0x61757472,
		MSG_DISPLAYURL = 0x6475726c,
		MSG_DOORLOCK = 0x6c6f636b,
		MSG_DOORUNLOCK = 0x756e6c6f,
		MSG_DRAW = 0x64726177,
		MSG_EXTENDEDINFO = 0x73496e66,
		MSG_FILENOTFND = 0x666e6665,
		MSG_FILEQUERY = 0x7146696c,
		MSG_FILESEND = 0x7346696C,
		MSG_GMSG = 0x676d7367,
		MSG_HTTPSERVER = 0x48545450,
		MSG_KILLUSER = 0x6b696c6c,
		MSG_LISTOFALLROOMS = 0x724c7374,
		MSG_LISTOFALLUSERS = 0x754c7374,
		MSG_LOGOFF = 0x62796520,
		MSG_LOGON = 0x72656769,
		MSG_NAVERROR = 0x73457272,
		MSG_PICTMOVE = 0x704c6f63,
		MSG_PING = 0x70696e67,
		MSG_PONG = 0x706f6e67,
		MSG_PROPDEL = 0x64507270,
		MSG_PROPMOVE = 0x6d507270,
		MSG_PROPNEW = 0x6e507270,
		MSG_RMSG = 0x726d7367,
		MSG_ROOMDESC = 0x726f6f6d,
		MSG_ROOMDESCEND = 0x656e6472,
		MSG_ROOMGOTO = 0x6e617652,
		MSG_ROOMNEW = 0x6e526f6d,
		MSG_ROOMSETDESC = 0x73526f6d,
		MSG_SERVERDOWN = 0x646f776e,
		MSG_SERVERINFO = 0x73696e66,
		MSG_SPOTDEL = 0x6f705364,
		MSG_SPOTMOVE = 0x636f4c73,
		MSG_SPOTNEW = 0x6f70536e,
		MSG_SUPERUSER = 0x73757372,
		MSG_TALK = 0x74616c6b,
		MSG_TIYID = 0x74697972,
		MSG_USERCOLOR = 0x75737243,
		MSG_USERDESC = 0x75737244,
		MSG_USEREXIT = 0x65707273,
		MSG_USERFACE = 0x75737246,
		MSG_USERLIST = 0x72707273,
		MSG_USERLOG = 0x6c6f6720,
		MSG_USERMOVE = 0x754c6f63,
		MSG_USERNAME = 0x7573724e,
		MSG_USERNEW = 0x6e707273,
		MSG_USERPROP = 0x75737250,
		MSG_USERSTATUS = 0x75537461,
		MSG_VERSION = 0x76657273,
		MSG_WHISPER = 0x77686973,
		MSG_XTALK = 0x78746c6b,
		MSG_XWHISPER = 0x78776973,
		MSG_BLOWTHRU = 0x626c6f77,
		MSG_SPOTSTATE = 0x73537461,
		MSG_SMSG = 0x736d7367,
		MSG_ALTLOGONREPLY = 0x72657032;



const zlib = require('zlib'); // needed for legacy props
const net = require('net');

class BufferView extends DataView {

	constructor(abuffer,endian) { // defaults to little endian, set true for big endian.
		super(abuffer);
		this.littleEndian = !Boolean(endian);
	}

	static alloc(size) {
		return new BufferView(new ArrayBuffer(size));
	}

	static concat(buffer1,buffer2) {
		let tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
		tmp.set(new Uint8Array(buffer1), 0);
		tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
		return new BufferView(tmp.buffer);
	}

	get length() {
		return super.byteLength;
	}

	set(uint8,offset) {
		new Uint8Array(super.buffer).set(uint8,offset);
	}

	pString(offset,decoder) {
		return decoder.decode(
			super.buffer.slice(offset+1,offset+this.getUint8(offset)+1)
		);
	}
	cString(offset,decoder) {
		return decoder.decode(
			super.buffer.slice(offset,new Uint8Array(super.buffer).indexOf(0,offset))
		);
	}
	toString(start,end,decoder) {
		return decoder.decode(
			super.buffer.slice(start,end)
		);
	}

	slice(start,end) {
		return new BufferView(super.buffer.slice(start,end));
	}

	sliceUint8(start,end) {
		return new Uint8Array(super.buffer.slice(start,end));
	}

	sliceUint8Clamped(start,end) {
		return new Uint8ClampedArray(super.buffer.slice(start,end));
	}

	getUint32(offset) {
		return super.getUint32(offset,this.littleEndian);
	}
	getInt32(offset) {
		return super.getInt32(offset,this.littleEndian);
	}
	getUint16(offset) {
		return super.getUint16(offset,this.littleEndian);
	}
	getInt16(offset) {
		return super.getInt16(offset,this.littleEndian);
	}


	setUint32(offset,value) {
		return super.setUint32(offset,value,this.littleEndian);
	}
	setInt32(offset,value) {
		return super.setInt32(offset,value,this.littleEndian);
	}
	setUint16(offset,value) {
		return super.setUint16(offset,value,this.littleEndian);
	}
	setInt16(offset,value) {
		return super.setInt16(offset,value,this.littleEndian);
	}

}


class PalaceProtocol {
	constructor(regi,puid) {
		this.crypt = new PalaceCrypt(1);
		this.regi = regi;
		this.puid = puid;
	}

	connect(ip,port) {
		this.textDecoder = new TextDecoder('windows-1252'); // default server encoding
		this.textEncoder = new TextEncoder('windows-1252', { NONSTANDARD_allowLegacyEncoding: true }); // palace default! :\

		if (!port) port = '9998';
		this.ip = ip.trim();
		this.port = port.trim();

		this.connecting(); // trigger sub class PalaceClient event.

		if (this.soc) {
			this.sendLogOff(); // politely disconnect
			this.soc.destroy();
		}

		this.buffer = BufferView.alloc(0);
		this.soc = new net.Socket(); // node socket
		this.soc.on('connect', () => {
			logmsg('Connected');
		});
		this.soc.on('data', (data) => this.onData(data));
		this.soc.on('error', (err) => this.onError(err));

		this.soc.connect(this.port, this.ip); // connecting problem to dragons lair
	}

	onData(nodeBuffer) { 								// accessing the Node Buffers ArrayBuffer
		this.buffer = BufferView.concat(this.buffer.buffer, nodeBuffer.buffer); // concating two ArrayBuffers
		do {
			if (this.buffer.length < 8) break;
			var packetLength = this.buffer.getInt32(4) + 12;
			if (this.buffer.length < packetLength) break;
			this.packetReceived(this.buffer.slice(0,packetLength));
			this.buffer = this.buffer.slice(packetLength,this.buffer.length);
		} while (this.buffer.length > 0);
	}

	send(b) {
		this.soc.write(Buffer.from(b.buffer));
	}

	onError(err) {
		if (err.code === 'ECONNRESET') {
			if (!this.retryRegistration) { //part of pserver security plugin to work around local proxies like pdrug.
				this.retryRegistration = true;
				this.buffer = BufferView.alloc(0);
				this.soc.destroy(); // seems nessacery
				this.soc.connect(this.port,this.ip);
			}
		} else {
			console.log('Socket error: ' + err);
		}
	}

	packetReceived(view) {
		var packet = {type:view.getInt32(0),
					reference:view.getInt32(8), // reference is sub identifier; usually a user ID
					data:view};

		switch(packet.type) {
			case MSG_USERMOVE:
				this.parseUserMove(packet);
				break;
			case MSG_USERFACE:
				this.parseUserFace(packet);
				break;
			case MSG_USERCOLOR:
				this.parseUserColor(packet);
				break;
			case MSG_USERPROP:
				this.parseUserProp(packet);
				break;
			case MSG_USERDESC:
				this.parseUserDesc(packet);
				break;
			case MSG_DRAW:
				this.parseDrawing(packet);
				break;
			case MSG_XTALK:
				this.parseXtalk(packet);
				break;
			case MSG_TALK:
				this.parseTalk(packet);
				break;
			case MSG_WHISPER:
				this.parseWhisper(packet);
				break;
			case MSG_XWHISPER:
				this.parseXwhisper(packet);
				break;
			case MSG_USEREXIT:
				this.parseUserExit(packet);
				break;
			case MSG_USERNEW:
				this.parseUser(packet);
				break;
			case MSG_USERLOG:
				this.parseUserLog(packet);
				break;
			case MSG_LOGOFF:
				this.parseLogOff(packet);
				break;
			case MSG_USERNAME:
				this.parseUserName(packet);
				break;
			case MSG_TIYID:
				this.sendRegistration();
				break;
			case MSG_HTTPSERVER:
				this.parseHttpServer(packet);
				break;
			case MSG_SPOTMOVE:
				this.parseSpotMove(packet);
				break;
			case MSG_PICTMOVE:
				this.parsePicMove(packet);
				break;
			case MSG_SPOTSTATE:
				this.parseSpotState(packet);
				break;
			case MSG_DOORLOCK:
				this.parseDoorLock(packet);
				break;
			case MSG_DOORUNLOCK:
				this.parseDoorUnlock(packet);
				break;
			case MSG_ROOMSETDESC:
			case MSG_ROOMDESC:
				this.parseRoom(packet);
				break;
			case MSG_NAVERROR:
				this.parseNavError(packet);
				break;
			case MSG_LISTOFALLROOMS:
				this.parseRoomList(packet);
				break;
			case MSG_LISTOFALLUSERS:
				this.parseUserList(packet);
				break;
			case MSG_PROPDEL:
				this.parsePropDelete(packet);
				break;
			case MSG_PROPNEW:
				this.parsePropNew(packet);
				break;
			case MSG_PROPMOVE:
				this.parsePropMove(packet);
				break;
			case MSG_USERSTATUS:
				this.parseUserStatus(packet);
				break;
			case MSG_SERVERINFO:
				this.parseServerInfo(packet);
				break;
			case MSG_USERLIST:
				this.parseUsers(packet);
				break;
			case MSG_PING:
				this.sendPong();
				break;
			case MSG_BLOWTHRU:
				this.parseBlowThru(packet);
				break;
			case MSG_AUTHENTICATE:
				this.passData(packet);
				break;
			case MSG_SERVERDOWN:
				this.parseServerDown(packet);
				break;
			case MSG_ASSETSEND:
				this.parseAsset(packet);
				break;
			case MSG_ASSETQUERY:
			case MSG_ALTLOGONREPLY:
			case MSG_ROOMDESCEND:
			case MSG_EXTENDEDINFO:
			case MSG_VERSION:
				//trash
				break;
			default:
				console.log('unhandled packet: '+packet.type);
				break;
		}
	}

	parseAsset(p) {
		p.data = {id:p.data.getInt32(16),
			flags:p.data.getInt16(86),
			offsets:{x:p.data.getInt16(80), y:p.data.getInt16(82)},
			size:{w:44, h:44},
			name:p.data.pString(44,new TextDecoder('utf-8')), //prop assets names from the pserver are utf8
			img:p.data.sliceUint8Clamped(88,p.data.getInt32(40)+76)};
		this.passData(p);
	}

	parseServerDown(p) {
		p.data = {refnum:p.reference,
			msg:p.data.cString(12,this.textDecoder)};
		this.passData(p);
	}

	parseBlowThru(p) {
		if (p.reference == 0x4f434e45) { // pserver plugin that sets encoding for the server
			var encoding = p.data.toString(12,p.data.getInt32(4) + 12,this.textDecoder);
			this.textDecoder = new TextDecoder(encoding);
			this.textEncoder = new TextEncoder(encoding, { NONSTANDARD_allowLegacyEncoding: true });
		}
	}

	parseSpotMove(p) {
		p.data = {roomid:p.data.getInt16(12),
			spotid:p.data.getInt16(14),
			x:p.data.getInt16(18),
			y:p.data.getInt16(16)};
		this.passData(p);
	}

	parsePicMove(p) {
		p.data = {roomid:p.data.getInt16(12),
			spotid:p.data.getInt16(14),
			x:p.data.getInt16(18),
			y:p.data.getInt16(16)};
		this.passData(p);
	}

	parseSpotState(p) {
		p.data = {roomid:p.data.getInt16(12),
			spotid:p.data.getInt16(14),
			state:p.data.getInt16(16),
			lock:null};
		this.passData(p);
	}

	parseDoorLock(p) {
		p.data = {roomid:p.data.getInt16(12),
			spotid:p.data.getInt16(14),
			state:1,
			lock:true};
		this.passData(p);
	}

	parseDoorUnlock(p) {
		p.data = {roomid:p.data.getInt16(12),
			spotid:p.data.getInt16(14),
			state:0,
			lock:false};
		this.passData(p);
	}

	parseHttpServer(p) {
		p.data = p.data.cString(12,this.textDecoder).replace(/\/?$/, '/'); // make sure it ends with a forward slash!
		this.passData(p);
	}

	parseRoom(p) {
		var readPointer = (b,offset) => {
			return b.getInt16(offset)+52;
		};
		var roomPstring = (b,offset) => {
			return b.pString(readPointer(b,offset),this.textDecoder);
		};

		var room = {id:p.data.getInt16(20),
					flags:p.data.getInt32(12),
					name:roomPstring(p.data,22),
					artist:roomPstring(p.data,26),
					background:roomPstring(p.data,24),
					password:'',
					looseProps:[],
					spots:[],
					pictures:[],
					draws:[]};


		var nxt = readPointer(p.data,46);
		var count = p.data.getInt16(44);
		for (var i = 0; i < count; i++) {
			room.looseProps.push({y:p.data.getInt16(nxt+20),
				x:p.data.getInt16(nxt+22),
				id:p.data.getInt32(nxt+4)});
			nxt = readPointer(p.data,nxt);
		}

		nxt = readPointer(p.data,32);
		count = p.data.getInt16(30);

		for (var i = 0; i < count; i++) { //hotspots aka doors
			var flags = p.data.getInt32(nxt+4);
			var spot = {flags:flags,
							layer:(flags & 0x00000004 || flags & 0x00000040 || flags & 0x00000001)?1:0,
							y:p.data.getInt16(nxt+16),
							x:p.data.getInt16(nxt+18),
							id:p.data.getInt16(nxt+20),
							dest:p.data.getInt16(nxt+22),
							type:p.data.getInt16(nxt+28),
							state:p.data.getInt16(nxt+36),
							name:roomPstring(p.data,nxt+42),
							script:p.data.cString(readPointer(p.data,nxt+44),this.textDecoder),
							points:[],
							statepics:[]};

			var ptsCount = p.data.getInt16(nxt+24);
			var ptsOffset = readPointer(p.data,nxt+26);
			for (var j = 0; j < ptsCount; j++) {
				spot.points.push(p.data.getInt16(ptsOffset+2));
				spot.points.push(p.data.getInt16(ptsOffset));
				ptsOffset += 4;
			}

			var nbrStates = p.data.getInt16(nxt+38);
			var stateRecOfst = readPointer(p.data,nxt+40);
			for (var j = 0; j < nbrStates; j++) {
				spot.statepics.push({id:p.data.getInt16(stateRecOfst),
										x:p.data.getInt16(stateRecOfst+6),
										y:p.data.getInt16(stateRecOfst+4)});
				stateRecOfst += 8;
			}

			room.spots.push(spot);
			nxt += 48;
		}

		var nbrPics = p.data.getInt16(34);
		var picOffset = readPointer(p.data,36);
		for (var i = 0; i < nbrPics; i++) {
			room.pictures.push({name:roomPstring(p.data,picOffset+6),
				id:p.data.getInt16(picOffset+4),
				trans:p.data.getInt16(picOffset+8)});
			picOffset += 12;
		}

		nxt = readPointer(p.data,40);

		room.draws = [];
		var nbrDraws = p.data.getInt16(38);
		for (var i = 0; i < nbrDraws; i++) {
			var pos = readPointer(p.data,nxt+8);
			room.draws.push(this.parseDraw(p.data.slice(pos,p.data.getInt16(nxt+6)+pos) , p.data.getInt16(nxt+4)));
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
		var count = p.data.getInt32(8);
		var add = 12;
		for (var i = 0; i < count; i++) {
			var nameLen = p.data.getUint8(add+8);
			list.push({name:p.data.toString(add+9,add+9+nameLen,this.textDecoder),
							id:p.data.getInt32(add),
							flags:p.data.getInt16(add+4),
							population:p.data.getInt16(add+6)});
			add = add+9+((nameLen + ( 4 - (nameLen & 3))) - 1);
		}
		p.data = list;
		this.passData(p);
	}

	parseUserList(p) {
		var list = [];
		var count = p.data.getInt32(8);
		var add = 12;
		for (var i = 0; i < count; i++) {
			var nameLen = p.data.getUint8(add+8);
			list.push({name:p.data.toString(add+9,add+9+nameLen,this.textDecoder),
							userid:p.data.getInt32(add),
							flags:p.data.getInt16(add+4),
							roomid:p.data.getInt16(add+6)});
			add = add+9+((nameLen + ( 4 - (nameLen & 3))) - 1);
		}
		p.data = list;
		this.passData(p);
	}

	parsePropDelete(p) {
		p.data = p.data.getInt32(12);
		this.passData(p);
	}
	parsePropNew(p) {
		p.data = {x:p.data.getInt16(22),
			y:p.data.getInt16(20),
			id:p.data.getInt32(12),
			crc:p.data.getInt32(16)};
		this.passData(p);
	}
	parsePropMove(p) {
		p.data = {x:p.data.getInt16(18),
			y:p.data.getInt16(16),
			index:p.data.getInt32(12)};
		this.passData(p);
	}

	parseUserStatus(p) {
		p.data = {id:p.reference,
			status:p.data.getInt16(12)};
		this.passData(p);
	}

	parseServerInfo(p) {
		p.data = {flags:p.data.getInt32(12),
			name:p.data.pString(16,this.textDecoder)};
		this.passData(p);
	}


	parseUserFace(p) {
		p.data = {id:p.reference,
			face:p.data.getInt16(12)};
		this.passData(p);
	}
	parseUserColor(p) {
		p.data = {id:p.reference,
			color:p.data.getInt16(12)};
		this.passData(p);
	}

	parseUserProp(p) {
		var props = [];
		for (var i = 16; i < p.data.length-1; i += 8) {
			props.push(p.data.getInt32(i));
		}
		p.data = {id:p.reference,
			props:props};
		this.passData(p);
	}

	parseUserDesc(p) {
		var props = [];
		for (var i = 20; i < p.data.length-1; i += 8) {
			props.push(p.data.getInt32(i));
		}
		p.data = {id:p.reference,
			face:p.data.getInt16(12),
			color:p.data.getInt16(14),
			props:props};
		this.passData(p);
	}

	parseUserName(p) {
		p.data = {id:p.reference,
			name:p.data.pString(12,this.textDecoder)};
		this.passData(p);
	}

	parseUserLog(p) {
		p.data = {id:p.reference,
			count:p.data.getInt32(12)};
		this.passData(p);
	}

	parseLogOff(p) {
		p.data = {id:p.reference,
			count:p.data.getInt32(12)};
		this.passData(p);
	}

	parseUserMove(p) {
		p.data = {id:p.reference,
			x:p.data.getInt16(14),
			y:p.data.getInt16(12)};
		this.passData(p);
	}

	parseWhisper(p) {
		p.data = {id:0,
			chatstr:p.data.cString(12,this.textDecoder),
			whisper:true};
		this.passData(p);
	}

	parseTalk(p) {
		p.data = {id:p.reference,
			chatstr:p.data.cString(12,this.textDecoder),
			whisper:false};
		this.passData(p);
	}

	parseXtalk(p) {
		p.data = {id:p.reference,
			chatstr:this.crypt.Decrypt(p.data.sliceUint8Clamped(14,11+p.data.getInt16(12)),this.textDecoder),
			whisper:false};
		this.passData(p);
	}

	parseXwhisper(p) {
		p.data = {id:p.reference,
			chatstr:this.crypt.Decrypt(p.data.sliceUint8Clamped(14,11+p.data.getInt16(12)),this.textDecoder),
			whisper:true};
		this.passData(p);
	}

	parseUserExit(p) {
		p.data = {id:p.reference};
		this.passData(p);
	}

	parseDrawing(p) {
		p.data = this.parseDraw(p.data.slice(22,p.data.length),p.data.getUint16(16));
		this.passData(p);
	}

	parseUser(p) {
	  var user = {name:p.data.pString(104,this.textDecoder),
					id:p.reference,
					x:p.data.getInt16(18),
					y:p.data.getInt16(16),
					color:p.data.getInt16(96),
					face:p.data.getInt16(94),
					props:[]};

		var nbrProps = p.data.getInt16(102);
		for (var j = 0; j < nbrProps; j++) {
			user.props.push(p.data.getInt32(20+(j*8)));
		}

		p.data = user;
		this.passData(p);
	}

	parseUsers(p) {
		var users = [];
		var uOffset = 12;
		var count = p.reference;
		for (var i = 0; i < count; i++) {
			var user = {name:p.data.pString(uOffset+92,this.textDecoder),
						id:p.data.getInt32(uOffset),
						x:p.data.getInt16(uOffset+6),
						y:p.data.getInt16(uOffset+4),
						color:p.data.getInt16(uOffset+84),
						face:p.data.getInt16(uOffset+82),
						props:[]};

			var nbrProps = p.data.getInt16(90+uOffset);
			for (var j = 0; j < nbrProps; j++)
				user.props.push(p.data.getInt32(8+uOffset+(j*8)));

			users.push(user);
			uOffset += 124;
		}

		p.data = users;
		this.passData(p);
	}


	parseDraw(cmdData,type) { // one old hack of a packet

		var nbrPoints,i,differential,pensize,r1,g1,b1,r2,g2,b2;
		var a1 = -1;
		var a2 = -1;
		var fillAlpha = 255;
		var penAlpha = 255;
		var jdraw = {type:type};

		if ((type & drawType.CLEAN) == 0 && (type & drawType.UNDO) == 0) {


			var shape = (type & drawType.SHAPE) != 0;
			pensize = cmdData.getInt16(0);
			differential = Math.trunc(pensize/2);
			nbrPoints = cmdData.getInt16(2);

			if (cmdData.length == (nbrPoints*4)+22) {
				r1 = cmdData.getUint8(cmdData.length-7);
				g1 = cmdData.getUint8(cmdData.length-6);
				b1 = cmdData.getUint8(cmdData.length-5);
				a1 = cmdData.getUint8(cmdData.length-8);

				r2 = cmdData.getUint8(cmdData.length-3);
				g2 = cmdData.getUint8(cmdData.length-2);
				b2 = cmdData.getUint8(cmdData.length-1);
				a2 = cmdData.getUint8(cmdData.length-4);
			} else {
				r1 = cmdData.getUint8(4);
				g1 = cmdData.getUint8(6);
				b1 = cmdData.getUint8(8);
				r2 = r1;
				g2 = g2;
				b2 = b2;
				if (shape) pensize = 0; //old style fill
			}

			if ((type & drawType.TEXT) != 0) { //text
				pensize = cmdData.getInt16(0);

				jdraw.bold = (cmdData.getUint8(18) & 1) != 0;
				jdraw.underline = (cmdData.getUint8(18) & 2) != 0;
				jdraw.italic = (cmdData.getUint8(18) & 4) != 0;

				var font = cmdData.pString(19,this.textDecoder);
				var aLen = font.length;
				jdraw.font = font;
				var msg = cmdData.cString(20+aLen,this.textDecoder); //must define utf8!
				jdraw.msg = msg;

				if (aLen+msg.length+29 == cmdData.length) {
					// might be executing color building twice, check for this later
					r1 = cmdData.getUint8(cmdData.length-7);
					g1 = cmdData.getUint8(cmdData.length-6);
					b1 = cmdData.getUint8(cmdData.length-5);
					a1 = cmdData.getUint8(cmdData.length-8);

					r2 = cmdData.getUint8(cmdData.length-3);
					g2 = cmdData.getUint8(cmdData.length-2);
					b2 = cmdData.getUint8(cmdData.length-1);
					a2 = cmdData.getUint8(cmdData.length-4);
					pensize=cmdData.getInt16(0);
				}

				jdraw.x = cmdData.getInt16(10);
				jdraw.y = cmdData.getInt16(12);

			} else if ((type & drawType.OVAL) != 0) { //oval
				var w = cmdData.getInt16(14);
				var h = cmdData.getInt16(16);
				jdraw.w = w;
				jdraw.h = h;
				jdraw.x = cmdData.getInt16(10) - Math.trunc(w/2);
				jdraw.y = cmdData.getInt16(12) - Math.trunc(h/2);
			} else {

				i = ((nbrPoints+1)*4)+9;

				var x = 0,y = 0,difference = 0;

				if ((type & 1) == 0 && !shape) difference = differential;

				var pts = [];
				for (var j = 10; j < i; j += 4) {
					y=y+cmdData.getInt16(j);
					x=x+cmdData.getInt16(j+2);
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


	sendLogOff() {
		var packet = BufferView.alloc(12);
		packet.setInt32(0,MSG_LOGOFF);
		this.send(packet);
	}

	sendDraw(draw) {

		var drawCmd = 0,i,x = 0,y = 0,x1,y1;

		if (draw.type === 1) {
			drawCmd = drawType.SHAPE;
		} else if (draw.type === 2) {
			drawCmd = drawType.ERASER;
		}

		if (draw.front) drawCmd = drawCmd ^ drawType.PENFRONT;
		var n = draw.points.length;
		var packet = BufferView.alloc((n*2)+40);

		//header data
		packet.setInt32(0,MSG_DRAW);
		packet.setInt32(4,(n*2)+28); //packetlength
		//packet.long(8)=0 'userID
		//link
		//packet.setInt16(12)=0
		//packet.setInt16(14)=0
		//drawCmd

		packet.setInt16(true,drawCmd,16); //flag...... not sure if applying correct value
		//cmdLength

		packet.setInt16(18,(n*2)+18);
		packet.setInt16(22,draw.size); //pensize

		packet.setInt16(24,(n/2)-1); //nbrPts

		var red = Number(draw.color[0]);
		var green = Number(draw.color[1]);
		var blue = Number(draw.color[2]);
		var alpha = (Number(draw.color[3]) * 255).fastRound();

		packet.setUint8(26,red);
		packet.setUint8(27,red);
		packet.setUint8(28,green);
		packet.setUint8(29,green);
		packet.setUint8(30,blue);
		packet.setUint8(31,blue);

		//for i=1 to n-1 step 2
		for (i = 1; i < n; i += 2) {
			x1=draw.points[i-1];
			y1=draw.points[i];
			packet.setInt16((i*2)+30,y1-y);
			packet.setInt16((i*2)+32,x1-x);
			x=x1;
			y=y1;
		}

		packet.setUint8(packet.length-8,alpha);
		packet.setUint8(packet.length-7,red);
		packet.setUint8(packet.length-6,green);
		packet.setUint8(packet.length-5,blue);

		red = Number(draw.fill[0]); // fix this number casting shit
		green = Number(draw.fill[1]);
		blue = Number(draw.fill[2]);
		alpha = (Number(draw.fill[3]) * 255).fastRound();

		packet.setUint8(packet.length-4,alpha);
		packet.setUint8(packet.length-3,red);
		packet.setUint8(packet.length-2,green);
		packet.setUint8(packet.length-1,blue);

		this.send(packet);
	}

	sendDrawClear(drawCmd) {
		var packet = BufferView.alloc(22);
		packet.setInt32(0,MSG_DRAW);
		packet.setInt32(4,10);
		packet.setInt16(16,drawCmd);
		this.send(packet);
	}

	sendUnlockRoom(spotid) {
		var packet = BufferView.alloc(16);
		packet.setInt32(0,MSG_DOORUNLOCK);
		packet.setInt32(4,4);
		packet.setInt16(12,this.theRoom.id);
		packet.setInt16(14,spotid);
		this.send(packet);
	}

	sendLockRoom(spotid) {
		var packet = BufferView.alloc(16);
		packet.setInt32(0,MSG_DOORLOCK);
		packet.setInt32(4,4);
		packet.setInt16(12,this.theRoom.id);
		packet.setInt16(14,spotid);
		this.send(packet);
	}

	sendOperatorRequest(password) {
		password = this.textEncoder.encode(password);
		var leng = password.length;
		var packet = BufferView.alloc(13+leng);
		packet.setInt32(0,MSG_SUPERUSER);
		packet.setInt32(4,leng+1);
		var data = this.crypt.Encrypt(password);
		packet.setInt8(12,data.length);
		packet.set(data,13);
		this.send(packet);
	}

	sendPong() {
		var packet = BufferView.alloc(12);
		packet.setInt32(0,MSG_PONG);
		this.send(packet);
	}

	sendWhisper(msg,whisperID) {
		msg = this.textEncoder.encode(msg);
		var leng = msg.length;
		var packet = BufferView.alloc(19+leng);
		packet.setInt32(0,MSG_XWHISPER);
		packet.setInt32(4,leng+7);
		packet.setInt32(12,whisperID);
		packet.setInt16(16,leng+3);
		packet.set(this.crypt.Encrypt(msg),18)
		this.send(packet);
	}

	sendXtlk(msg) {
		msg = this.textEncoder.encode(msg);
		var leng = msg.length;
		var packet = BufferView.alloc(15+leng);
		packet.setInt32(0,MSG_XTALK);
		packet.setInt32(4,leng+3);
		packet.setInt16(12,leng+3);
		packet.set(this.crypt.Encrypt(msg),14);
		this.send(packet);
	}

	sendRoomNav(id) {
		var packet = BufferView.alloc(14);
		packet.setInt32(0,MSG_ROOMGOTO);
		packet.setInt32(4,2);
		packet.setInt16(12,id);
		this.send(packet);
	}

	sendRoomListRequest() {
		var packet = BufferView.alloc(12);
		packet.setInt32(0,MSG_LISTOFALLROOMS);
		this.send(packet);
	}

	sendUserListRequest() {
		var packet = BufferView.alloc(12);
		packet.setInt32(0,MSG_LISTOFALLUSERS);
		this.send(packet);
	}

	sendPropDress(props) {
		var length = props.length;
		var packet = BufferView.alloc(16+length*8);

		packet.setInt32(0,MSG_USERPROP);
		packet.setInt32(4,length*8+4);
		packet.setInt32(12,length);
		for (var i = 0; i < length; i++)
			packet.setInt32(16+i*8,props[i]);

		this.send(packet);
	}

	sendPropDrop(x,y,id) {
		var packet = BufferView.alloc(24);
		packet.setInt32(0,MSG_PROPNEW);
		packet.setInt32(4,12);
		packet.setInt32(12,id);
		packet.setInt16(20,y);
		packet.setInt16(22,x);
		this.send(packet);
	}

	sendPropMove(x,y,index) {
		var packet = BufferView.alloc(20);
		packet.setInt32(0,MSG_PROPMOVE);
		packet.setInt32(4,8);
		packet.setInt32(12,index);
		packet.setInt16(16,y);
		packet.setInt16(18,x);
		this.send(packet);
	}

	sendPropDelete(index) {
		var packet = BufferView.alloc(16);
		packet.setInt32(0,MSG_PROPDEL);
		packet.setInt32(4,4);
		packet.setInt32(12,index);
		this.send(packet);
	}

	sendUserLocation(x,y) {
		var packet = BufferView.alloc(16);
		packet.setInt32(0,MSG_USERMOVE);
		packet.setInt32(4,4);
		packet.setInt16(12,y);
		packet.setInt16(14,x);
		this.send(packet);
	}

	sendUserName(name) {
		name = this.textEncoder.encode(name);
		var packet = BufferView.alloc(name.length+13);
		packet.setInt32(0,MSG_USERNAME);
		packet.setInt32(4,name.length+1);
		packet.setInt8(12,name.length);
		packet.set(name,13);
		this.send(packet);
	}

	sendFace(face) {
		var packet = BufferView.alloc(14);
		packet.setInt32(0,MSG_USERFACE);
		packet.setInt32(4,2);
		packet.setInt16(12,face);
		this.send(packet);
	}

	sendFaceColor(color) {
		var packet = BufferView.alloc(14);
		packet.setInt32(0,MSG_USERCOLOR);
		packet.setInt32(4,2);
		packet.setInt16(12,color);
		this.send(packet);
	}

	sendAuthenticate(name,pass) {
		var info = this.textEncoder.encode(name+':'+pass);
		var packet = BufferView.alloc(13+info.length);
		packet.setInt32(0,MSG_AUTHRESPONSE);
		packet.setInt32(4,info.length+1);
		packet.setInt8(12,info.length);
		packet.set(this.crypt.Encrypt(info),13);
		this.send(packet);
	}

	sendRegistration() {
		var reg = BufferView.alloc(140);
		reg.setInt32(0,MSG_LOGON);
		reg.setInt32(4,128); //fixed packet length

		reg.setInt32(12,this.regi.crc);
		reg.setInt32(16,this.regi.counter);

		var name = this.textEncoder.encode(prefs.general.userName);
		reg.setInt8(20,name.length);
		reg.set(name,21);//should truncate to 31 bytes max

		if (/^win/.test(process.platform)) { //add linux/unix identifier.
			reg.setUint32(84,0x80000004); //must validate since value is
		} else {
			reg.setUint32(84,0x80000002);
		}

		reg.setInt32(88,this.puid.counter);
		reg.setInt32(92,this.puid.crc);

		reg.setInt32(96,0x00011940);
		reg.setInt32(100,0x00011940);
		reg.setInt32(104,0x00011940);
		//reg.setInt16(108); //optional room ID to land in (if server allows it,0)
		reg.set(this.textEncoder.encode('PC5'+remote.app.getVersion().replace(/\./g, '')),110);

		reg.setInt32(120,0x00000041);
		if (this.retryRegistration === true ) {
			reg.setInt32(124,0x00000111); //original value required by a security pserver plugin
		} else {
			reg.setInt32(124,0x00000151); //a protocol required by a different security pserver plugins
		}
		reg.setInt32(128,0x00000001);
		reg.setInt32(132,0x00000001);

		this.send(reg);
	}


	sendAssetQuery(id) { // request a legacy prop
		var packet = BufferView.alloc(24);
		packet.setInt32(0,MSG_ASSETQUERY);
		packet.setInt32(4,12);
		packet.setInt32(12,0x50726F70); // asset name 'Prop'
		packet.setInt32(16,id);
		this.send(packet);
	}

}

class PalaceClient extends PalaceProtocol {
	constructor(regi,puid) {

		let reg = new PalaceRegistration(regi,puid);
		super({crc:reg.crc,counter:reg.counter},{crc:reg.puidCrc,counter:reg.puidCounter});
		this.propDecoder = new LegacyPropDecoder();
	}

	connecting() {
		this.serverDown();
		setEnviornment(window.innerWidth-logField.offsetWidth,window.innerHeight-45-document.getElementById('chatbox').offsetHeight,'');
		toggleLoadingBG(true);
		setUserInterfaceAvailability(true);
	}

	serverDownMsg(ref,msg) {
		switch (ref) {
			case 1:
				return 'You\'ve logged off.';
			case 2:
				return 'com error.';
			case 3:
				return 'You\'ve been killed for flooding!';
			case 4:
				return 'You\'ve been killed by a Operator!';
			case 5:
				return 'Server has been shut down.';
			case 6:
				return 'Server is unresponsive.';
			case 7:
				return 'You\'ve been killed by the System Operator!';
			case 8:
				return 'The Server is full.';
			case 9:
				return 'The server has rejected you because you are using a invalid serial number.';
			case 10:
				return 'The server has rejected you because someone with the same serial number has logged on.';
			case 11:
				return 'Your death penalty is still active.';
			case 12:
				return 'You\'ve been Banished.';
			case 13:
				return 'You\'ve been Banished and Killed.';
			case 14:
				return 'This server does not allow guests.';
			case 15:
				return 'demo expired.';
			case 16:
				return msg;
			default:
				if (msg) return msg;
				return 'You have been disconnected for a reason unknown.  REFNUMBER: '+ref;
		}

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
		toggleZoomPanel('authenticate',0);

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
			setEnviornment(window.innerWidth-logField.offsetWidth,window.innerHeight-45,"url(img/error.png)");
			logmsg(msg);
		}


	}

	serverInfo(info) {
		this.servername = info.name;
		this.serverflags = info.flags;
		var addressBar = document.getElementById('palaceserver');
		addressBar.title = info.name;
		if (addressBar != document.activeElement) addressBar.innerText = this.servername;
	}

	get allowPainting() {
		return Boolean(this.serverflags & 0x0004);
	}

	get isOperator() {
		return Boolean(this.theUserStatus & 0x0001);
	}

	get isOwner() {
		return Boolean(this.theUserStatus & 0x0002);
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
			info.logoff = true; // tell removeUser that it is a logoff event.
			if (this.theRoom.removeUser(info) && !prefs.general.disableSounds) systemAudio.signoff.play();
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

	decodeLegacyProp(data) {
		let dataUrl = this.propDecoder.decode(data.flags,data.img);
		if (dataUrl) {
			let aProp = new PalaceProp(data.id,data);
			allProps[data.id] = aProp;
			aProp.requestPropImage(dataUrl);
			delete aProp.rcounter; // no need to retry
		}
	}

	passData(p) {
		//console.log(p);
		switch(p.type) {
			case MSG_TALK:
			case MSG_WHISPER:
			case MSG_XWHISPER:
			case MSG_XTALK:
				this.theRoom.userChat(p.data);
				break;
			case MSG_USERMOVE:
				this.theRoom.userMove(p.data);
				break;
			case MSG_USERFACE:
				this.theRoom.userFaceChange(p.data);
				break;
			case MSG_USERCOLOR:
				this.theRoom.userColorChange(p.data);
				break;
			case MSG_USERPROP:
				this.theRoom.userPropChange(p.data);
				break;
			case MSG_USERDESC:
				this.theRoom.userAvatarChange(p.data);
				break;
			case MSG_USERNAME:
				this.theRoom.userNameChange(p.data);
				break;
			case MSG_DRAW:
				this.theRoom.draw(p.data);
				break;
			case MSG_USERLOG:
				this.userLogOn(p.data);
				break;
			case MSG_LOGOFF:
				this.userLogOff(p.data);
				break;
			case MSG_USEREXIT:
				this.theRoom.removeUser(p.data);
				break;
			case MSG_USERNEW:
				this.theRoom.addUser(p.data);
				break;
			case MSG_HTTPSERVER:
				this.mediaUrl = p.data;
				break;
			case MSG_SPOTMOVE:
				this.theRoom.spotMove(p.data);
				break;
			case MSG_PICTMOVE:
				this.theRoom.spotMovePic(p.data);
				break;
			case MSG_SPOTSTATE:
				this.theRoom.spotStateChange(p.data);
				break;
			case MSG_DOORLOCK:
				this.theRoom.spotStateChange(p.data);
				break;
			case MSG_DOORUNLOCK:
				this.theRoom.spotStateChange(p.data);
				break;
			case MSG_ROOMSETDESC:
			case MSG_ROOMDESC:
				var users;
				if (this.theRoom && this.theRoom.users) users = this.theRoom.users; // if editing room, god save the people!
				p.data.authored = p.type === MSG_ROOMSETDESC;
				this.theRoom = new PalaceRoom(p.data);
				this.theRoom.users = users;
				if (users) this.theRoom.refresh();
				break;
			case MSG_NAVERROR:
				this.theRoom.navigationError(p.data);
				break;
			case MSG_LISTOFALLROOMS:
				loadRoomList(p.data);
				break;
			case MSG_LISTOFALLUSERS:
				loadUserList(p.data);
				break;
			case MSG_PROPDEL:
				this.theRoom.loosePropDelete(p.data);
				break;
			case MSG_PROPNEW:
				this.theRoom.loosePropAdd(p.data);
				break;
			case MSG_PROPMOVE:
				this.theRoom.loosePropMove(p.data);
				break;
			case MSG_USERSTATUS:
				this.theUserID = p.data.id;
				this.theUserStatus = p.data.status;
				break;
			case MSG_SERVERINFO:
				this.serverInfo(p.data);
				break;
			case MSG_USERLIST:
				this.theRoom.loadUsers(p.data);
				break;
			case MSG_AUTHENTICATE:
				toggleZoomPanel('authenticate',1);
				document.getElementById("authusername").focus();
				break;
			case MSG_SERVERDOWN:
				this.serverDown(this.serverDownMsg(p.data.refnum,p.data.msg));
				break;
			case MSG_ASSETSEND:
				this.decodeLegacyProp(p.data);
				break;
			default:
				console.log(p);
				break;
		}
	}

}





class PalaceRegistration {
	constructor(seed,p) {
		this.crc = this.computeLicenseCRC(seed);
		this.counter = ( ( seed ^ PalaceRegistration.MAGIC_LONG ) ^ this.crc );
		this.puidCrc = this.computeLicenseCRC(p);
		this.puidCounter = (p ^ this.puidCrc);
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
		var p = BufferView.alloc(4);
		p.littleEndian = false;
		p.setInt32(0,v);
		for (var i = 0; i < 4; i++) {
			if ((crc & 0x80000000) == 0) {
				crc = (crc << 1) ^ mask[p.getUint8(i)];
			} else {
				crc = ((crc << 1) + 1) ^ mask[p.getUint8(i)];
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
		if (b == null || b.length === 0) return '';
		var rc = 0,lastChar = 0,i = b.length;
		while(i--) {
			b[i] = b[i]^(this.gEncryptTable[rc]^lastChar);
			lastChar = b[i]^this.gEncryptTable[rc+1];
			rc += 2;
		}
		return b;
	}

	Decrypt(b,decoder) {
		if (b == null || b.length === 0) return '';
		var rc = 0,tmp = 0,lastChar = 0,i = b.length;
		while(i--) {
			tmp = b[i];
			b[i] = tmp^(this.gEncryptTable[rc]^lastChar);
			lastChar = tmp^this.gEncryptTable[rc+1];
			rc += 2;
		}
		return decoder.decode(b);
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



class LegacyPropDecoder {

	constructor() { // preload offscreen buffer goodies
		let c = document.createElement('canvas');
		c.width = 44;
		c.height = 44;
		this.ctx = c.getContext("2d");
		this.imageData = this.ctx.getImageData(0, 0, 44, 44);
		this.colors = LegacyPropDecoder.colorPalette;
	}

	PROP_20BIT(flags) { return Boolean(flags & 64); }
	PROP_S20BIT(flags) { return Boolean(flags & 512); }
	PROP_32BIT(flags) { return Boolean(flags & 256); }
	PROP_16BIT(flags) { return Boolean(flags & 128); }

	decode8bit(b) {
		let Read = 0,Skip = 0,l = 0,x = 7744,o = 0,index = 0,len = b.length,
			buf = new ArrayBuffer(7744),
			buf8 = new Uint8ClampedArray(buf),
			data = new Uint32Array(buf);

		while (x > 0) {
			if (o>=len) break; //went too far

			index = b[o];
			Skip = index >> 4;
			Read = index & 0x0F;
			x -= (Skip + Read);

			if (x < 0) break;
			l += Skip;
			o++;

			while (Read--) {
				data[l] = this.colors[index = b[o]];
				o++;
				l++;
			}
		}

		this.imageData.data.set(buf8);
		this.ctx.putImageData(this.imageData,0,0);
		return this.ctx.canvas.toDataURL();
	}

	decode32bit(b) {
		let buf = new ArrayBuffer(7744),
			buf8 = new Uint8ClampedArray(buf);

		for (let i = 0; i < 7744; i+=4) {
			buf8[i+2] = b[i+2];
			buf8[i+1] = b[i+1];
			buf8[i] = b[i];
			buf8[i+3] = b[i+3];
		}

		this.imageData.data.set(buf8);
		this.ctx.putImageData(this.imageData,0,0);
		return this.ctx.canvas.toDataURL();
	}

	decodeS20bit(b) { //yeah its crazy, the things we did though
		let intComp = 0,inc = 0,
			buf = new ArrayBuffer(7744),
			buf8 = new Uint8ClampedArray(buf);


		for (let i = 0; i < 7744; i+=4) {
			intComp = (256*b[inc])+b[inc+1];
			buf8[i] = (intComp & 63488) * 0.00401650705645161323897873728583363118; //red S20pixel1
			buf8[i+1] = (intComp & 1984) * 0.128528225806451623647319593146676198; //green S20pixel2
			buf8[i+2] = (intComp & 62) * 4.11290322580645195671422698069363832; //blue S20pixel3
			intComp = (b[inc+1]*256)+b[inc+2];
			buf8[i+3] = (((intComp & 496) * 0.514112903225806494589278372586704791)); //alpha S20pixel4


			i+=4;

			intComp = (256 * b[inc+2]) + b[inc+3];
			buf8[i] = (intComp & 3968) * 0.0642641129032258118236597965733380988; //red S20pixel5
			buf8[i+1] = (intComp & 124) * 2.05645161290322597835711349034681916; //green S20pixel6
			intComp = (256 * b[inc+3]) + b[inc+4];
			buf8[i+2] = (intComp & 992) * 0.257056451612903247294639186293352395; //blue S20pixel7
			buf8[i+3] = (((intComp & 31) * 8.22580645161290391342845396138727665)); //alpha S20pixel8

			inc+=5;
		}

		this.imageData.data.set(buf8);
		this.ctx.putImageData(this.imageData,0,0);
		return this.ctx.canvas.toDataURL();
	}

	decode20bit(b) { //yeah its crazy, the things we did though
		let s1 = 0,s2 = 0,inc = 0,
			buf = new ArrayBuffer(7744),
			buf8 = new Uint8ClampedArray(buf);


		for (let i = 0; i < 7744; i+=4) {
			s1=this.joinUShort(b[inc+1],b[inc+2]);
			buf8[i+3] = (((s1 & 48) * 5.3125));
			buf8[i] = (b[inc] & 252) * 1.01190476190476186246769429999403656;
			buf8[i+1] = (this.joinUShort(b[inc],b[inc+1]) & 1008) * 0.252976190476190465616923574998509139;
			buf8[i+2] = (s1 & 4032) * 0.0632440476190476164042308937496272847;

			i+=4;

			s1=this.joinUShort(b[inc+2],b[inc+3]);
			s2=b[inc+4];
			buf8[i+3] = (((s2 & 3) * 85));
			buf8[i] = (this.joinUShort(b[inc+2],b[inc+3]) & 4032) * 0.0632440476190476164042308937496272847;
			buf8[i+1] = (s1 & 63) * 4.04761904761904744987077719997614622;
			buf8[i+2] = (s2 & 252) * 1.01190476190476186246769429999403656;

			inc+=5;
		}

		this.imageData.data.set(buf8);
		this.ctx.putImageData(this.imageData,0,0);
		return this.ctx.canvas.toDataURL();
	}

	joinUShort(a,b) {
		let val = 0;
		val = a;
		val <<= 8;
		val |= b;
		return val;
	}

	decode(flags,uint8ary) {
		if (this.PROP_S20BIT(flags)) { // node zlib returns a node Buffer but it will be read just like a Uint8Array later on
			return this.decodeS20bit(zlib.inflateSync(uint8ary));
		} else if (this.PROP_20BIT(flags)) {
			return this.decode20bit(zlib.inflateSync(uint8ary));
		} else if (this.PROP_32BIT(flags)) {
			return this.decode32bit(zlib.inflateSync(uint8ary));
		//} else if (this.PROP_16BIT(flags)) {
			//return this.decode16bit(zlib.inflateSync(uint8ary));
		} else {
			return this.decode8bit(uint8ary);
		}
	}



	static get colorPalette() {
		return [
			// XBGR
			0xFFFEFEFE, 0xFFFFFFCC, 0xFFFFFF99, 0xFFFFFF66, 0xFFFFFF33, 0xFFFFFF00, 0xFFFFDFFF, 0xFFFFDFCC,
			0xFFFFDF99, 0xFFFFDF66, 0xFFFFDF33, 0xFFFFDF00, 0xFFFFBFFF, 0xFFFFBFCC, 0xFFFFBF99, 0xFFFFBF66,
			0xFFFFBF33, 0xFFFFBF00, 0xFFFF9FFF, 0xFFFF9FCC, 0xFFFF9F99, 0xFFFF9F66, 0xFFFF9F33, 0xFFFF9F00,
			0xFFFF7FFF, 0xFFFF7FCC, 0xFFFF7F99, 0xFFFF7F66, 0xFFFF7F33, 0xFFFF7F00, 0xFFFF5FFF, 0xFFFF5FCC,
			0xFFFF5F99, 0xFFFF5F66, 0xFFFF5F33, 0xFFFF5F00, 0xFFFF3FFF, 0xFFFF3FCC, 0xFFFF3F99, 0xFFFF3F66,
			0xFFFF3F33, 0xFFFF3F00, 0xFFFF1FFF, 0xFFFF1FCC, 0xFFFF1F99, 0xFFFF1F66, 0xFFFF1F33, 0xFFFF1F00,
			0xFFFF00FF, 0xFFFF00CC, 0xFFFF0099, 0xFFFF0066, 0xFFFF0033, 0xFFFF0000, 0xFFEEEEEE, 0xFFDDDDDD,
			0xFFCCCCCC, 0xFFBBBBBB, 0xFFAAFFFF, 0xFFAAFFCC, 0xFFAAFF99, 0xFFAAFF66, 0xFFAAFF33, 0xFFAAFF00,
			0xFFAADFFF, 0xFFAADFCC, 0xFFAADF99, 0xFFAADF66, 0xFFAADF33, 0xFFAADF00, 0xFFAABFFF, 0xFFAABFCC,
			0xFFAABF99, 0xFFAABF66, 0xFFAABF33, 0xFFAABF00, 0xFFAAAAAA, 0xFFAA9FFF, 0xFFAA9FCC, 0xFFAA9F99,
			0xFFAA9F66, 0xFFAA9F33, 0xFFAA9F00, 0xFFAA7FFF, 0xFFAA7FCC, 0xFFAA7F99, 0xFFAA7F66, 0xFFAA7F33,
			0xFFAA7F00, 0xFFAA5FFF, 0xFFAA5FCC, 0xFFAA5F99, 0xFFAA5F66, 0xFFAA5F33, 0xFFAA5F00, 0xFFAA3FFF,
			0xFFAA3FCC, 0xFFAA3F99, 0xFFAA3F66, 0xFFAA3F33, 0xFFAA3F00, 0xFFAA1FFF, 0xFFAA1FCC, 0xFFAA1F99,
			0xFFAA1F66, 0xFFAA1F33, 0xFFAA1F00, 0xFFAA00FF, 0xFFAA00CC, 0xFFAA0099, 0xFFAA0066, 0xFFAA0033,
			0xFFAA0000, 0xFF999999, 0xFF888888, 0xFF777777, 0xFF666666, 0xFF55FFFF, 0xFF55FFCC, 0xFF55FF99,
			0xFF55FF66, 0xFF55FF33, 0xFF55FF00, 0xFF55DFFF, 0xFF55DFCC, 0xFF55DF99, 0xFF55DF66, 0xFF55DF33,
			0xFF55DF00, 0xFF55BFFF, 0xFF55BFCC, 0xFF55BF99, 0xFF55BF66, 0xFF55BF33, 0xFF55BF00, 0xFF559FFF,
			0xFF559FCC, 0xFF559F99, 0xFF559F66, 0xFF559F33, 0xFF559F00, 0xFF557FFF, 0xFF557FCC, 0xFF557F99,
			0xFF557F66, 0xFF557F33, 0xFF557F00, 0xFF555FFF, 0xFF555FCC, 0xFF555F99, 0xFF555F66, 0xFF555F33,
			0xFF555F00, 0xFF555555, 0xFF553FFF, 0xFF553FCC, 0xFF553F99, 0xFF553F66, 0xFF553F33, 0xFF553F00,
			0xFF551FFF, 0xFF551FCC, 0xFF551F99, 0xFF551F66, 0xFF551F33, 0xFF551F00, 0xFF5500FF, 0xFF5500CC,
			0xFF550099, 0xFF550066, 0xFF550033, 0xFF550000, 0xFF444444, 0xFF333333, 0xFF222222, 0xFF111111,
			0xFF00FFFF, 0xFF00FFCC, 0xFF00FF99, 0xFF00FF66, 0xFF00FF33, 0xFF00FF00, 0xFF00DFFF, 0xFF00DFCC,
			0xFF00DF99, 0xFF00DF66, 0xFF00DF33, 0xFF00DF00, 0xFF00BFFF, 0xFF00BFCC, 0xFF00BF99, 0xFF00BF66,
			0xFF00BF33, 0xFF00BF00, 0xFF009FFF, 0xFF009FCC, 0xFF009F99, 0xFF009F66, 0xFF009F33, 0xFF009F00,
			0xFF007FFF, 0xFF007FCC, 0xFF007F99, 0xFF007F66, 0xFF007F33, 0xFF007F00, 0xFF005FFF, 0xFF005FCC,
			0xFF005F99, 0xFF005F66, 0xFF005F33, 0xFF005F00, 0xFF003FFF, 0xFF003FCC, 0xFF003F99, 0xFF003F66,
			0xFF003F33, 0xFF003F00, 0xFF001FFF, 0xFF001FCC, 0xFF001F99, 0xFF001F66, 0xFF001F33, 0xFF001F00,
			0xFF0000FF, 0xFF0000CC, 0xFF000099, 0xFF000066, 0xFF000033, 0xFF000000, 0xFF000000, 0xFF000000,
			0xFF000000, 0xFF000000, 0xFF000000, 0xFF000000, 0xFF000000, 0xFF000000, 0xFF000000, 0xFF000000,
			0xFFF0F0F0, 0xFFE0E0E0, 0xFFD0D0D0, 0xFFC0C0C0, 0xFFB0B0B0, 0xFFA0A0A0, 0xFF808080, 0xFF707070,
			0xFF606060, 0xFF505050, 0xFF404040, 0xFF303030, 0xFF202020, 0xFF101010, 0xFF080808, 0xFF000000
		];
	}
}
