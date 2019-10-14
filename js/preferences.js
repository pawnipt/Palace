// @flow

var prefs = {general:{},control:{},draw:{type:0,size:2,front:true,color:"rgba(255,0,0,1)",fill:"rgba(255,166,0,0.5)"}},
	propBagList = [];


window.onerror = function(e, url, line){
	logerror(e + "<br>" + url.split('/').pop() + "&nbsp;&nbsp;&nbsp;&nbsp;Line:" + line + '<br><br>');
};

function setControlPrefs(id,obj) {
	prefs.control[id] = obj;
}

function getControlPrefs(id) {
	return prefs.control[id];
}

function setGeneralPref(id,value) {
	prefs.general[id] = value;
}

function getGeneralPref(id,def) {
	return prefs.general.hasOwnProperty(id) ? prefs.general[id] : def;
}

window.onunload = function(e) {
	localStorage.preferences = JSON.stringify(prefs);
};

(function () { // LOAD PREFERENCES
	let a;
	if (localStorage.preferences) { // redo preferences!
		prefs = JSON.parse(localStorage.preferences);

		let drawcolor = document.getElementById('drawcolor');
		drawcolor.style.backgroundColor = prefs.draw.color;
		drawcolor.value = rgbToHex(prefs.draw.color);

		let drawfill = document.getElementById('drawfill');
		drawfill.style.backgroundColor = prefs.draw.fill;
		drawfill.value = rgbToHex(prefs.draw.fill);

		document.getElementById('drawsize').value = prefs.draw.size;
		a = getGeneralPref('propBagWidth');
		if (a) propBag.style.width = a+'px';
		a = getGeneralPref('chatLogWidth');
		if (a) logField.style.width = a+'px';
		a = getGeneralPref('propBagTileSize');
		if (a) document.getElementById('prefpropbagsize').value = a;
		a = getGeneralPref('viewScales');
		if (typeof a === 'boolean') document.getElementById('prefviewfitscale').checked = a;
		a = getGeneralPref('viewScaleAll');
		if (typeof a === 'boolean') document.getElementById('prefviewscaleall').checked = a;
		a = getGeneralPref('disableSounds');
		if (typeof a === 'boolean') document.getElementById('prefdisablesounds').checked = a;
		a = getGeneralPref('autoplayvideos');
		if (typeof a === 'boolean') document.getElementById('prefautoplayvideos').checked = a;
		setDrawType();
	} else { //default
		prefs.registration = {regi:getRandomInt(100,2147483647),puid:2000000000};
		setGeneralPref('home','ee.fastpalaces.com:9991'); //avatarpalace.net:9998
		setGeneralPref('userName','Palace User');
		setGeneralPref('propBagTileSize',91);
		setGeneralPref('viewScaleAll',true);
	}
	document.getElementById('prefusername').value = getGeneralPref('userName');
	document.getElementById('prefhomepalace').value = getGeneralPref('home');
	document.getElementById('prefencoding').value = getGeneralPref('encoding','windows-1252');
})();
