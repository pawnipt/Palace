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

function addPropsToDB(props) {
	var tx = db.transaction("props", "readwrite")
	var store = tx.objectStore("props");

	tx.onerror = function() {
		logmsg('Error adding prop to DB: '+tx.error);
	};
	tx.oncomplete = function() {
		refreshPropBagView();
	};

	props.forEach(function(prop) {
		if (propBagList.indexOf(prop.id) < 0 && (prop.img.length > 0 || (prop.img && prop.img.naturalWidth > 0))) { //does prop exist in the bag already?

			store.add({
				id: prop.id,
				name: prop.name,
				prop: {
					x: prop.x,
					y: prop.y,
					w: prop.w,
					h: prop.h,
					head: prop.head,
					ghost: prop.ghost,
					animated: prop.animated,
					bounce: prop.bounce,
					img: getImageData(prop.img)
				}
			});

			propBagList.unshift(prop.id);
		}
	});

	store.put({id: 'propList', list: propBagList});
}




function saveProp(id,flush) {
	var prop = allProps[id];
	if (prop) addPropsToDB([prop]);
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
			httpPostAsync(
				palace.mediaUrl + 'webservice/props/new/',
				propUploadCallBack,
				function(status,response) {
					logmsg('Prop upload request failed (HTTP ERROR): '+status+'\n\n'+response);
				},
				JSON.stringify(p)
			);
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


function resizeGif(gif) {
	let gifCanvas = document.createElement('canvas');
	gifCanvas.width = gif.raw.lsd.width;
	gifCanvas.height = gif.raw.lsd.height;
	let gifctx = gifCanvas.getContext("2d");

	let tempcanvas = document.createElement('canvas');
	let tempctx = tempcanvas.getContext("2d");

	let props = [],dispose = 0,imgData;

	for(let i = 0; i< gif.raw.frames.length; i++){
		let rawFrame = gif.raw.frames[i];
		if (rawFrame.image) {
			let frame = gif.decompressFrame(i, true);
			let dims = frame.dims;

			//console.log(frame)
			if(!imgData || dims.width != imgData.width || dims.height != imgData.height){
				tempcanvas.width = dims.width;
				tempcanvas.height = dims.height;
				imgData = tempctx.createImageData(dims.width, dims.height);
			}

			if (dispose >= 2) {
				gifctx.clearRect(0, 0, gifCanvas.width, gifCanvas.height);
			}
			dispose = frame.disposalType;

			imgData.data.set(frame.patch);
			tempctx.putImageData(imgData,0,0);

			gifctx.drawImage(tempcanvas, dims.left, dims.top);

			props.unshift(createNewProp(gifCanvas,true));
		}
	}
	
	addPropsToDB(props);
}



function createNewProps(list) {
	for (var i = 0, files = new Array(list.length); i < list.length; i++) {
		files[i] = list[i]; // moving the list to an actual array so pop works , lol
	}

	let importFile = function() {
		if (files.length > 0) {
			let file = files.pop();


			if (file.type == 'image/gif') {
				let reader = new FileReader();
				reader.onload = function(event) {
					resizeGif(new GIF(event.target.result));
					importFile();
				};
				reader.onerror = function(err) {
					console.log(err);

					importFile();
				};
				reader.readAsArrayBuffer(file);
			} else {


				let img = document.createElement('img');
				img.onerror = function() {
					importFile();
				};
				img.onload = function() {
					addPropsToDB([createNewProp(this)]);
					importFile();
				};
				img.src = file.path;
			}
		}
	};
	importFile();
}

function createNewProp(img,animated) {
	let id = createPropID();
	let d = calculateAspectRatio(img.width,img.height,220);
	let c = document.createElement('canvas');

	c.width = d.w.fastRound();
	c.height = d.h.fastRound();
	c = c.getContext('2d');
	c.imageSmoothingEnabled = true;
	c.imageSmoothingQuality = 'high';
	c.drawImage(img,0,0,img.width,img.height,0,0,c.canvas.width,c.canvas.height);

	let prop = {
		id:id,
		name:'Palace Prop',
		w:c.canvas.width,
		h:c.canvas.height,
		x:(-Math.trunc(c.canvas.width/2))+22,
		y:(-Math.trunc(c.canvas.height/2))+22,
		head:true,
		ghost:false,
		animated:Boolean(animated),
		bounce:false,
		img:c.canvas.toDataURL("image/png")
	};

	return prop;
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
	if (localStorage.preferences) { // redo preferences!
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
		a = getGeneralPref('autoplayvideos');
		if (a) document.getElementById('prefautoplayvideos').checked = a;
		setDrawType();
	} else { //default
		prefs.registration = {regi:getRandomInt(100,2147483647),puid:getRandomInt(1,2147483647)};
		setGeneralPref('home','ee.fastpalaces.com:9991'); //avatarpalace.net:9998
		setGeneralPref('userName','Palace User');
		setGeneralPref('propBagTileSize',91);
		setGeneralPref('viewScaleAll',true);
		//setGeneralPref('propBagWidth',200);
	}
	document.getElementById('prefusername').value = getGeneralPref('userName');
	document.getElementById('prefhomepalace').value = getGeneralPref('home');
})();
