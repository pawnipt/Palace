// @flow

window.onerror = function(e, url, line){
	logerror(e + "<br>" + url.split('/').pop() + "&nbsp;&nbsp;&nbsp;&nbsp;Line:" + line + '<br><br>');
	// return true;
};

const linkSearch = /(\bhttps?:\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/i;

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



const bubbleConsts = {
	padding : 9,
	spikeSize : 3,
	spikeSpread : 10,
	spoof : /(\-?\d+\s*)[\s,]*(\-?\d+\s*)/i,
	sound : /([a-zA-Z0-9\._-]*)(\s?)/i
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
