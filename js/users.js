var theUser = null;
var theUserID = null;
var theUserStatus = null;

function PalaceUser(info) {
	Object.assign(this, info);
	this.preRenderNametag();
	this.scale = 1;
}
PalaceUser.prototype.poke = function() {
	var target = this;
	this.scale = 1.05;
	reDraw();
	var pokeTimer = setInterval(function() {
		target.scale -= 0.01;
		if (target.scale < 1) {
			target.scale = 1;
			clearInterval(pokeTimer);
		}
		reDraw();
	},20);
};
PalaceUser.prototype.grow = function(from) {
	this.scale = from;
	var target = this;
	var timer = setInterval(function(){
		if (target.scale > 1)
			target.scale -= (target.scale/8);
		if (target.scale <= 1 || target.id == -1) {
			if (target.id != -1) // full scale only if not exiting
				target.scale = 1;
			clearInterval(timer);
		}
		reDraw();
	},20);
};
PalaceUser.prototype.shrink = function(to) {
	var target = this;
	target.id = -1; // marks user as exited and going to be removed from the room.
	var timer = setInterval(function(){
		if (target.scale < to) target.scale += (target.scale/8);
		if (target.scale >= to) {
			clearInterval(timer);
			target.remove();
		}
		reDraw();
	},20);

};
PalaceUser.prototype.remove = function() {
	if (this.stopAnimation) this.stopAnimation();
	this.popBubbles();
	theRoom.users.splice(theRoom.users.indexOf(this),1);
	setUserCount();
	reDraw();
};
var userNameTagHeight = getTextHeight('bold 18px sans-serif')+3;
PalaceUser.prototype.preRenderNametag = function() {
	var font = 'bold 18px sans-serif';
	this.nametag = document.createElement('canvas');
	var ctx = this.nametag.getContext('2d');
	var setStyle = function() {
		ctx.font = font;
		ctx.shadowColor = 'black';
		ctx.shadowBlur = 2;
		ctx.textBaseline = 'top';
		ctx.textAlign = 'left';
	};
	setStyle();
	this.nametag.width = ctx.measureText(this.name).width+4;
	this.nametag.height = userNameTagHeight;
	setStyle();
	
	var grd = bgCtx.createLinearGradient(0, 5, 0, userNameTagHeight-5);
	grd.addColorStop(0, getHsl(this.color,78));
	grd.addColorStop(1, getHsl(this.color,60));
	ctx.fillStyle = grd;
			
	ctx.fillText(this.name, 2, 0);
	ctx.shadowOffsetY = 1;
	ctx.fillText(this.name, 2, 0);
};
PalaceUser.prototype.nametagLoc = function(scale) {
	var w = this.nametag.width;
	var h = this.nametag.height;
	var half = (w/2);
	var x;
	var y;
	var bgw;
	var bgh;
	if (scale) {
		bgw = bgEnv.width*this.scale;
		bgh = bgEnv.height*this.scale;
		x = this.x*this.scale;
		y = (this.y+2)*this.scale;
	} else {
		x = this.x;
		y = this.y+2;
		bgw = bgEnv.width;
		bgh = bgEnv.height;
	}
	if (x-half < 0) x = half;
	if (x > bgw-half) x = bgw-half;
	if (scale) {
		x = x-half;
		y = y+(h/2-2);
	} else {
		x = (x-half).fastRound();
		y = (y+(h/2-2)).fastRound();
	}

	if (y < 0) y = 0;
	if (y > bgh-(h-3)) y = bgh-(h-3);
	
	var pad = 0;
	if (this.isGlowing()) pad = 6;
	return {x:x,y:y,w:w,h:h,padding:pad};
};
PalaceUser.prototype.isGlowing = function() {
	return Boolean(this != theUser && ((mouseHoverUser == this || whisperUserID == this.id)) || this.light > 0);
};
PalaceUser.prototype.nextFrame = function() {
	var l = -1;
	
	if (this.animatePropID)
		l = this.animationPropIDs.indexOf(this.animatePropID);

	
	if (this.reverseAnimation === true) {
		if (0 < l) {
			l--;
			this.animatePropID = this.animationPropIDs[l];
		}
		this.reverseAnimation = !(0 >= l);
	} else {
		if (this.animationPropIDs.length-1 > l) {
			l++;
			this.animatePropID = this.animationPropIDs[l];
			this.reverseAnimation = (this.bounceAnimation === true && (this.animationPropIDs.length-1 <= l));
		} else {
			this.animatePropID = this.animationPropIDs[0];
		}
	}
	reDraw();
};
PalaceUser.prototype.animator = function() {
	delete this.animatePropID;
	this.showHead = true;
	
	var temp = [];
	for (var i = 0; i < this.props.length; i++) {
		var aProp = allProps[this.props[i]];
		if (aProp) {
			if (aProp.animated === true) {
				temp.push(aProp.id);
				if (aProp.bounce === true) this.bounceAnimation = true;
			}
			if (aProp.head === true) this.showHead = false;	/* might as well pre-calculate head */
		}
	}
	
	if (temp.length > 1) {
		this.animationPropIDs = temp;
		this.nextFrame();
		if (!this.animateTimer) {
			var user = this;
			this.animateTimer = setInterval(function(){user.nextFrame()},350);
		}
	} else if (this.animateTimer) {
		this.stopAnimation();
	}
};
PalaceUser.prototype.stopAnimation = function() {
	if (this.animateTimer) {
		clearInterval(this.animateTimer);
		delete this.animateTimer;
	}
	delete this.animatePropID;
	delete this.animationPropIDs;
	delete this.reverseAnimation;
};
PalaceUser.prototype.popBubbles = function() {
	for (var a = quedBubbles.length; --a >= 0;) {
		var bub = quedBubbles[a];
		if (this == bub.user) {
			bub.user = null;
			overLayer.removeChild(bub.p);
			quedBubbles.splice(a,1);
		}
	}
	for (var c = chatBubs.length; --c >= 0;) {
		var bub = chatBubs[c];
		if (this == bub.user) {
			bub.remove(true);
		}
	}
};

function stopAllUserAnimations() {
	theRoom.users.find(function(dude){if (dude.animateTimer) dude.stopAnimation();});
}


function userLogOn(id,count) {
	theRoom.lastUserLogOnID = id;
	theRoom.lastUserLogOnTime = ticks();
	theRoom.serverUserCount = count;
}

function userLogOff(id,count) {
	theRoom.serverUserCount = count;
	if (userRemove(id) && !getGeneralPref('disableSounds')) systemAudio.signoff.play();
	//if (whisperUserID == uInfo.id) exitWhisperMode(); // warn user that whisper target signed off
}

function userRemove(uid) {
	var user = getUser(uid);
	if (user) {
		if (user == theUser) {
			user.remove();
		} else {
			user.shrink(10);
		}
		return true;
	}
}


function getUser(uid) {
	return theRoom.users.find(function(user){return uid == user.id;});
}
																				/* regular for loop is faster... */
function getUserIndex(uid) {
	return theRoom.users.findIndex(function(user){return uid == user.id;});
}

function userChat(chat) {
	var user = getUser(chat.id);
	var chatspan = document.createElement('div');
	chatspan.className = 'userlogchat';
	var namespan = document.createElement('div');
	namespan.className = 'userlogname';
	
	var bubInfo = bubbleAI(chat.chatstr);
	
	if (bubInfo.type > -1 && bubInfo.start < chat.chatstr.length) new Bubble(user,chat,bubInfo);
	
	if (user) {
		namespan.innerText = user.name;
 		namespan.style.color = getHsl(user.color,40);
	} else {
		namespan.innerText = '***';
		if (chat.whisper !== true) chatspan.style.color = 'IndianRed';
	}

	if (chat.whisper === true) {
		chatspan.className = chatspan.className + ' userlogwhisper';
		if (!document.hasFocus() && !prefs.general.disableSounds) systemAudio.whisper.play();
	}
	chatspan.appendChild(namespan);
	chatspan.appendChild(makeHyperLinks(chat.chatstr)); /* use createElement instead of innerHTML for security reasons */
	
	logAppend(chatspan);
}


function addRoomUser(info) {
	var dude = new PalaceUser(info);
	if (theRoom.lastUserLogOnID == dude.id && ticks()-theRoom.lastUserLogOnTime < 900) { // if under 15 seconds
		theRoom.lastUserLogOnID = 0;
		theRoom.lastUserLogOnTime = 0;
		if (!getGeneralPref('disableSounds')) systemAudio.signon.play();
	}
	if (theUserID == dude.id) {
		theUser = dude;
		fullyLoggedOn();
	}

	theRoom.users.push(dude);
	loadProps(dude.props);
	dude.animator();
	dude.grow(10);
	setUserCount();
}

function loadRoomUsers(infos) {
	stopAllUserAnimations();
	
	var dudes = [];
	infos.find(function(info){dudes.push(new PalaceUser(info))});
	
	theRoom.users = dudes;
	
	var pids = [];
	dudes.find(function(dude){pids = dude.props.concat(pids)});
	theRoom.looseProps.find(function(prop){pids.push(prop.id)});

	loadProps(pids.dedup());
	dudes.find(function(dude){dude.animator()});
	
	setUserCount();
	refresh(true);
}



function userColorChange(id,color) {
	var user = getUser(id);
	if (user && user.color != color) {
		user.color = color;
		user.preRenderNametag();
		reDraw();
	}
}

function userFaceChange(id,face) {
	var user = getUser(id);
	if (user && user.face != face) {
		user.face = face;
		reDraw();
	}
}

function changeUserProps(user,props,fromSelf) {
	var wasChange = (user.props.length != props.length);
	var i = 0;
	var significantChange;
	props.find(function(pid) {
		if (user.props.indexOf(pid) < 0) significantChange = true;
		if (!wasChange && user.props[i] != pid) wasChange = true;
		i++;
	});
	user.props = props;
	if (significantChange) loadProps(user.props,fromSelf);
	if (wasChange) {
		if (user == theUser) enablePropButtons();
		user.animator();
		reDraw();
		return true;
	}
}

function userPropChange(id,props) {
	var user = getUser(id);
	if (user) changeUserProps(user,props);
}

function userAvatarChange(id,face,color,props) {
	var user = getUser(id);
	if (user) {
		user.color = color;
		user.face = face;
		user.preRenderNametag();
		changeUserProps(user,props);
		reDraw();
	}
}

function userNameChange(id,name) {
	var user = getUser(id);
	if (user && user.name !== name) {
		user.name = name;
		user.preRenderNametag();
		reDraw();
	}
}

function userMove(id,x,y) {
	var user = getUser(id);
	if (user && (user.x != x || user.y != y)) {
		user.popBubbles();
		user.x = x;
		user.y = y;
		reDraw();
	}
}