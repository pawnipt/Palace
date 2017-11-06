var smileys = {},
	overLayer = document.getElementById('container'),
	bgVideo = document.getElementById('bgVideo'),
	backGround = document.getElementById('background'),
	bgEnv = document.getElementById('mainlayer'),
	bgCtx = bgEnv.getContext("2d"),
	systemAudio = {signon:createAudio('SignOn'),
		signoff:createAudio('SignOff'),
		whisper:createAudio('Whispered'),
		doorclose:createAudio('DoorClose'),
		dooropen:createAudio('DoorOpen')},
	mediaUrl = "",
	grabbedProp = null,
	directoryList = null,
	allProps = {},
	nbrProps = 0, //keep record of the number of props loaded into memory because counting allProps object properties is inefficient
	retryProps = [],
	theRoom = {users:[],looseProps:[],serverUserCount:0,lastUserLogOnID:0,lastUserLogOnTime:0};



const electron = require('electron');
const webFrame = electron.webFrame;
//const windowsScaleFactor = electron.screen.getPrimaryDisplay().scaleFactor;



// Require the electron spellchecker
const electronSpellchecker = require('electron-spellchecker');

// Retrieve required properties
const SpellCheckHandler = electronSpellchecker.SpellCheckHandler;
const ContextMenuListener = electronSpellchecker.ContextMenuListener;
const ContextMenuBuilder = electronSpellchecker.ContextMenuBuilder;

// Configure the spellcheckhandler
window.spellCheckHandler = new SpellCheckHandler();
window.spellCheckHandler.attachToInput();

// Start off as "US English, America"
window.spellCheckHandler.switchLanguage('en-US');

// Create the builder with the configured spellhandler
let contextMenuBuilder = new ContextMenuBuilder(window.spellCheckHandler);

// Add context menu listener
let contextMenuListener = new ContextMenuListener((info) => {
	contextMenuBuilder.showPopupMenu(info);
});




(function () { //preload Smiley Set
    var buff = document.createElement('canvas');
	buff.width = 44;
	buff.height = 44;
	buff = buff.getContext('2d');
	var smile = document.createElement('img');
	smile.onload = function() {
		for (var x = 0; x < 13; x++) {
			for (var y = 0; y < 16; y++) {
				buff.clearRect(0,0,44,44);
				buff.drawImage(this,x*45,y*45,44,44,0,0,44,44);
				smileys[x+','+y] = document.createElement('img');
				smileys[x+','+y].src = buff.canvas.toDataURL();
			}
		}
	};
	smile.src = 'img/smileys.png';
})();


setEnviornmentSize(window.innerWidth-logField.offsetWidth,window.innerHeight-overLayer.offsetTop-document.getElementById('chatbox').offsetHeight);

function createAudio(name) {
	var a = document.createElement("audio");
	a.src = 'audio/system/' + name + '.wav';
	return a;
}

function passUrl(s) {
	var url = s.trim().replace(/ /g,'%20');
	return (url.indexOf('http') === 0)? url:mediaUrl+url;
}

function setUserCount() {
	document.getElementById('palaceroom').title = theRoom.users.length + ' / ' + theRoom.serverUserCount;
}

function loadRoom(room) {
	deleteAllBubbles();

	document.getElementById('palaceroom').innerText = room.name;

	theRoom.spots = room.spots;
	theRoom.draws = room.draws;
	theRoom.looseProps = room.looseprops;

	var media = passUrl(room.background);
	var ext = parseURL(media).pathname.split('.').pop();
	if (media != theRoom.lastLoadedBG) {	/* prevent reloading of background media when room is authored */
		//setEnviornment(window.innerWidth-logField.offsetWidth,window.innerHeight-overLayer.offsetTop,'');
		setEnviornment(bgEnv.width,bgEnv.height,'');
		toggleLoadingBG(true);
		if (ext == 'mp4' || ext == 'ogg' || ext == 'webm' || ext == 'm4v') {	/* eventually use http request as well, to determine resource type */
			setBackGroundVideo(media);
		} else {
			setBackGround(media);
		}
	}

	theRoom.pics = [];
	removeAllRoomPics();

	room.pictures.find(function(pict) {
		var newImg = document.createElement('img');
		newImg.onload = function() {
			theRoom.spots.find(function(spot) {
				if (!spot.img) {
					spot.img = createSpotPicPlaceholder();
					overLayer.appendChild(spot.img);
				}
				setSpotImg(spot);
			});
			this.onload = null;
		};
		pict.img = newImg;
		theRoom.pics[pict.id] = pict;
		newImg.src = passUrl(pict.name);
	});


	refresh(true);
}

function createSpotPicPlaceholder() {
	var ph = document.createElement('span');
	ph.className = 'spholder';
	return ph;
}

function removeAllRoomPics() {
	var childs = overLayer.children;
	for (var i = childs.length; --i >= 0;)
		if (childs[i].className.substr(0,7) == 'spotpic' || childs[i].className == 'spholder')
			overLayer.removeChild(childs[i]);
}

function setSpotImg(spot) {
	var statepic = spot.statepics[spot.state];
	if (statepic && theRoom.pics[statepic.id]) {
		var img = theRoom.pics[statepic.id].img;
		if (img.complete && img.naturalWidth > 0) {
			if (spot.img.src !== img.src) {
				img = img.cloneNode(false);
				img.style.left = spot.x+statepic.x-(img.naturalWidth/2).fastRound()+'px';
				img.style.top = spot.y+statepic.y-(img.naturalHeight/2).fastRound()+'px';
				img.className = 'spotpic';
				if (Boolean(spotConsts.PicturesAboveAll & spot.flags || spotConsts.PicturesAboveProps & spot.flags || spotConsts.PicturesAboveNameTags & spot.flags))
					img.className += ' ontop';
				overLayer.replaceChild(img,spot.img);
				spot.img = img;
			} else {
				spot.img.style.left = spot.x+statepic.x-(spot.img.naturalWidth/2).fastRound()+'px';
				spot.img.style.top = spot.y+statepic.y-(spot.img.naturalHeight/2).fastRound()+'px';
			}
		}
	} else if (spot.img && spot.img.className != 'spholder') { /* spot is not displaying a pic so put in placeholder */
		var img = createSpotPicPlaceholder();
		overLayer.replaceChild(img,spot.img);
		spot.img = img;
	}
}

function unloadBgVideo() {
	document.getElementById('muteaudio').style.display = 'none';
	bgVideo.style.display = 'none';
	if (bgVideo && bgVideo.src != '') {
		//bgVideo.pause();
		bgVideo.src = '';
		//bgVideo.load();
		//bgVideo.innerHTML = '';
	}
}

bgVideo.onloadeddata = function () {
	if (this.webkitAudioDecodedByteCount > 0) document.getElementById('muteaudio').style.display = 'block';
};

bgVideo.onloadedmetadata = function () {
	theRoom.lastLoadedBG = this.src; /* to prevent reloading the video when authoring */
	this.width = this.videoWidth;
    this.height = this.videoHeight;
	setEnviornment(this.videoWidth,this.videoHeight,'');
    this.style.display = 'block';

};

function setBackGroundVideo(url) {
	unloadBgVideo();
	bgVideo.src = url;
}

function bgFinished() {
	if (theRoom.currentBG == this.src) {
		if (this.naturalWidth > 0) {
			theRoom.lastLoadedBG = this.src; /* to prevent reloading the image when authoring */
			setEnviornment(this.naturalWidth,this.naturalHeight,"url("+this.src+")");
		} else {
			bgError();
		}
	}
}

function bgError(force) {
	if (force || theRoom.currentBG == this.src)
		setEnviornment(window.innerWidth-logField.offsetWidth,window.innerHeight-overLayer.offsetTop,"url(img/error.png)");
}


function setBackGround(url) {
	theRoom.currentBG = url;
	unloadBgVideo();
	var bg = document.createElement('img');
	bg.onload = bgFinished;
	bg.onerror = bgError;
	bg.src = url;
}


function setEnviornment(w,h,bg) {
	toggleLoadingBG();
	setEnviornmentSize(w,h);
	backGround.style.backgroundImage = bg;
    resetDisplayedBubbles();
    refresh(true);
}

function setEnviornmentSize(w,h) {
/* mitigates flicker on canvas resize */
	var tempCanvas = document.createElement('canvas');
    tempCanvas.width = bgEnv.width;
    tempCanvas.height = bgEnv.height;
    var tempContext = tempCanvas.getContext("2d");
    tempContext.drawImage(bgEnv, 0, 0);

		bgEnv.width = w;
		bgEnv.height = h;

		bgCtx.lineJoin = 'round';
		bgCtx.lineCap = 'round';
		bgCtx.imageSmoothingEnabled = false;
		//bgCtx.imageSmoothingQuality = 'high';
		
		scale2Fit();

    bgCtx.drawImage(tempContext.canvas, 0, 0);

		backGround.style.width = w+'px';
    backGround.style.height = h+'px';
		overLayer.style.width = w+'px';
    overLayer.style.height = h+'px';

  											 // 45 is toolbar height
    document.body.style.height = bgEnv.height + 45 + document.getElementById('chatbox').offsetHeight + 'px';
    setBodyWidth();

}



function serverDown(msg) {

	mediaUrl = "";
	allProps = {}; /* might need to delete image events */
	theRoom.lastUserLogOnTime = 0;
	theRoom.lastUserLogOnID = 0;
	theRoom.serverUserCount = 0;
	theRoom.spots = [];
	theRoom.draws = [];
	theRoom.looseProps = [];
	theRoom.pics = [];
	theRoom.lastLoadedBG = '';
	removeAllRoomPics();
	stopAllUserAnimations();
	deleteAllBubbles();
	theRoom.users = [];
	theUser = null;
	theUserID = null;
	roomList = null;
	userList = null;
	unloadBgVideo();
	if (msg) {
		bgError(true);
		logmsg(msg.msg);
	}
	refresh(true);
}
function serverInfo(flags,name) {
	theRoom.servername = name;
	theRoom.serverflags = flags;
	var addressBar = document.getElementById('palaceserver');
	addressBar.title = name;
	if (addressBar != document.activeElement) addressBar.innerText = theRoom.servername;
}

function fullyLoggedOn() {
	document.getElementById('users').disabled = false;
	document.getElementById('rooms').disabled = false;
}

function toggleLoadingBG(on) {
	if (on) {
		backGround.style.width = '200px';
		backGround.style.height = '200px';
		backGround.className = 'spinloading';
	} else {
		backGround.className = '';
	}
}

function connecting(address) {
	serverDown();
	setEnviornment(window.innerWidth-logField.offsetWidth,window.innerHeight-overLayer.offsetTop-document.getElementById('chatbox').offsetHeight,'');
	toggleLoadingBG(true);
	theRoom.address = address;
	document.getElementById('users').disabled = true;
	document.getElementById('rooms').disabled = true;
}

function loosePropAdd(data) {
	theRoom.looseProps.unshift(data);
	/* corrects index of currently dragged loose prop to prevent moving the wrong one */
	if (grabbedProp != null && grabbedProp.index > -1) grabbedProp.index++;
	loadProps([data.id]);
	reDraw();
}

function loosePropMove(x,y,index) {
	if (index >= 0 && theRoom.looseProps.length > index) {
		var lp = theRoom.looseProps[index];
		if (lp && (lp.x != x || lp.y != y)) {
			lp.x = x;
			lp.y = y;
			reDraw();
		}
		/* mouseMove(event); */
	}
}

function loosePropDelete(index) {
	var change = false;
	if (index < 0) {
		if (theRoom.looseProps.length > 0) change = true;
		theRoom.looseProps = [];
	} else if (theRoom.looseProps.length >= index) {
		if (grabbedProp != null && grabbedProp.index > -1) {
			if (index == grabbedProp.index) {
				grabbedProp = null;
			} else if (index < grabbedProp.index) {
				grabbedProp.index--;
			}
		}
		change = true
		theRoom.looseProps.splice(index,1);
	}
	if (change) reDraw();
}

function addSelfProp(pid) {
	if (theUser && theUser.props.length < 9 && theUser.props.indexOf(pid) == -1) {
		theUser.propsChanged = true;
		theUser.props.push(pid);
		theUser.animator();
		reDraw();
		return true;
	}
}

function removeSelfProp(pid) {
	if (theUser) {
		var i = theUser.props.indexOf(pid);
		if (theUser.props.length > 0 && i > -1) {
			theUser.propsChanged = true;
			theUser.props.splice(i,1);
			theUser.animator();
			reDraw();
			return true;
		}
	}
}

whisperUserID = null;
function enterWhisperMode(userid,name) {
	var cancel = (whisperUserID == userid);
	if (whisperUserID != null || cancel) exitWhisperMode(); /* whisper toggle */
	if (!cancel) {
		document.getElementById('chatbox').placeholder = 'Whisper to ' + name;
		whisperUserID = userid;
		var user = getUser(userid);
		if (user) {
			user.light = 1;
			user.poke();
		}
		refresh(true);
	}
}

function exitWhisperMode() {
	document.getElementById('chatbox').placeholder = 'Chat...';
	var user = getUser(whisperUserID);
	if (user && mouseHoverUser != user) user.light = 0;
	if (user) user.poke();
	whisperUserID = null;
	refresh(true);
}

/* increment or decrement index when loose prop is added or deleted */
function drawingEnd() {
	var draw = {
		type:(prefs.draw.type == 1),
		front:prefs.draw.front,
		color:prefs.draw.color.getNbrs(),
		fill:prefs.draw.fill.getNbrs(),
		size:prefs.draw.size,
		points:drawPoints
	};

	sendDraw(draw);
	window.removeEventListener('mousemove',drawing);
	window.removeEventListener('mouseup',drawingEnd);

	drawPoints = [];
}
function drawing(event) {
	var offset = 0;
	if (prefs.draw.type == 0) offset = Math.floor(prefs.draw.size/2);
	var x = ((event.x+document.body.scrollLeft-overLayer.offsetLeft)/viewScale).fastRound()-offset;
	var y = ((event.y+document.body.scrollTop-overLayer.offsetTop)/viewScale).fastRound()-offset; //45 get new toolbar height if zooming
	if (event.shiftKey && drawPoints.length > 3) {
		drawPoints[drawPoints.length-1] = y;
		drawPoints[drawPoints.length-2] = x;
	} else {
		drawPoints.push(x);
		drawPoints.push(y);
	}

	reDraw();
}

function doubleClick(event) {

}

function drawErase() {
	sendDrawClear(4);
}

function drawEraseDblClick() {
	sendDrawClear(3);
}

function dragSlide() {
	var x = ((event.x-overLayer.offsetLeft)/viewScale).fastRound();
	var y = ((event.y-overLayer.offsetTop)/viewScale).fastRound();
	setpos(x,y);
}
function dragSlideEnd() {
	window.removeEventListener('mousemove',drawing);
	window.removeEventListener('mouseup',drawingEnd);
}

var drawPoints = [];
function mouseDown(event) {
	document.getElementById('chatbox').blur();
	event.preventDefault();
	var isDrawing = document.getElementById('drawcheckbox').checked;
	var x = (event.layerX/viewScale).fastRound();
	var y = ((event.layerY + ((45*webFrame.getZoomFactor()) - 45)) /viewScale).fastRound(); // get excess toolbar height if windows is scaling
	if (isDrawing) {
		var offset = 0;
		if (prefs.draw.type == 0) offset = Math.floor(prefs.draw.size/2);
		drawPoints = [x-offset,y-offset];
		window.addEventListener('mousemove',drawing);
		window.addEventListener('mouseup',drawingEnd);
	} else {
		var lpIndex = null;
		var pid = null;

		var mUser = mouseOverUser(x,y);
		if (!event.shiftKey && mUser != theUser && mUser != null) {
			enterWhisperMode(mUser.id,mUser.name);
		} else {
			if (event.shiftKey) pid = mouseOverSelfProp(x,y);
			if (pid == null) lpIndex = mouseOverLooseProp(x,y);

			if (pid != null) {
				var aProp = allProps[pid];
				makeDragProp(-1, pid, x, y, x-aProp.x-theUser.x+22, y-aProp.y-theUser.y+22);
			} else if (lpIndex != null) {
				var lProp = theRoom.looseProps[lpIndex];
				makeDragProp(lpIndex, lProp.id, x, y, x-lProp.x, y-lProp.y);
			} else if (mUser == null || mUser == theUser) { /* if not clicking another user */

				var areaInfo = clickSpotInfo(x,y);

				if (areaInfo.dontMove !== true) {
					setpos(x,y);
/*
					if (event.button == 2) {
						window.addEventListener('mousemove',dragSlide);
						window.addEventListener('mouseup',dragSlideEnd);
						return true;
					}
 */
				}

				if (areaInfo.spot != null) {
					var dest = areaInfo.spot.dest;
					switch(areaInfo.spot.type) {
						case spotConsts.types.passage:
							if (dest > 0) gotoroom(dest);
							break;
						case spotConsts.types.shutable:
						case spotConsts.types.lockable:
							if (areaInfo.spot.state == 0) {
								gotoroom(dest);
							} else {
								logspecial('logmsgdoorlocked');
							}
							break;
						case spotConsts.types.deadBolt:
							var d = getSpot(dest);
							if (d != null)
								window.status = (d.state == 0?'lockdoor ':'unlockdoor ')+dest;
							break;
					}
				}
			}
		}
	}
}


function makeDragProp(i,pid,x,y,x2,y2) {
	grabbedProp = {index:i,id:pid,offsetX:x2,offsetY:y2,mx:x-x2,my:y-y2};
}

function clickSpotInfo(x,y) {
	var ai = {};
	var spot;
	if (theRoom.spots) {
		for (var i = theRoom.spots.length; --i >= 0;) {
			spot = theRoom.spots[i];
			makeHotSpot(spot);
			if (bgCtx.isPointInPath(x,y)) {
				if (ai.spot == null) ai.spot = spot;
				if (spotConsts.DontMoveHere & spot.flags) ai.dontMove = true;
			}
		}
	}
	return ai;
}

function mouseInSpot(x,y) {
	var spot;
	for (var i = theRoom.spots.length; --i >= 0;) {
		spot = theRoom.spots[i];
		makeHotSpot(spot);
		if (bgCtx.isPointInPath(x,y)) return spot;
	}
}

function mouseExit(event) {
	var x = (event.layerX/viewScale).fastRound();
	var y = (event.layerY/viewScale).fastRound();
	mouseExitSelfProp();
	mouseExitLooseProp();
	mouseExitUser();
}

function mouseUp(event) {
	if (grabbedProp != null) {
		var x = (event.layerX/viewScale).fastRound();
		var y = ((event.layerY+(45*webFrame.getZoomFactor() - 45))/viewScale).fastRound();
		var overSelf = (theUser && theUser.x-22 < x && theUser.x+22 > x && theUser.y-22 < y && theUser.y+22 > y);
		if (grabbedProp.index == -1) {
			if (!overSelf) {
				sendPropDrop(x-grabbedProp.offsetX,y-grabbedProp.offsetY,grabbedProp.id);
			} else {
				addSelfProp(grabbedProp.id);
			}
		} else {
			if (!event.altKey) {
				if (overSelf) {
					sendPropDelete(grabbedProp.index);
				} else {
					sendPropMove(x-grabbedProp.offsetX,y-grabbedProp.offsetY,grabbedProp.index);
				}
			} else {
				if (!overSelf) sendPropDrop(x-grabbedProp.offsetX,y-grabbedProp.offsetY,grabbedProp.id);
			}
		}
		reDraw();
	}
	grabbedProp = null;
	if (theUser && theUser.propsChanged == true) sendUserPropChange();
}

function sendUserPropChange() {
	if (theUser) sendPropDress();//window.status = "setselfprops "+theUser.props.join();
	theUser.propsChanged = false;
	enablePropButtons();
}



function mouseMove(event) {
	var isDrawing = document.getElementById('drawcheckbox').checked;

	if (isDrawing) {
		switch(prefs.draw.type) {
			case 1: bgEnv.style.cursor = 'url(img/bucket.cur) 16 13,crosshair'; break;
			default: bgEnv.style.cursor = 'url(img/pen.cur) 1 14,crosshair';
		}
		bgEnv.dataset.cursorName = '';
		return true;
	}
	if (theUser == null) return false;

	var x = (event.layerX/viewScale).fastRound();
	var y = ((event.layerY+(45*webFrame.getZoomFactor() - 45))/viewScale).fastRound();

	if (grabbedProp == null) {

		if (!event.shiftKey) { /* shift toggles between user and props */
			var mUser = mouseOverUser(x,y);
			if (mouseHoverUser != mUser) {
				if (mUser != null) {
					mouseEnterUser(mUser);
				} else {
					mouseExitUser();
				}
			}
		} else {
			mouseExitUser();
		}

		if (event.shiftKey) { /* for efficiency sake, check shiftkey before bothering to scan */
			var pid = mouseOverSelfProp(x,y);
			if (mouseSelfProp != pid) {
				if (pid != null) {
					mouseEnterSelfProp(pid);
				} else {
					mouseExitSelfProp();
				}
			}
		} else {
			mouseExitSelfProp();
		}

		var lpIndex = mouseOverLooseProp(x,y);
		if (lpIndex != mouseLooseProp) {
			if (lpIndex != null) {
				mouseEnterLooseProp(lpIndex);
			} else {
				mouseExitLooseProp();
			}
		}
	} else {
		mouseExitLooseProp();
		mouseExitSelfProp();

		if (theUser.x-22 < x && theUser.x+22 > x && theUser.y-22 < y && theUser.y+22 > y) {
			addSelfProp(grabbedProp.id);
			grabbedProp.mx = -999; /* temp vanishing */
			grabbedProp.my = -999;
		} else {
			if (event.altKey == false && (theUser.propsChanged == true || grabbedProp.index < 0))
				removeSelfProp(grabbedProp.id);

			grabbedProp.mx = (x-grabbedProp.offsetX);
			grabbedProp.my = (y-grabbedProp.offsetY);
		}
		reDraw();
	}

	if (grabbedProp != null && event.altKey) {
		setEnvCursor('copy');
	} else if (mouseLooseProp != null || mouseSelfProp != null || grabbedProp != null) {
		setEnvCursor('move');
	} else if (mouseHoverUser == theUser && event.ctrlKey) {
		setEnvCursor('context-menu');
	} else {
		var spot = mouseInSpot(x,y);
		if ((mouseHoverUser != null && mouseHoverUser != theUser) || (spot && spot.type > 0)) {
			setEnvCursor('pointer');
		} else {
			setEnvCursor('default');
		}
	}
}

function setEnvCursor(name) {
	if (bgEnv.dataset.cursorName != name) {
		bgEnv.style.cursor = name;
		bgEnv.dataset.cursorName = name;
	}

}

function mouseOverUser(x,y) {
	for (var i = theRoom.users.length; --i >= 0;) {
		var user = theRoom.users[i];
		if (user.x+22 > x && user.x-22 < x && user.y+22 > y && user.y-22 < y)
			return user;
	}
}

function mouseOverSelfProp(x,y) {
	if (grabbedProp == null) {
		for (var a = theUser.props.length; --a >= 0;) {
			var aProp = allProps[theUser.props[a]];
			var px = (theUser.x + aProp.x)-22;
			var py = (theUser.y + aProp.y)-22;
			if (aProp && (!aProp.animated || theUser.animatePropID === undefined || theUser.animatePropID == aProp.id) && aProp.complete() && px < x && (px+aProp.w) > x && py < y && (py+aProp.h) > y) {
				if (mouseOverProp(aProp,x,y,px,py)) return aProp.id; /* should pass object instead of id */
			}
		}
	}
}

function mouseOverLooseProp(x,y) {
	if (grabbedProp == null && theRoom.looseProps) {
		for (var i = theRoom.looseProps.length; --i >= 0;) {
			var lProp = theRoom.looseProps[i];
			var aProp = allProps[lProp.id];
			if (aProp && lProp && aProp.complete() && lProp.x < x && (lProp.x+aProp.w) > x && lProp.y < y && (lProp.y+aProp.h) > y) {
				if (mouseOverProp(aProp,x,y,lProp.x,lProp.y)) return i; /* should pass object instead of index */
			}
		}
	}
}

/* offscreen buffer for pixel detection */
var mCanvas = document.createElement('canvas'); // maybe store props as canvas instead...
mCanvas.width = 220;
mCanvas.height = 220;
mCtx = mCanvas.getContext('2d');
function mouseOverProp(aProp,x,y,px,py) {
	mCtx.clearRect(0,0,mCanvas.width,mCanvas.height);
	mCtx.drawImage(aProp.img,0,0,aProp.w,aProp.h);
	return (mCtx.getImageData((x-px),(y-py),1,1).data[3] > 0);
}

mouseHoverUser = null;
function mouseEnterUser(user) {
	mouseExitSelfProp();
	mouseExitLooseProp();
	mouseExitUser();
	if (user != theUser) user.light = 1;
	mouseHoverUser = user;
	reDraw();
}
function mouseExitUser() {
	if (mouseHoverUser) {
		var target = mouseHoverUser;
		if (whisperUserID != mouseHoverUser.id && target != theUser) {
			target.light = 1;
			var fadeTimer = setInterval(function() {
				var user = getUser(target.id);
				if (target.light - 0.1 <= 0 || user == mouseHoverUser || !user) {
					if (!mouseHoverUser || user != mouseHoverUser) target.light = 0;
					clearInterval(fadeTimer);
				} else {
					target.light -= 0.09;
					reDraw();
				}

			},20);
		}
		mouseHoverUser = null;
		reDraw();
	}
}

mouseLooseProp = null;
function mouseEnterLooseProp(lpIndex) {
	if (mouseHoverUser == null && mouseSelfProp == null) {
		mouseExitLooseProp();
		mouseLooseProp = lpIndex;
		theRoom.looseProps[mouseLooseProp].light = 1;
		reDraw();
	}
}
function mouseExitLooseProp() {
	if (mouseLooseProp != null) {
		var target = theRoom.looseProps[mouseLooseProp];
		if (target) {
			target.light = 1;
			var fadeTimer = setInterval(function() {
				var idx = theRoom.looseProps.indexOf(target);
				if (target.light - 0.1 <= 0 || target == theRoom.looseProps[mouseLooseProp] || idx < 0) {
					if (target != theRoom.looseProps[mouseLooseProp]) target.light = 0;
					clearInterval(fadeTimer);
				} else {
					target.light -= 0.09;
					reDraw();
				}

			},20);
		}
		mouseLooseProp = null;
		reDraw();
	}
}

mouseSelfProp = null;
function mouseEnterSelfProp(pid) {
	mouseExitLooseProp();
	if (mouseHoverUser == null) {
		mouseExitSelfProp();
		mouseSelfProp = pid;
		reDraw();
	}
}
function mouseExitSelfProp() {
	if (mouseSelfProp != null) {
		mouseSelfProp = null;
		reDraw();
	}
}

function getSpot(spotid) {
	return theRoom.spots.find(function(spot){return spotid == spot.id;});
}

function spotStateChange(roomId,spotId,state,lock) {
	var spot = getSpot(spotId);
	if (theRoom.id == roomId && spot) {
		spot.state = state;
		setSpotImg(spot);
		if (lock == 1) {
			if (!prefs.general.disableSounds) systemAudio.dooropen.play();
		} else if (spotInfo.lock == -1) {
			if (!prefs.general.disableSounds) systemAudio.doorclose.play();
		}
	}
}

function spotMove(roomId,spotId,x,y) {
	var spot = getSpot(spotId);
	if (theRoom.id == roomId && spot) {
		spot.x = x;
		spot.y = y;
		setSpotImg(spot);
		reDraw();
	}
}

function spotMovePic(roomId,spotId,x,y) {
	var spot = getSpot(spotId);
	if (theRoom.id == roomId && spot && spot.statepics[spot.state]) {
		spot.statepics[spot.state].x = x;
		spot.statepics[spot.state].y = y;
		setSpotImg(spot);
		//reDraw();
	}
}

function nbrRoomProps() {
	var count = 0;
	for (var i = 0; i < theRoom.users.length; i++)
		count += theRoom.users[i].props.length;
	count += theRoom.looseProps.length;
	return count;
}

function propInUse(id) {
	for (var i = 0; i < theRoom.users.length; i++)
		for (var j = 0; j < theRoom.users[i].props.length; j++)
			if (theRoom.users[i].props[j] == id) return true;
	for (var o = 0; o < theRoom.looseProps.length; o++)
			if (theRoom.looseProps[o].id == id) return true;
	return false;
}

function PalaceProp(id,info) {
	this.id = id;
	if (info) {
		this.setInfo(info);
	} else {
		this.rcounter = 0;
	}
	nbrProps++;
	if (nbrProps > nbrRoomProps()+66) {
		for (var k in allProps) {
			if (!propInUse(parseInt(k))) {
				delete allProps[k];
				nbrProps--;
			}
		}
	}
}
PalaceProp.prototype.complete = function() {
	return (this.img && this.img.complete && this.img.naturalWidth > 0);
};
PalaceProp.prototype.requestPropImage = function(url) {
	var p = this;
	this.img = document.createElement('img');
	this.img.onload = function(){
		for (var i = 0; i < theRoom.users.length; i++) {
			var user = theRoom.users[i];
			if (user.props.indexOf(p.id) > -1 && (p.animated || p.head)) user.animator();
		}
		reDraw();
		p = null;
		this.onload = null;
	};
	this.img.src = url;
};
PalaceProp.prototype.setInfo = function(info) {
	this.name = info.name;
	if (info.offsets) { // from server
		this.x = Number(info.offsets.x);
		this.y = Number(info.offsets.y);
		this.w = Number(info.size.w);
		this.h = Number(info.size.h);
		this.decodePropFlags(info.flags);
	} else { // from local
		this.x = info.prop.x;
		this.y = info.prop.y;
		this.w = info.prop.w;
		this.h = info.prop.h;
		this.head = info.prop.head;
		this.ghost = info.prop.ghost;
		this.animated = info.prop.animated;
		this.bounce = info.prop.bounce;
		this.requestPropImage(info.prop.img);
	}
};
PalaceProp.prototype.decodePropFlags = function(flags) {
	var i = parseInt(flags,16).swap16();
	this.head = Boolean(i & propConsts.head);
	this.ghost = Boolean(i & propConsts.ghost);
	this.animated = Boolean(i & propConsts.animated);
	this.bounce = Boolean(i & propConsts.bounce);
};
PalaceProp.prototype.encodePropFlags = function() {
	var flag = propConsts.png;
	if (this.head) flag ^= propConsts.head;
	if (this.ghost) flag ^= propConsts.ghost;
	if (this.animated) flag ^= propConsts.animated;
	if (this.bounce) flag ^= propConsts.bounce;
	return flag.swap16().toHex();
};

function propUploadCallBack(response) {
	if (response.length > 0) {
		var propsInfo = JSON.parse(response);
		for (var i = 0; i < propsInfo.props.length; i++) {
			var prop = propsInfo.props[i];
			if (prop.restricted !== true) { // send logmsg about restriction and remove prop from user
				uploadProp(propsInfo.upload_url,prop.id);
			}
		}
	}
}

function uploadProp(url,pid) {
	var aProp = allProps[pid];
	if (aProp.img && aProp.img.naturalWidth > 0) {
		var formData = new FormData();
		formData.append('id', String(pid));
		var d = atob(getImageData(aProp.img).replace(/^data:image\/png;base64,/, ""));
		var l = d.length;
		var array = new Uint8Array(l);
        for (var i = 0; i < l; i++) array[i] = d.charCodeAt(i);
		var blob = new Blob([array], { type: 'application/octet-stream'});
		formData.append('prop', blob);
		httpPostAsync(url,propImageUploadCallBack,formData);
	} else {
		localmsg('Prop '+pid+' failed to upload: image data not available');
	}
}


function propImageUploadCallBack(response) { // add error handling!
	/* logmsg('response: '+response); */
}

function downloadPropInfoCallBack(response) { // need to handle possible http error and retry props (store array of requested)
	var propsInfo = JSON.parse(response);

	for (var i = 0; i < propsInfo.props.length; i++) {
		var prop = propsInfo.props[i];
		var aProp = allProps[prop.id];
		if (aProp) {
			if (prop.success === false) {
				retryProps.push(prop.id);
				aProp.rcounter++;
			} else {
				delete aProp.rcounter;
				aProp.setInfo(prop);
				aProp.requestPropImage(propsInfo.img_url + aProp.id);
			}
		}
	}

	if (retryProps.length > 0) {
		setTimeout(function() {
			loadProps(retryProps.dedup());
			retryProps = [];
		}, 3200);
	}
}

function clearFailedProps() {
	// loop allProps and clear props that haven't loaded; when the user logs onto a new server

}

function loadProps(pids,fromSelf,callback) {
	if (pids && pids.length > 0) {
		var toLoad = {props:[]};
		for (var i = 0; i < pids.length; i++) {
			var pid = Number(pids[i]);
			var aProp = allProps[pid];
			if (!aProp) {
				if (propBagList.indexOf(pid) > -1) { // already have it in prop bag?
					cacheBagProp(pid,fromSelf,callback); // potentially upload..
				} else {
					allProps[pid] = new PalaceProp(pid);
					toLoad.props.push({id:pid});
				}
			} else if (aProp.rcounter !== undefined && aProp.rcounter > 0 && aProp.rcounter < 9) {
				toLoad.props.push({id:pid});
			} else {
				if (callback) callback();
			}
		}
		if (toLoad.props.length > 0)
			httpPostAsync(mediaUrl + 'webservice/props/get/',downloadPropInfoCallBack,JSON.stringify(toLoad));
	}
}

function log(data) {
	logmsg(data.msg);
}

function logerror(msg) {
	var lmsg = document.createElement('div');
 	lmsg.className = 'logmsg';
 	lmsg.innerHTML = msg;
	logAppend(lmsg);
}

function logmsg(msg) {
 	var lmsg = document.createElement('div');
 	lmsg.className = 'logmsg';
 	lmsg.appendChild(document.createTextNode(msg));
 	/* logspan.innerText = msg.makeHyperLinks(); */
	logAppend(lmsg);
}

function logAppend(logspan) {
	var scrollLock = Math.abs((logField.scrollHeight - logField.clientHeight) - logField.scrollTop.fastRound()) < 2; // might need to make this 3...
	if (logField.children.length > 400)
		while (logField.children.length > 300) // limit log for performance reasons
			logField.removeChild(logField.firstChild);
	logField.appendChild(logspan);
	if (scrollLock) logField.scrollTop = logField.scrollHeight - logField.clientHeight;
}

function logspecial(name) {
	var logspan = document.createElement('div');
 	logspan.className = 'logmsg special '+name;
	logAppend(logspan);
}

function drawBubble(bub) {

	if (bgCtx.shadowBlur != 2) {
		bgCtx.shadowColor = 'RGBA(0,0,0,.6)';
		bgCtx.shadowOffsetY = 1;
		bgCtx.shadowBlur = 3;
	}

	if (bub.user) {
		var grd;
		if (bub.right) {
			grd = bgCtx.createLinearGradient(bub.x, 0, bub.x+bub.textWidth, 0);
		} else {
			grd = bgCtx.createLinearGradient(bub.x+bub.textWidth, 0,bub.x, 0);
		}

		grd.addColorStop(0, getHsl(bub.color,73));
		grd.addColorStop(0.5, getHsl(bub.color,79));
		grd.addColorStop(1, getHsl(bub.color,73));


		bgCtx.fillStyle = grd;
	} else {
		bgCtx.fillStyle = 'white';
	}

	if (bub.shout) {
		bub.makeShoutBubble(bgCtx);
	/* } else if (bub.thought) { */

	} else {
		bub.makeRegularBubble(bgCtx, bubbleConsts.radius);
	}
	bgCtx.globalAlpha = bub.size-0.1;
	bgCtx.fill();

}

function drawSpot(spot,above) {
	if (above == Boolean(spotConsts.PicturesAboveAll & spot.flags || spotConsts.PicturesAboveProps & spot.flags || spotConsts.PicturesAboveNameTags & spot.flags)) {
		if ((spotConsts.ShowFrame & spot.flags) || (spotConsts.Shadow & spot.flags)) {
			makeHotSpot(spot); /* the spots polygon frame */

			if (spotConsts.Shadow & spot.flags) {
				bgCtx.fillStyle = 'black';
				bgCtx.fill();
			}
			if (spotConsts.ShowFrame & spot.flags) {
				bgCtx.strokeStyle = 'black';
				bgCtx.lineWidth = 1;
				bgCtx.stroke();
			}
		}
	}
}

function drawSpotName(spot,above) {
	if ((spotConsts.ShowName & spot.flags) && spot.name.length > 0) {
		if (above == Boolean(spotConsts.PicturesAboveAll & spot.flags || spotConsts.PicturesAboveProps & spot.flags || spotConsts.PicturesAboveNameTags & spot.flags)) {
			var size = 12;
			bgCtx.fillStyle = 'white';
			bgCtx.font = size+'px sans-serif';
			bgCtx.textBaseline = 'top';
			bgCtx.textAlign = 'center';
			var w = bgCtx.measureText(spot.name).width+4;
			roundRect(bgCtx, spot.x-(w/2)-2, spot.y-1, w+4, size+4, 4, true, false);
			bgCtx.fillStyle = 'black';
			//bgCtx.shadowColor = 'transparent';
			bgCtx.fillText(spot.name, spot.x, spot.y);
		}
	}
}

function makeHotSpot(spot) {
	bgCtx.beginPath();
	bgCtx.moveTo(spot.x + spot.points[0], spot.y + spot.points[1]);
	var len = spot.points.length-1;
	for (var i=2; i < len; i+=2) {
	 	bgCtx.lineTo(spot.x + spot.points[i], spot.y + spot.points[i+1]);
	 }
	bgCtx.closePath();
}

function drawLooseProp(lProp) {
	var aProp = allProps[lProp.id]; //perhaps store prop object on the looseProp array for convenience/speed
	if (aProp && aProp.complete()) {
		var gAlpha = 1;
		if (aProp.ghost) gAlpha = gAlpha/2;

		if (grabbedProp && theRoom.looseProps[grabbedProp.index] == lProp) {
			bgCtx.globalAlpha = gAlpha/2;
			bgCtx.drawImage(aProp.img,grabbedProp.mx,grabbedProp.my);
		}
		if (lProp.light > 0) {
			bgCtx.shadowColor = 'rgba(124,252,0,'+lProp.light+')';
			bgCtx.shadowBlur = 4;
		}
		bgCtx.globalAlpha = gAlpha;
		bgCtx.drawImage(aProp.img,lProp.x,lProp.y);
		if (bgCtx.shadowBlur > 0) {
			bgCtx.shadowColor = 'transparent';
			bgCtx.shadowBlur = 0;
		}
		if (bgCtx.globalAlpha < 1) bgCtx.globalAlpha = 1;
	}
}

function drawName(user) {
	var loc = user.nametagLoc();
	if (loc) {
		var overUser = (mouseHoverUser != theUser && mouseHoverUser == user);

		if (overUser && whisperUserID == user.id) {
			bgCtx.shadowColor = 'IndianRed';
			bgCtx.shadowBlur = 6;
		} else if (((overUser && whisperUserID != user.id) || whisperUserID == user.id) || user.light > 0) {
			bgCtx.shadowColor = 'rgba(152,251,152,'+user.light+')';
			bgCtx.shadowBlur = 6;
		}


		if (whisperUserID != null && whisperUserID != user.id && user != theUser) bgCtx.globalAlpha = 0.5;

		if (user.scale != 1) {
			var size = 1/user.scale;
			bgCtx.scale(size,size);
			loc = user.nametagLoc(true);
		}


		bgCtx.drawImage(user.nametag, loc.x, loc.y);
		if (bgCtx.shadowBlur > 0) {
			bgCtx.shadowColor = 'transparent';
			bgCtx.shadowBlur = 0;
		}
		if (bgCtx.globalAlpha < 1) bgCtx.globalAlpha = 1;
		if (user.scale != 1) bgCtx.setTransform(1, 0, 0, 1, 0, 0);
	}
}

function drawAvatar(user) {
	var overUser = (mouseHoverUser != theUser && mouseHoverUser == user);

	if (overUser && whisperUserID == user.id) {
		bgCtx.shadowColor = 'IndianRed';
		bgCtx.shadowBlur = 6;
	} else if (((overUser && whisperUserID != user.id) || whisperUserID == user.id) || user.light > 0) {
		bgCtx.shadowColor = 'rgba(152,251,152,'+user.light+')';
		bgCtx.shadowBlur = 6;
	}

	if (user.scale != 1) {
		var size = 1/user.scale;
		bgCtx.scale(size,size);
	}

	if ((whisperUserID != null && whisperUserID != user.id && user != theUser)) bgCtx.globalAlpha = 0.5;
	if (user.showHead !== false) drawSmiley(user);


	for (var i = 0; i < user.props.length; i++) {
		var aProp = allProps[user.props[i]];
		if (aProp && (!aProp.animated || user.animatePropID === undefined || user.animatePropID == aProp.id)) drawUserProp(user,aProp);
	}
	if (bgCtx.shadowBlur > 0) {
		bgCtx.shadowColor = 'transparent';
		bgCtx.shadowBlur = 0;
	}
	if (bgCtx.globalAlpha < 1) bgCtx.globalAlpha = 1;
	if (user.scale != 1) bgCtx.setTransform(1, 0, 0, 1, 0, 0);
}

function drawSmiley(user) {
	bgCtx.drawImage(smileys[user.face+','+user.color],user.x*user.scale-21,user.y*user.scale-21);
}

function drawUserProp(user,aProp) {
	if (aProp.complete()) {
		var iAlpha = bgCtx.globalAlpha;
		if (aProp.ghost) bgCtx.globalAlpha = iAlpha/2;
		var draggingSelfProp = (aProp.id == mouseSelfProp && user == theUser);
		if (draggingSelfProp) {
			bgCtx.shadowColor = 'LawnGreen';
			bgCtx.shadowBlur = 4;
		}
		bgCtx.drawImage(aProp.img,user.x*user.scale-22+aProp.x,user.y*user.scale-22+aProp.y,aProp.w,aProp.h);
		if (aProp.ghost) bgCtx.globalAlpha = iAlpha; //minimizing changes to machine state
		if (draggingSelfProp) {
			bgCtx.shadowColor = 'transparent';
			bgCtx.shadowBlur = 0;
		}
	}
}



function drawLimboProp() { /* when dragging a prop from self or another location */
	if (grabbedProp && grabbedProp.index == -1) {
		var aProp = allProps[grabbedProp.id];
		if (aProp && aProp.complete()) {
			if (aProp.ghost) bgCtx.globalAlpha = 0.5;
			bgCtx.globalAlpha = bgCtx.globalAlpha/2;
			bgCtx.drawImage(aProp.img,grabbedProp.mx,grabbedProp.my);
			bgCtx.globalAlpha = 1;
		}
	}
}

function roomDraw(draw) {



	if (roomDrawConsts.clean & draw.type) {
		theRoom.draws = [];
	} else if (roomDrawConsts.undo & draw.type) {
		theRoom.draws.pop();
	} else {
		theRoom.draws.push(draw);
	}

	reDraw();


}

function drawDraws(draw,foreground) {
	if (Boolean(roomDrawConsts.front & draw.type) == foreground) {
		bgCtx.lineWidth = draw.pensize;
		bgCtx.fillStyle = draw.fillcolor;
		bgCtx.strokeStyle = draw.pencolor;

		if (!Boolean(draw.type & roomDrawConsts.text) && !Boolean(draw.type & roomDrawConsts.oval)) {
			bgCtx.beginPath();
			bgCtx.moveTo(draw.points[0], draw.points[1]);

			for (var item = 2; item < draw.points.length-1; item += 2)
				bgCtx.lineTo(draw.points[item], draw.points[item+1]);

			if (roomDrawConsts.shape & draw.type) {
				bgCtx.closePath();
				bgCtx.fill();
			}
			bgCtx.stroke();

		}
	}
}

function preDrawDrawing() {
	var l = drawPoints.length;
	if (l > 0) {
		//{type:0,size:2,front:true,color:"rgba(255,0,0,1)",fill:"rgba(255,166,0,0.5)"}
		bgCtx.lineWidth = prefs.draw.size;
		bgCtx.fillStyle = prefs.draw.fill;
		bgCtx.strokeStyle = prefs.draw.color;

		bgCtx.beginPath();

		var offset = 0;
		if (prefs.draw.type == 0) offset = Math.floor(prefs.draw.size/2);

		bgCtx.moveTo(drawPoints[0]+offset, drawPoints[1]+offset);

		for (var item = 2; item < l-1; item += 2)
			bgCtx.lineTo(drawPoints[item]+offset, drawPoints[item+1]+offset);

		if (prefs.draw.type == 1) {
			bgCtx.closePath();
			bgCtx.fill();
		}
		bgCtx.stroke();
	}
}



function refresh(all) {
	if (drawTimer) {clearTimeout(drawTimer);drawTimer = null;}

	bgCtx.clearRect(0,0,bgEnv.width,bgEnv.height);
	//bgEnv.width = bgEnv.width;

	var i;

	for (i = 0; i < theRoom.spots.length; i++) {drawSpot(theRoom.spots[i],false);}
	for (i = 0; i < theRoom.draws.length; i++) {drawDraws(theRoom.draws[i],false);}
	if (!prefs.draw.front) preDrawDrawing();
	for (i = 0; i < theRoom.spots.length; i++) {drawSpotName(theRoom.spots[i],false);}
	drawLimboProp();
	for (i = 0; i < theRoom.looseProps.length; i++) {drawLooseProp(theRoom.looseProps[i]);}
	for (i = 0; i < theRoom.users.length; i++) {drawAvatar(theRoom.users[i]);}
	for (i = 0; i < theRoom.users.length; i++) {drawName(theRoom.users[i]);}
	for (i = 0; i < theRoom.spots.length; i++) {drawSpot(theRoom.spots[i],true);}
	for (i = 0; i < theRoom.spots.length; i++) {drawSpotName(theRoom.spots[i],true);}
	for (i = 0; i < theRoom.draws.length; i++) {drawDraws(theRoom.draws[i],true);}
	if (prefs.draw.front) preDrawDrawing();
	for (i = 0; i < chatBubs.length; i++) {drawBubble(chatBubs[i]);}

	if (bgCtx.shadowBlur > 0) {	//intelligently and efficiently restore state machine.
		bgCtx.shadowColor = 'transparent';
		bgCtx.globalAlpha = 1;
		bgCtx.shadowBlur = 0;
		bgCtx.shadowOffsetY = 0;
	}
}

var drawTimer = null;
function reDraw() {
	if (drawTimer) clearTimeout(drawTimer);
	drawTimer = setTimeout(function(){refresh();},0);
}
