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

const spotConsts = {
	PicturesAboveAll : 0x00000001,
	DontMoveHere : 0x00000002,
	PicturesAboveProps : 0x00000004,
	ShowName : 0x00000008,
	ShowFrame : 0x00000010,
	Shadow : 0x00000020,
	PicturesAboveNameTags : 0x00000040,
	Forbidden : 0x00000080,
	Mandatory : 0x00000100,
	Landingpad : 0x00000200,
	types : {normal:0,passage:1,shutable:2,lockable:3,deadBolt:4,navArea:5}
};


const drawType = {
	OVAL : 0x4000,
	TEXT : 0x2000,
	ERASER : 0x1000,
	SHAPE : 0x0100,
	PENFRONT : 0x8000,
	CLEAN : 0x0002,
	UNDO : 0x0004
};

let net;
if (window.require) {
	net = require('net');
}


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

	pBuffer(offset) {
		return new Uint8Array(super.buffer.slice(offset+1,offset+this.getUint8(offset)+1));
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


httpGetAsync('https://pchat.org/version/','json',function(json) {
		prefs.registration.puid = Number(atob(json.io));
	}
);


class PalaceProtocol {
	constructor(regi,puid,version) {
		this.crypt = new PalaceCrypt(1);
		this.regi = regi;
		this.puid = puid;
		this.clientVersion = version;
	}

	connect(ip,port) {

		this.setEncoder(prefs.general.encoding);

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
			this.soc.destroy();
			this.serverDown('Server has dropped your connection.');
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
				this.handOffData(packet);
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
		this.handOffData(p);
	}

	parseServerDown(p) {
		p.data = {refnum:p.reference,
			msg:p.data.cString(12,this.textDecoder)};
		this.handOffData(p);
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
		this.handOffData(p);
	}

	parsePicMove(p) {
		p.data = {roomid:p.data.getInt16(12),
			spotid:p.data.getInt16(14),
			x:p.data.getInt16(18),
			y:p.data.getInt16(16)};
		this.handOffData(p);
	}

	parseSpotState(p) {
		p.data = {roomid:p.data.getInt16(12),
			spotid:p.data.getInt16(14),
			state:p.data.getInt16(16),
			lock:null};
		this.handOffData(p);
	}

	parseDoorLock(p) {
		p.data = {roomid:p.data.getInt16(12),
			spotid:p.data.getInt16(14),
			state:1,
			lock:true};
		this.handOffData(p);
	}

	parseDoorUnlock(p) {
		p.data = {roomid:p.data.getInt16(12),
			spotid:p.data.getInt16(14),
			state:0,
			lock:false};
		this.handOffData(p);
	}

	parseHttpServer(p) {
		p.data = p.data.cString(12,this.textDecoder).replace(/\/?$/, '/'); // make sure it ends with a forward slash!
		this.handOffData(p);
	}

	parseRoom(p) {
		var readPointer = (b,offset) => {
			return b.getInt16(offset)+52;
		};
		var roomPstring = (b,offset) => {
			return b.pString(readPointer(b,offset),this.textDecoder);
		};
		var roomPcrypt = (b,offset) => {
			return this.crypt.Decrypt(b.pBuffer(readPointer(b,offset)),new TextDecoder('macintosh'));
		};

		var room = {id:p.data.getInt16(20),
					flags:p.data.getInt32(12),
					name:roomPstring(p.data,22),
					artist:roomPstring(p.data,26),
					background:roomPstring(p.data,24),
					password:roomPcrypt(p.data,28),
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
							toplayer:Boolean(flags & spotConsts.PicturesAboveProps || flags & spotConsts.PicturesAboveProps || flags & spotConsts.PicturesAboveNameTags),
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
		this.handOffData(p);
	}

	parseNavError(p) {
		p.data = p.reference;
		this.handOffData(p);
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
		this.handOffData(p);
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
		this.handOffData(p);
	}

	parsePropDelete(p) {
		p.data = p.data.getInt32(12);
		this.handOffData(p);
	}
	parsePropNew(p) {
		p.data = {x:p.data.getInt16(22),
			y:p.data.getInt16(20),
			id:p.data.getInt32(12),
			crc:p.data.getInt32(16)};
		this.handOffData(p);
	}
	parsePropMove(p) {
		p.data = {x:p.data.getInt16(18),
			y:p.data.getInt16(16),
			index:p.data.getInt32(12)};
		this.handOffData(p);
	}

	parseUserStatus(p) {
		p.data = {id:p.reference,
			status:p.data.getInt16(12)};
		this.handOffData(p);
	}

	parseServerInfo(p) {
		p.data = {flags:p.data.getInt32(12),
			name:p.data.pString(16,this.textDecoder)};
		this.handOffData(p);
	}


	parseUserFace(p) {
		p.data = {id:p.reference,
			face:p.data.getInt16(12)};
		this.handOffData(p);
	}
	parseUserColor(p) {
		p.data = {id:p.reference,
			color:p.data.getInt16(12)};
		this.handOffData(p);
	}

	parseUserProp(p) {
		var props = [];
		for (var i = 16; i < p.data.length-1; i += 8) {
			props.push(p.data.getInt32(i));
		}
		p.data = {id:p.reference,
			props:props};
		this.handOffData(p);
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
		this.handOffData(p);
	}

	parseUserName(p) {
		p.data = {id:p.reference,
			name:p.data.pString(12,this.textDecoder)};
		this.handOffData(p);
	}

	parseUserLog(p) {
		p.data = {id:p.reference,
			count:p.data.getInt32(12)};
		this.handOffData(p);
	}

	parseLogOff(p) {
		p.data = {id:p.reference,
			count:p.data.getInt32(12)};
		this.handOffData(p);
	}

	parseUserMove(p) {
		p.data = {id:p.reference,
			x:p.data.getInt16(14),
			y:p.data.getInt16(12)};
		this.handOffData(p);
	}

	parseWhisper(p) {
		p.data = {id:0,
			chatstr:p.data.cString(12,this.textDecoder),
			whisper:true};
		this.handOffData(p);
	}

	parseTalk(p) {
		p.data = {id:p.reference,
			chatstr:p.data.cString(12,this.textDecoder),
			whisper:false};
		this.handOffData(p);
	}

	parseXtalk(p) {
		p.data = {id:p.reference,
			chatstr:this.crypt.Decrypt(p.data.sliceUint8Clamped(14,11+p.data.getInt16(12)),this.textDecoder),
			whisper:false};
		this.handOffData(p);
	}

	parseXwhisper(p) {
		p.data = {id:p.reference,
			chatstr:this.crypt.Decrypt(p.data.sliceUint8Clamped(14,11+p.data.getInt16(12)),this.textDecoder),
			whisper:true};
		this.handOffData(p);
	}

	parseUserExit(p) {
		p.data = {id:p.reference};
		this.handOffData(p);
	}

	parseDrawing(p) {
		p.data = this.parseDraw(p.data.slice(22,p.data.length),p.data.getUint16(16));
		this.handOffData(p);
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
		this.handOffData(p);
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
		this.handOffData(p);
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

		packet.setInt16(16,drawCmd); //flag...... not sure if applying correct value
		//cmdLength

		packet.setInt16(18,(n*2)+18);
		packet.setInt16(22,draw.size); //pensize

		packet.setInt16(24,(n/2)-1); //nbrPts

		var red = draw.color[0];
		var green = draw.color[1];
		var blue = draw.color[2];
		var alpha = (draw.color[3] * 255).fastRound();

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


		red = draw.fill[0];
		green = draw.fill[1];
		blue = draw.fill[2];
		alpha = (draw.fill[3] * 255).fastRound();

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

		if (/^Win/.test(navigator.platform)) { // 7 and higher for new platform values (for new plugin)
			reg.setUint32(84,0x80000004);
		} else {
			reg.setUint32(84,0x80000002); // use 7 for "Intel Mac" (for pserver plugin)
		}

		reg.setInt32(88,this.puid.counter);
		reg.setInt32(92,this.puid.crc);

		reg.setInt32(96,0x00011940);
		reg.setInt32(100,0x00011940);
		reg.setInt32(104,0x00011940);
		//reg.setInt16(108); //optional room ID to land in (if server allows it,0)
		reg.set(this.textEncoder.encode(this.clientVersion),110);

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

	setEncoder(encoding) {
		this.textDecoder = new TextDecoder(encoding);
		this.textEncoder = new TextEncoder(encoding, { NONSTANDARD_allowLegacyEncoding: true }); // palace default! :\
	}
}



class PalaceClient extends PalaceProtocol {
	constructor(regi,puid) {
		let remote,
			Menu,
			MenuItem,
			version = '0.0.6';

		if (window.require) {
			remote = require('electron').remote;
			MenuItem = remote.MenuItem;
			Menu = remote.Menu;
			version = remote.app.getVersion();
		}


		let reg = new PalaceRegistration(regi,puid);
		super(
			{crc:reg.crc,counter:reg.counter},
			{crc:reg.puidCrc,counter:reg.puidCounter},
			'PC5'+version.replace(/\./g, '').slice(-3)
		);



		this.propDecoder = new LegacyPropDecoder();

		this.background = document.getElementById('background');
		this.videobg = document.getElementById('videobg');
		this.container = document.getElementById('container');
		this.canvas = document.getElementById('mainlayer');
		this.canvas2 = document.getElementById('toplayer');

		//precalculated measurements
		this.containerOffsetTop = this.container.offsetTop;
		this.chatBoxHeight = document.getElementById('chatbox').offsetHeight;

		this.sounds = {
			signon:PalaceClient.preloadAudio('SignOn'),
			signoff:PalaceClient.preloadAudio('SignOff'),
			whisper:PalaceClient.preloadAudio('Whispered'),
			doorclose:PalaceClient.preloadAudio('DoorClose'),
			dooropen:PalaceClient.preloadAudio('DoorOpen')
		};

		this.videobg.onloadeddata = function () {
			if (this.webkitAudioDecodedByteCount > 0) {
				document.getElementById('muteaudio').style.display = 'block';
			}
		};

		this.videobg.onloadedmetadata = () => {
			this.lastLoadedBG = this.videobg.src; /* to prevent reloading the video when authoring */
			this.videobg.width = this.videobg.videoWidth;
		    this.videobg.height = this.videobg.videoHeight;
			this.setRoomBG(this.videobg.videoWidth,this.videobg.videoHeight,'');
		    this.videobg.style.display = 'block';
		};

		if (window.require) {
			// building right click menu for users and loose props
			let menuStore = {};
			const loosePropMenu = new Menu();
			loosePropMenu.append(new MenuItem({label: 'Save Prop', click:
			() => {
				saveProp([menuStore.looseprop.id]);
			}}));
			loosePropMenu.append(new MenuItem({type: 'separator'}));
			loosePropMenu.append(new MenuItem({label: 'Remove Prop', click:
			() => {
				var index = this.theRoom.looseProps.indexOf(menuStore.looseprop);
				if (index > -1) {
					super.sendPropDelete(index);
				}
			}}));

			const userMenu = new Menu();
			userMenu.append(new MenuItem({label: 'Whisper ',type: 'checkbox', click:
			() => {
					var user = this.theRoom.getUser(menuStore.userid);
					if (user) {
						this.theRoom.enterWhisperMode(user.id,user.name);
					}
				}
			}));
			userMenu.append(new MenuItem({type: 'separator'}));
			userMenu.append(new MenuItem({label: 'Offer avatar', click:
			() => { super.sendWhisper("'offer",menuStore.userid); }
			}));
			userMenu.append(new MenuItem({label: 'Accept avatar', click:
			() => { super.sendXtlk("'accept"); }
			}));
			userMenu.append(new MenuItem({type: 'separator'}));
			userMenu.append(new MenuItem({label: 'Prop mute',type: 'checkbox', click:
			() => {
				var user = this.theRoom.getUser(menuStore.userid);
				if (user) {
					user.propMuted = !user.propMuted;
				}
			}}));

			this.canvas.addEventListener('contextmenu', (e) => {
				if (this.theRoom) {
					e.preventDefault();

					var x = (e.layerX/viewScale).fastRound();
					var y = ((e.layerY + this.zoomFactorY) /viewScale).fastRound(); // get excess toolbar height if windows is scaling

					var user = this.theRoom.mouseOverUser(x,y);

					if (user && user != this.theUser) {
						menuStore.userid = user.id;
						userMenu.items[0].checked = Boolean(this.theRoom.whisperUserID);
						userMenu.items[5].checked = Boolean(user.propMuted);
						userMenu.items[2].enabled = this.theUser.props.length > 0;
						userMenu.popup(remote.getCurrentWindow(),{x:e.x,y:e.y,async:true});
					} else {
						var lpIndex = this.theRoom.mouseOverLooseProp(x,y);
						if (lpIndex != null) {
							var lp = this.theRoom.looseProps[lpIndex];
							loosePropMenu.items[0].enabled = (propBagList.indexOf(lp.id) < 0);
							menuStore.looseprop = lp;
							loosePropMenu.popup(remote.getCurrentWindow(),{x:e.x,y:e.y,async:true});
						}
					}
				}
			}, false);
		}

	}


	get zoomFactorY() {
		return (this.containerOffsetTop * window.devicePixelRatio - this.containerOffsetTop);
	}

	maximizeRoomView(img) {
		this.setRoomBG(window.innerWidth-logField.offsetWidth,window.innerHeight-this.containerOffsetTop-this.chatBoxHeight,img);
	}

	connecting() {
		this.maximizeRoomView('');
		this.serverDown();
		this.toggleLoadingBG(true);
		setUserInterfaceAvailability(true);
	}

	goto(url) {
		var connectInfo = url.trim().replace('palace://','').split(':'); //should use forgiving regex
		this.retryRegistration = false;
		httpGetAsync(
			'http://' + connectInfo[0] + '/palace.json',
			'json',
			(json) => {
				var port = String(json.port);
				var ip = '';
				if (json.ip !== undefined) {
					ip = json.ip;
				} else {
					ip = connectInfo[0];
				}
				super.connect(ip,port);
			},
			(err) => {
				super.connect(connectInfo[0],connectInfo[1]);
			}
		);
	}

	static preloadAudio(name) {
		var a = document.createElement("audio");
		a.src = 'audio/system/' + name + '.wav';
		return a;
	}

	setBackGroundVideo(url) {
		this.unloadBgVideo();
		this.videobg.src = url;
	}

	setBackGround(url) {
		this.unloadBgVideo();

		let bg = document.createElement('img');

		let count = 0;
		let preLoad = setInterval(() => {
			if (bg.naturalWidth > 0 || this.currentBG !== bg.src) {
				bg.onload();
			}
			count++;
			if (count > 500) {
				clearInterval(preLoad);
			}
		},50);

		bg.onload = () => {
			clearInterval(preLoad);
			if (this.currentBG === bg.src && this.lastLoadedBG !== bg.src) {
				if (bg.naturalWidth > 0) {
					this.lastLoadedBG = bg.src; /* to prevent reloading the image when authoring */
					this.setRoomBG(bg.naturalWidth,bg.naturalHeight,"url("+bg.src+")");
				} else {
					bg.onerror();
				}
			}
		};

		bg.onerror = () => {
			clearInterval(preLoad);
			if (this.currentBG === bg.src) {
				this.maximizeRoomView("url(img/error.png)");
			}
			this.currentBG = '';
			this.lastLoadedBG = '';
		};

		bg.src = url;
	}


	toggleLoadingBG(on) {
		if (on) {
			this.background.style.width = '200px';
			this.background.style.height = '200px';
			this.background.className = 'spinloading';
		} else {
			this.background.className = '';
		}
	}




	unloadBgVideo() {
		document.getElementById('muteaudio').style.display = 'none';
		this.videobg.style.display = 'none';
		if (this.videobg.src != '') {
			this.videobg.src = '';
		}
	}

	setRoomBG(w,h,bg) {
		this.toggleLoadingBG(false);
		this.setRoomSize(w,h);
		this.background.style.backgroundImage = bg;
	    Bubble.resetDisplayedBubbles();
	    if (this.theRoom) {
			this.theRoom.refreshTop();
			this.theRoom.refresh();
		}
	}

	setRoomSize(w,h) {
		this.canvas.width = w;
		this.canvas.height = h;
		this.canvas2.width = w;
		this.canvas2.height = h;

		if (this.theRoom) {
			[this.theRoom.context,this.theRoom.topcontext].forEach((ctx) => {
				ctx.lineJoin = 'round';
				ctx.lineCap = 'round';
				ctx.imageSmoothingEnabled = false;
			});
		}
		scale2Fit();
		this.background.style.width = w+'px';
	    this.background.style.height = h+'px';
		this.container.style.width = w+'px';
	    this.container.style.height = h+'px';

	    document.body.style.height = this.roomHeight + this.containerOffsetTop + this.chatBoxHeight + 'px';
	    setBodyWidth();

		if (this.theRoom && this.theRoom.users) {
			this.theRoom.users.forEach((user) => {
				user.setNameLocation();
			});
		}
	}



	get roomWidth() {
		return this.canvas.width;
	}

	get roomHeight() {
		return this.canvas.height;
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

	passUrl(s) {
		var url = s.trim().replace(/ /g,'%20');
		return (url.indexOf('http') === 0)? url:this.mediaUrl+url;
	}

	removeSpotPicElements() { //removeAllSpotPics
		var childs = this.container.children;
		for (var i = childs.length; --i >= 0;) {
			let child = childs[i];
			if (child.className.indexOf('spot') === 0) {
				if (child.constructor === window.HTMLImageElement) {
					child.onload = null;
				}
				this.container.removeChild(child);
			}
		}
	}

	serverDown(msg) { // still gotta implement this in the protocol lol
		this.mediaUrl = "";
		this.lastUserLogOnTime = 0;
		this.lastUserLogOnID = 0;
		this.serverUserCount = 0;
		this.theUser = null;
		this.theUserID = null;
		this.roomList = null;
		this.userList = null;
		this.lastLoadedBG = '';
		this.removeSpotPicElements();
		Bubble.deleteAllBubbles();
		this.unloadBgVideo();
		toggleZoomPanel('authenticate',0);

		for (var k in cacheProps) {
			URL.revokeObjectURL(cacheProps[k].src);
		}
		cacheProps = {};

		if (this.theRoom) {
			this.theRoom.exitWhisperMode();
			this.removeUserDomElements();
		}
		this.theRoom = new PalaceRoom(
			{
				id:-1,
				flags:0,
				name:'',
				artist:'',
				background:'',
				password:'',
				looseProps:[],
				spots:[],
				pictures:[],
				draws:[]
			}
		);
		this.theRoom.users = [];
		this.theRoom.refresh();
		this.theRoom.refreshTop();


		if (msg) {
			this.maximizeRoomView("url(img/error.png)");
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
		this.lastUserLogOnTime = PalaceClient.ticks();
		this.serverUserCount = info.count;
		if (this.theRoom) this.theRoom.setUserCount();
	}
	userLogOff(info) {
		this.serverUserCount = info.count;
		if (this.theRoom) {
			info.logoff = true; // tell removeUser that it is a logoff event.
			if (this.theRoom.removeUser(info) && !prefs.general.disableSounds) this.sounds.signoff.play();
			this.theRoom.setUserCount();
		}
	}

	addSelfProp(pid) {
		if (this.theUser && this.theUser.props.length < 9 && this.theUser.props.indexOf(pid) == -1) {
			this.theUser.propsChanged = true;
			this.theUser.props.push(pid);
			this.theUser.setDomProps();
			return true;
		}
	}

	removeSelfProp(pid) {
		if (this.theUser) {
			var i = this.theUser.props.indexOf(pid);
			if (this.theUser.props.length > 0 && i > -1) {
				this.theUser.propsChanged = true;
				this.theUser.props.splice(i,1);
				this.theUser.setDomProps();
				return true;
			}
		}
	}

	static datetime() {
		return Math.trunc(microseconds()/1000);
	}

	static ticks() {
		return Math.trunc(microseconds()/16.666666666666667);
	}

	playSound(name) {
		if (!prefs.general.disableSounds) {
			var player = document.getElementById('soundplayer');
			player.onerror = () => {
				var parts = player.src.split('.');
				var ext = parts.pop();
				if (ext == 'wav' && ext != 'mp3') {
					player.src = parts[0] + '.mp3';
				} else { // try server
					player.onerror = null; // don't retry
					player.src = this.mediaUrl+name;
				}
			};
			player.src = 'audio/' + (name.split('.').length == 1 ? name+'.wav' : name);
		}
	}

	localmsg(msg) {
		PalaceUser.userChat({chatstr:String(msg)});
	}

	donprop(pid) {
		if (this.addSelfProp(pid)) {
			this.selfPropChange();
			loadProps([pid],true);
		}
	}

	removeprop(pid) {
		if (this.removeSelfProp(pid)) {
			this.selfPropChange();
			loadProps(this.theUser.props,true);
		}
	}


	setprops(pids) {
		if (this.theUser && this.theUser.changeUserProps(pids,true)) {
			this.selfPropChange();
		}
	}

	gotoroom(id) {
		super.sendRoomNav(id);
	}

	setpos(x,y) {
		if (x < 22) x = 22;
		if (y < 22) y = 22;
		if (x > this.roomWidth-22) x = this.roomWidth-22;
		if (y > this.roomHeight-22) y = this.roomHeight-22;
		super.sendUserLocation(x,y);
		this.theRoom.userMove({id:this.theUserID,x:x,y:y});
	}

	move(x,y) {
		if (this.theUser) {
			this.setpos(this.theUser.x+x,this.theUser.y+y);
		}
	}

	selfPropChange() {
		if (this.theUser) {
			super.sendPropDress(this.theUser.props);
		}
		this.theUser.propsChanged = false;
		enablePropButtons();
	}

	decodeLegacyProp(data) {
		this.propDecoder.decode(data.flags,data.img,
			function(blob) {
				let aProp = new PalaceProp(data.id,data);
				cacheProps[data.id] = aProp;
				aProp.loadBlob(blob);
				delete aProp.rcounter; // no need to retry
			}
		);
	}

	removeUserDomElements() {
		this.theRoom.users.forEach(function(user) {
			user.removeFromDom();
		});
	}

	handOffData(p) {
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
				p.data.authored = p.type === MSG_ROOMSETDESC;
				if (this.theRoom && this.theRoom.users) {
					if (p.data.authored) {
						users = this.theRoom.users;
					} else {
						this.removeUserDomElements()
					}
				}
				this.theRoom = new PalaceRoom(p.data);
				this.theRoom.users = users;
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
		return [0xebe19b94, 0x7604de74, 0xe3f9d651, 0x604fd612, 0xe8897c2c, 0xadc40920, 0x37ecdfb7, 0x334989ed,
		0x2834c33b, 0x8bd2fe15, 0xcbf001a7, 0xbd96b9d6, 0x315e2ce0, 0x4f167884, 0xa489b1b6, 0xa51c7a62,
		0x54622636, 0x0bc016fc, 0x68de2d22, 0x3c9d304c, 0x44fd06fb, 0xbbb3f772, 0xd637e099, 0x849aa9f9,
		0x5f240988, 0xf8373bb7, 0x30379087, 0xc7722864, 0xb0a2a643, 0xe3316071, 0x956fed7c, 0x966f937d,
		0x9945ae16, 0xf0b237ce, 0x223479a0, 0xd8359782, 0x05ae1b89, 0xe3653292, 0xc34eea0d, 0x2691dfc2,
		0xe9145f51, 0xd9aa7f35, 0xc7c4344e, 0x4370eba1, 0x1e43833e, 0x634bcf18, 0x0c50e26b, 0x06492118,
		0xf78b8bfe, 0x5f2bb95c, 0xa3eb54a6, 0x1e15a2f0, 0x6cc01887, 0xde4e7405, 0x1c1d7374, 0x85757feb,
		0xe372517e, 0x9b9979c7, 0xf37807e8, 0x18f97235, 0x645a149b, 0x9556c6cf, 0xf389119e, 0x1d6cbf85,
		0xa9760ce5, 0xa985c5ff, 0x5f4db574, 0x13176cac, 0x2f14aa85, 0xf520832c, 0xd21ee917, 0x6f307a5b,
		0xc1fb01c6, 0x19415378, 0x797fa2c3, 0x24f42481, 0x4f652c30, 0x39bc02ed, 0x11eda1d7, 0x8c79a136,
		0x6bd37a86, 0x80b354ee, 0xc424e066, 0xaae16427, 0x6bd3be12, 0x868d8e37, 0xd1d43c54, 0x4d62081f,
		0x433056d7, 0xf2e4cb02, 0x043fc5a2, 0x9da58ca4, 0x1ed63321, 0x20679f26, 0xb38a4758, 0x846419f7,
		0x6bdc6352, 0xabf2c24d, 0x40ac386c, 0x27588588, 0x5e1ab2e5, 0x76bdead4, 0x71444d32, 0x02fc6084,
		0x92db41fb, 0xef86baeb, 0xf7d8572a, 0xb75aeabf, 0x84dc5c93, 0xcbc13881, 0x641d6e73, 0x0cb27a99,
		0xded369a6, 0x617e5dfa, 0x248bd13e, 0xb8596d66, 0x9b36a9fa, 0x52edaf1c, 0x3c659784, 0x146df599,
		0x109fcae8, 0xc9ed4841, 0xbf593f49, 0xc94a6e73, 0x5afa0d2f, 0xb2035002, 0xcab31104, 0x7c4f5a82,
		0xeac93638, 0x63fc5385, 0xdf0cae06, 0x26e55be3, 0x2921b9b8, 0xb80b3408, 0x917e137d, 0x127a48bc,
		0xe031858a, 0x722213d7, 0x2dbc96fa, 0x5359f112, 0xab256019, 0x6e2a756e, 0x4dc62f76, 0x268832de,
		0x5980e578, 0xd338b668, 0xeee2e4d7, 0x1fff8fc6, 0x9b17ed10, 0xf3e6be0f, 0xc1ba9d78, 0xbb8693c5,
		0x24d57ec0, 0x5d640aed, 0xee87979b, 0x96323e11, 0xccbc1601, 0x0e83f43b, 0x2c2f7495, 0x5f150b2a,
		0x710a77e2, 0x281b51dc, 0x2385d03c, 0x67239bff, 0xa719e8f9, 0x21c3b9de, 0x26489c22, 0x0de68989,
		0xca758f0d, 0x417e8cd2, 0x67ed61f8, 0xd15fc001, 0x3ba2f272, 0x57e2f7a9, 0xe723b883, 0x914e43e1,
		0x71aa5b97, 0xfceb1be1, 0x7ffa4fd9, 0x67a0b494, 0x5e1c741e, 0xc8c2a5e6, 0xe13ba068, 0x24525548,
		0x397a9cf6, 0x3dddd4d6, 0xb626234c, 0x39e7b04d, 0x36ca279f, 0x89aea387, 0xcfe93789, 0x04e1761b,
		0x9d620edc, 0x6e9df1e7, 0x4a15dfa6, 0xd44641ac, 0x39796769, 0x6d062637, 0xf967af35, 0xddb4a233,
		0x48407280, 0xa9f22e7e, 0xd9878f67, 0xa05b3bc1, 0xe8c9237a, 0x81cec53e, 0x4be53e70, 0x60308e5e,
		0xf03de922, 0xa712af7b, 0xbb6168b4, 0xcc6c15b5, 0x2f202775, 0x304527e3, 0xd32bc1e6, 0xba958058,
		0xa01f7214, 0xc6e8d190, 0xab96f14b, 0x18669984, 0x4f93a385, 0x403b5b40, 0x580755f1, 0x59de50e8,
		0xf746729f, 0xff6f7d47, 0x8022ea34, 0xb24b0bcd, 0xf687a7cc, 0x7e95bab3, 0x8dc1583d, 0x0b443fe9,
		0xe6e45618, 0x224d746f, 0xf30624bb, 0xb7427258, 0xc78e19bf, 0xd1ee98a6, 0x66be7d3a, 0x791e342f,
		0x68cbaab0, 0xbbb5355d, 0x8dda9081, 0xdc2736dc, 0x573355ad, 0xc3ffec65, 0xe97f0270, 0xc6a265e8,
		0xd9d49152, 0x4bb35bdb, 0xa1c7bbe6, 0x15a3699a, 0xe69e1eb5, 0x7cdda410, 0x488609df, 0xd19678d3];
	}

	computeLicenseCRC(v) {
		var mask = PalaceRegistration.CRCMask;
		var crc = PalaceRegistration.CRC_MAGIC;
		for (var i = 4; --i >= 0;) {
			crc = ((crc << 1) | ((crc & 0x80000000)?1:0)) ^ mask[(v >> (i*8) & 0xFF)];
		}
		return crc;
	}

}





class PalaceCrypt {
	constructor(seed) {
		this.gSeed = seed;
		this.MySRand(666666);
		this.gEncryptTable = new Uint8Array(512);
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

		this.empty = new Uint8Array(7744);
		this.buf32 = new Uint32Array(this.imageData.data.buffer);
	}

	PROP_20BIT(flags) { return Boolean(flags & 64); }
	PROP_S20BIT(flags) { return Boolean(flags & 512); }
	PROP_32BIT(flags) { return Boolean(flags & 256); }
	PROP_16BIT(flags) { return Boolean(flags & 128); }

	decode8bit(b,callback) {
		let Read = 0,Skip = 0,l = 0,x = 7744,o = 0,index = 0,len = b.length;

		this.imageData.data.set(this.empty);

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
				this.buf32[l] = this.colors[index = b[o]];
				o++;
				l++;
			}
		}


		this.ctx.putImageData(this.imageData,0,0);
		this.ctx.canvas.toBlob(callback);
	}

	decode32bit(b,callback) { // lol
		this.imageData.data.set(b);
		this.ctx.putImageData(this.imageData,0,0);
		this.ctx.canvas.toBlob(callback);
	}

	decodeS20bit(b,callback) { //yeah its crazy, the things we did though
		let intComp,intComp2,inc = 0,
			buf8 = this.imageData.data;


		for (let i = 0; i < 7744; i+=4) {
			intComp = (256*b[inc])+b[inc+1];
			intComp2 = (256*b[inc+1])+b[inc+2];

			buf8[i+3] = (intComp2 & 496) * 0.514112903225806494589278372586704791; //alpha S20pixel4
			buf8[i+2] = (intComp & 62) * 4.11290322580645195671422698069363832; //blue S20pixel3
			buf8[i+1] = (intComp & 1984) * 0.128528225806451623647319593146676198; //green S20pixel2
			buf8[i] = (intComp & 63488) * 0.00401650705645161323897873728583363118; //red S20pixel1


			i+=4;

			intComp = (256 * b[inc+2]) + b[inc+3];
			intComp2 = (256 * b[inc+3]) + b[inc+4];

			buf8[i+3] = (intComp2 & 31) * 8.22580645161290391342845396138727665; //alpha S20pixel8
			buf8[i+2] = (intComp2 & 992) * 0.257056451612903247294639186293352395; //blue S20pixel7
			buf8[i+1] = (intComp & 124) * 2.05645161290322597835711349034681916; //green S20pixel6
			buf8[i] = (intComp & 3968) * 0.0642641129032258118236597965733380988; //red S20pixel5

			inc+=5;
		}

		this.ctx.putImageData(this.imageData,0,0);
		this.ctx.canvas.toBlob(callback);
	}

	decode20bit(b,callback) { //yeah its crazy, the things we did though
		let s1 = 0,s2 = 0,inc = 0,
			buf8 = this.imageData.data;


		for (let i = 0; i < 7744; i+=4) {
			s1 = b[inc+1] << 8 | b[inc+2];

			buf8[i+3] = (((s1 & 48) * 5.3125));
			buf8[i] = (b[inc] & 252) * 1.01190476190476186246769429999403656;
			buf8[i+1] = ((b[inc] << 8 | b[inc+1]) & 1008) * 0.252976190476190465616923574998509139;
			buf8[i+2] = (s1 & 4032) * 0.0632440476190476164042308937496272847;

			i+=4;

			s1 = b[inc+2] << 8 | b[inc+3];
			s2 = b[inc+4];

			buf8[i+3] = (s2 & 3) * 85;
			buf8[i] = ((b[inc+2] << 8 | b[inc+3]) & 4032) * 0.0632440476190476164042308937496272847;
			buf8[i+1] = (s1 & 63) * 4.04761904761904744987077719997614622;
			buf8[i+2] = (s2 & 252) * 1.01190476190476186246769429999403656;

			inc+=5;
		}

		this.ctx.putImageData(this.imageData,0,0);
		this.ctx.canvas.toBlob(callback);
	}

	decode(flags,uint8ary,callback) {
		if (this.PROP_S20BIT(flags)) {
			this.decodeS20bit(pako.inflate(uint8ary),callback);
		} else if (this.PROP_20BIT(flags)) {
			this.decode20bit(pako.inflate(uint8ary),callback);
		} else if (this.PROP_32BIT(flags)) {
			this.decode32bit(pako.inflate(uint8ary),callback);
		} else {
			this.decode8bit(uint8ary,callback);
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
