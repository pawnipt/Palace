// @flow

var prefs = {general:{},control:{},draw:{type:0,size:2,front:true,color:"rgba(255,0,0,1)",fill:"rgba(255,166,0,0.5)"}},
	propBagList = [];

var db = null;
function initializePropBagDB() {
	var DBOpenRequest = indexedDB.open("propBag",4);

	DBOpenRequest.onerror = function(event) {
		logmsg('Error loading Prop Bag.');
	};

	DBOpenRequest.onsuccess = function(event) {
		// store the result of opening the database in the db variable.
		// This is used a lot below.
		db = DBOpenRequest.result;

		var store = db.transaction("props").objectStore("props");
		var request = store.get('propList');
		request.onsuccess = function() {
			if (request.result) {
				propBagList = request.result.list;
				refreshPropBagView();
			}
		};
	};

	DBOpenRequest.onupgradeneeded = function() {
		db = DBOpenRequest.result;
		var store = db.createObjectStore("props", {keyPath: "id"});
		var authorIndex = store.createIndex("name", "name", { unique: false });
		store.put({id: 'propList', list: propBagList});
	};
}
initializePropBagDB();

function addPropToDB(prop) {
	if (propBagList.indexOf(prop.id) < 0 && (prop.img.length > 0 || (prop.img && prop.img.naturalWidth > 0))) { //does prop exist in the bag already?
		var tx = db.transaction("props", "readwrite")
		var store = tx.objectStore("props");

		store.add({id: prop.id, name: prop.name, prop: {
					x: prop.x,
					y: prop.y,
					w: prop.w,
					h: prop.h,
					head: prop.head,
					ghost: prop.ghost,
					animated: prop.animated,
					bounce: prop.bounce,
					img: getImageData(prop.img)
		}});

		propBagList.unshift(prop.id);
		store.put({id: 'propList', list: propBagList});

		tx.onerror = function() {
			logmsg('Error adding prop to DB: '+tx.error);
		};
		tx.oncomplete = function() {
			//logmsg('Prop added successfully to DB.');
			refreshPropBagView();
		};
	}
}




function saveProp(id,flush) {
	var prop = allProps[id];
	if (prop) addPropToDB(prop);
}

function getBagProp(id,img) {
	var store = db.transaction("props","readonly").objectStore("props");
	var result = store.get(id);
	result.onsuccess = function(event) {
		if (result.result.prop.ghost) img.className = 'bagprop ghost';
		img.src = result.result.prop.img;
	};
}

function cacheBagProp(id,toUpload,callback) {
	var store = db.transaction("props","readonly").objectStore("props");
	var result = store.get(id);
	result.onsuccess = function(event) {
		var aProp = new PalaceProp(id,result.result);
		allProps[id] = aProp;
		if (callback) callback();
		if (toUpload) {
			var p = {props:[
					{format:'png',name:aProp.name,size:{w:aProp.w,h:aProp.h},
					offsets:{x:aProp.x,y:aProp.y},flags:aProp.encodePropFlags,
					id:aProp.id,crc:0}
				]};
			httpPostAsync(palace.mediaUrl + 'webservice/props/new/',propUploadCallBack,JSON.stringify(p));
		}
	};
}

function createPropID() {
	var pid = 0;
	do {
		pid = (Math.random()*2147483647).fastRound();
		if (pid % 2) pid = -pid;
	} while (propBagList.indexOf(pid) > -1);
	return pid;
}

function createNewProps(list) {

	for (var i = 0, files = new Array(list.length); i < list.length; i++)
		files[i] = list[i]; // moving the list to an actual array so pop works , lol

	var imp = function() {
		if (files.length > 0) {
			var file = files.pop();
			var img = document.createElement('img');
			img.onerror = function() {
				imp();
			};
			img.onload = function() {
				var id = createPropID();
				var p = createNewProp(this);
				var prop = {id:id,name:'Palace Prop',w:p.w,h:p.h,x:(-Math.trunc(p.w/2))+22,y:(-Math.trunc(p.h/2))+22,head:true,ghost:false,animated:false,bounce:false,img:p.imgData};
				addPropToDB(prop);
				imp();
			};
			img.src = file.path;
		}
	};
	imp();



}

function createNewProp(img) {
	var d = calculateAspectRatio(img.naturalWidth,img.naturalHeight,220);
	var c = document.createElement('canvas');

	c.width = d.w.fastRound();
	c.height = d.h.fastRound();
	c = c.getContext('2d');
	c.imageSmoothingEnabled = true;
	c.imageSmoothingQuality = 'high';
	c.drawImage(img,0,0,img.naturalWidth,img.naturalHeight,0,0,c.canvas.width,c.canvas.height);
	return {imgData:c.canvas.toDataURL("image/png"),
			w:c.canvas.width,h:c.canvas.height};
}


document.onpaste = function(e){
	var loadImage = function (file) {
		var reader = new FileReader();
		reader.onload = function(e){
			createNewProps([{path:e.target.result}]);
		};
		reader.readAsDataURL(file);
	};
    var items = e.clipboardData.items;
    for (var i = 0; i < items.length; i++) {
        if (/^image\/(p?jpeg|gif|png)$/i.test(items[i].type)) {
            loadImage(items[i].getAsFile());
            return;
        }
    }
}


function setControlPrefs(id,obj) {
	prefs.control[id] = obj;
}

function getControlPrefs(id) {
	return prefs.control[id];
}

function setGeneralPref(id,value) {
	prefs.general[id] = value;
}

function getGeneralPref(id) {
	return prefs.general[id];
}

window.onunload = function(e) {
	localStorage.preferences = JSON.stringify(prefs);
};

(function () { // LOAD PREFERENCES
	var a;
	if (localStorage.preferences) {
		prefs = JSON.parse(localStorage.preferences);
		document.getElementById('drawcolor').style.backgroundColor = prefs.draw.color;
		document.getElementById('drawfill').style.backgroundColor = prefs.draw.fill;
		document.getElementById('drawsize').value = prefs.draw.size;
		a = getGeneralPref('propBagWidth');
		if (a) propBag.style.width = a+'px';
		a = getGeneralPref('chatLogWidth');
		if (a) logField.style.width = a+'px';
		a = getGeneralPref('propBagTileSize');
		if (a) document.getElementById('prefpropbagsize').value = a;
		a = getGeneralPref('viewScales');
		if (a) document.getElementById('prefviewfitscale').checked = a;
		a = getGeneralPref('viewScaleAll');
		if (a) document.getElementById('prefviewscaleall').checked = a;
		a = getGeneralPref('disableSounds');
		if (a) document.getElementById('prefdisablesounds').checked = a;
		setDrawType();
	} else { //default
		prefs.registration = {regi:getRandomInt(100,2147483647),puid:getRandomInt(1,2147483647)};
		setGeneralPref('registration',prefs.registration);
		setGeneralPref('home','ee.fastpalaces.com:9991'); //avatarpalace.net:9998
		setGeneralPref('userName','Palace User');
		setGeneralPref('propBagTileSize',91);
		setGeneralPref('viewScaleAll',true);
		//setGeneralPref('propBagWidth',200);
	}
	document.getElementById('prefusername').value = getGeneralPref('userName');
	document.getElementById('prefhomepalace').value = getGeneralPref('home');
})();
