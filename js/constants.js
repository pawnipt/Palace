window.onerror = function(e, url, line){
	logerror(e + "<br>" + url.split('/').pop() + "&nbsp;&nbsp;&nbsp;&nbsp;Line:" + line + '<br><br>');
	return true;
};

var okayChar = /^[a-zA-Z0-9-=_+!@#$%^&*()\]\[{}\\\|;:'"\.,<>\?\/]$/;
var linkSearch = /(\bhttps?:\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/i;

var win32 = (process.platform === 'win32');
var macOS = (process.platform === 'darwin');
var linux = (process.platform === 'linux');

var spotConsts = {
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

var propConsts = {
	head : 2,
	ghost :4,
	rare : 8,
	animated : 16,
	bounce : 32,
	png : 1024
};

var bubbleConsts = {
	padding : 9,
	radius : 14,
	spikeSize : 3,
	spikeSpread : 10,
	spoof : /(\-?\d+\s*)[\s,]*(\-?\d+\s*)/i,
	sound : /([a-zA-Z0-9\._-]*)(\s?)/i
};

var roomDrawConsts = {
	oval : 0x4000,
	text : 0x2000,
	shape : 0x0100,
	front : 0x8000,
	undo : 0x0004,
	clean : 0x0002,
	pen : 0
};

var TCPmsgConsts = {
ASSETNEW : 0x61417374,
ASSETQUERY : 0x71417374,
ASSETREGI : 0x72417374,
ASSETSEND : 0x73417374,
AUTHENTICATE : 0x61757468,
AUTHRESPONSE : 0x61757472,
DISPLAYURL : 0x6475726c,
DIYIT : 0x72796974,
DOORLOCK : 0x6c6f636b,
DOORUNLOCK : 0x756e6c6f,
DRAW : 0x64726177,
EXTENDEDINFO : 0x73496e66,
FILENOTFND : 0x666e6665,
FILEQUERY : 0x7146696c,
FILESEND : 0x7346696C,
GMSG : 0x676d7367,
HTTPSERVER : 0x48545450,
KILLUSER : 0x6b696c6c,
LISTOFALLROOMS : 0x724c7374,
LISTOFALLUSERS : 0x754c7374,
LOGOFF : 0x62796520,
LOGON : 0x72656769,
NAVERROR : 0x73457272,
PICTMOVE : 0x704c6f63,
PING : 0x70696e67,
PONG : 0x706f6e67,
PROPDEL : 0x64507270,
PROPMOVE : 0x6d507270,
PROPNEW : 0x6e507270,
RMSG : 0x726d7367,
ROOMDESC : 0x726f6f6d,
ROOMDESCEND : 0x656e6472,
ROOMGOTO : 0x6e617652,
ROOMNEW : 0x6e526f6d,
ROOMSETDESC : 0x73526f6d,
SERVERDOWN : 0x646f776e,
SERVERINFO : 0x73696e66,
SPOTDEL : 0x6f705364,
SPOTMOVE : 0x636f4c73,
SPOTNEW : 0x6f70536e,
SUPERUSER : 0x73757372,
TALK : 0x74616c6b,
TIYID : 0x74697972,
USERCOLOR : 0x75737243,
USERDESC : 0x75737244,
USEREXIT : 0x65707273,
USERFACE : 0x75737246,
USERLIST : 0x72707273,
USERLOG : 0x6c6f6720,
USERMOVE : 0x754c6f63,
USERNAME : 0x7573724e,
USERNEW : 0x6e707273,
USERPROP : 0x75737250,
USERSTATUS : 0x75537461,
VERSION : 0x76657273,
WHISPER : 0x77686973,
XTALK : 0x78746c6b,
XWHISPER : 0x78776973,
BLOWTHRU : 0x626c6f77,
SPOTSTATE : 0x73537461,
SMSG : 0x736d7367,
ALTLOGONREPLY : 0x72657032,
JSON : 0x6a736f6e,
IPTSIGNAL : 0x69707473
};


var drawType = {
OVAL : 0x4000,
TEXT : 0x2000,
SHAPE : 0x0100,
PENFRONT : 0x8000,
CLEAN : 0x0002,
UNDO : 0x0004
};
