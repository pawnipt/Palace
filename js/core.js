// @flow

const palace = new PalaceClient(prefs.registration.regi,prefs.registration.puid);

//move to PalaceRoom
const overLayer = document.getElementById('container');
const bgVideo = document.getElementById('bgVideo');
const backGround = document.getElementById('background');
const bgEnv = document.getElementById('mainlayer');


const electron = require('electron');
const webFrame = electron.webFrame; // need this to getZoomFactor for proper mouse coordinates later


const {remote} = require('electron');
const {Menu, MenuItem} = remote;


const loosePropMenu = new Menu();
loosePropMenu.append(new MenuItem({label: 'Save Prop', click(item) { saveProp(item.menu.pid); }}));
loosePropMenu.append(new MenuItem({type: 'separator'}));
loosePropMenu.append(new MenuItem({label: 'Remove Prop', click(item) { palace.sendPropDelete(item.menu.lpindex) }}));

const userMenu = new Menu();
userMenu.append(new MenuItem({label: 'Whisper ',type: 'checkbox', click(item) {
	var user = palace.theRoom.getUser(item.menu.userId);
	if (user) palace.theRoom.enterWhisperMode(user.id,user.name);
}}));
userMenu.append(new MenuItem({type: 'separator'}));
userMenu.append(new MenuItem({label: 'Offer avatar', click(item) { palace.sendWhisper("'offer",item.menu.userId); }}));
userMenu.append(new MenuItem({label: 'Accept avatar', click(item) { palace.sendXtlk("'accept"); }}));
userMenu.append(new MenuItem({type: 'separator'}));
userMenu.append(new MenuItem({label: 'Prop mute',type: 'checkbox', click(item) {
	var user = palace.theRoom.getUser(item.menu.userId);
	if (user) {
		user.propMuted = !user.propMuted;
		palace.theRoom.reDraw();
	}
}}));

bgEnv.addEventListener('contextmenu', (e) => {
	if (palace.theRoom) {
		e.preventDefault();

		var x = (e.layerX/viewScale).fastRound();
		var y = ((e.layerY + (45*webFrame.getZoomFactor() - 45)) /viewScale).fastRound(); // get excess toolbar height if windows is scaling

		var user = palace.theRoom.mouseOverUser(x,y);

		if (user && user != palace.theUser) {
			userMenu.userId = user.id;
			userMenu.items[0].checked = Boolean(palace.theRoom.whisperUserID);
			userMenu.items[5].checked = Boolean(user.propMuted);
			userMenu.items[2].enabled = palace.theUser.props.length > 0;
			userMenu.popup(remote.getCurrentWindow(),{x:e.x,y:e.y,async:true});
		} else {
			var lpIndex = palace.theRoom.mouseOverLooseProp(x,y);
			if (lpIndex != null) {
				var lp = palace.theRoom.looseProps[lpIndex];
				loosePropMenu.items[0].enabled = (propBagList.indexOf(lp.id) < 0);
				loosePropMenu.pid = lp.id;
				loosePropMenu.lpindex = lpIndex;
				loosePropMenu.popup(remote.getCurrentWindow(),{x:e.x,y:e.y,async:true});
			}
		}
	}
}, false);




const systemAudio = {signon:createAudio('SignOn'),
signoff:createAudio('SignOff'),
whisper:createAudio('Whispered'),
doorclose:createAudio('DoorClose'),
dooropen:createAudio('DoorOpen')};

setEnviornmentSize(window.innerWidth-logField.offsetWidth,window.innerHeight-overLayer.offsetTop-document.getElementById('chatbox').offsetHeight);



class Renderer {
	constructor(canvas) {
		this.context = canvas.getContext("2d");
		this.drawPoints = [];
	}

	refresh() {
		if (this.drawTimer) {
			clearTimeout(this.drawTimer);
			this.drawTimer = null;
		}

		this.context.clearRect(0,0,this.context.canvas.width,this.context.canvas.height);
		//bgEnv.width = bgEnv.width;

		var i;

		for (i = 0; i < this.spots.length; i++) {this.drawSpot(this.spots[i],false);}
		for (i = 0; i < this.draws.length; i++) {this.drawDraws(this.draws[i],false);}
		if (!prefs.draw.front) this.preDrawDrawing();
		for (i = 0; i < this.spots.length; i++) {this.drawSpotName(this.spots[i],false);}
		this.drawLimboProp();
		for (i = 0; i < this.looseProps.length; i++) {this.drawLooseProp(this.looseProps[i]);}
		for (i = 0; i < this.users.length; i++) {this.drawAvatar(this.users[i]);}
		for (i = 0; i < this.users.length; i++) {this.drawName(this.users[i]);}
		for (i = 0; i < this.spots.length; i++) {this.drawSpot(this.spots[i],true);}
		for (i = 0; i < this.spots.length; i++) {this.drawSpotName(this.spots[i],true);}
		for (i = 0; i < this.draws.length; i++) {this.drawDraws(this.draws[i],true);}
		if (prefs.draw.front) this.preDrawDrawing();
		for (i = 0; i < chatBubs.length; i++) {this.drawBubble(chatBubs[i]);} // add chat bubbles to PalaceRoom..

		if (this.context.shadowBlur > 0) {	//intelligently and efficiently restore state machine.
			this.context.shadowColor = 'transparent';
			this.context.globalAlpha = 1;
			this.context.shadowBlur = 0;
			this.context.shadowOffsetY = 0;
		}

	}

	reDraw() {
		if (this.drawTimer) clearTimeout(this.drawTimer);
		this.drawTimer = setTimeout(() => {this.refresh();},0);
	}

	drawBubble(bub) {

		if (this.context.shadowBlur != 2) {
			this.context.shadowColor = 'RGBA(0,0,0,.6)';
			this.context.shadowOffsetY = 1;
			this.context.shadowBlur = 3;
		}

		if (bub.user) {
			var grd;
			if (bub.right) {
				grd = this.context.createLinearGradient(bub.x, 0, bub.x+bub.textWidth, 0);
			} else {
				grd = this.context.createLinearGradient(bub.x+bub.textWidth, 0,bub.x, 0);
			}

			grd.addColorStop(0, getHsl(bub.color,73));
			grd.addColorStop(0.5, getHsl(bub.color,79));
			grd.addColorStop(1, getHsl(bub.color,73));


			this.context.fillStyle = grd;
		} else {
			this.context.fillStyle = 'white';
		}

		if (bub.shout) {
			bub.makeShoutBubble(this.context);
		/* } else if (bub.thought) { */

		} else {
			bub.makeRegularBubble(this.context, bubbleConsts.radius);
		}
		this.context.globalAlpha = bub.size-0.1;
		this.context.fill();

	}

	drawSpot(spot,above) {
		if (above == Boolean(spotConsts.PicturesAboveAll & spot.flags || spotConsts.PicturesAboveProps & spot.flags || spotConsts.PicturesAboveNameTags & spot.flags)) {
			if ((spotConsts.ShowFrame & spot.flags) || (spotConsts.Shadow & spot.flags)) {
				this.makeHotSpot(spot); /* the spots polygon frame */

				if (spotConsts.Shadow & spot.flags) {
					this.context.fillStyle = 'black';
					this.context.fill();
				}
				if (spotConsts.ShowFrame & spot.flags) {
					this.context.strokeStyle = 'black';
					this.context.lineWidth = 1;
					this.context.stroke();
				}
			}
		}
	}

	drawSpotName(spot,above) {
		if ((spotConsts.ShowName & spot.flags) && spot.name.length > 0) {
			if (above == Boolean(spotConsts.PicturesAboveAll & spot.flags || spotConsts.PicturesAboveProps & spot.flags || spotConsts.PicturesAboveNameTags & spot.flags)) {
				var size = 12;
				this.context.fillStyle = 'white';
				this.context.font = size+'px sans-serif';
				this.context.textBaseline = 'top';
				this.context.textAlign = 'center';
				var w = this.context.measureText(spot.name).width+4;
				roundRect(this.context, spot.x-(w/2)-2, spot.y-1, w+4, size+4, 4, true, false);
				this.context.fillStyle = 'black';
				//this.context.shadowColor = 'transparent';
				this.context.fillText(spot.name, spot.x, spot.y);
			}
		}
	}

	makeHotSpot(spot) {
		this.context.beginPath();
		this.context.moveTo(spot.x + spot.points[0], spot.y + spot.points[1]);
		var len = spot.points.length-1;
		for (var i=2; i < len; i+=2) {
		 	this.context.lineTo(spot.x + spot.points[i], spot.y + spot.points[i+1]);
		 }
		this.context.closePath();
	}

	drawLooseProp(lProp) {
		var aProp = allProps[lProp.id];
		if (aProp && aProp.isComplete) {
			var gAlpha = 1;
			if (aProp.ghost) gAlpha = gAlpha/2;

			if (this.grabbedProp && this.looseProps[this.grabbedProp.index] == lProp) {
				this.context.globalAlpha = gAlpha/2;
				this.context.drawImage(aProp.img,this.grabbedProp.mx,this.grabbedProp.my);
			}
			if (lProp.light > 0) {
				this.context.shadowColor = 'rgba(124,252,0,'+lProp.light+')';
				this.context.shadowBlur = 4;
			}
			this.context.globalAlpha = gAlpha;
			this.context.drawImage(aProp.img,lProp.x,lProp.y);
			if (this.context.shadowBlur > 0) {
				this.context.shadowColor = 'transparent';
				this.context.shadowBlur = 0;
			}
			if (this.context.globalAlpha < 1) {
				this.context.globalAlpha = 1;
			}
		}
	}

	drawName(user) {
		var overUser = (this.mouseHoverUser != palace.theUser && this.mouseHoverUser == user);

		if (overUser && this.whisperUserID == user.id) {
			this.context.shadowColor = 'IndianRed';
			this.context.shadowBlur = 6;
		} else if (((overUser && this.whisperUserID != user.id) || this.whisperUserID == user.id) || user.light > 0) {
			this.context.shadowColor = 'rgba(152,251,152,'+user.light+')';
			this.context.shadowBlur = 6;
		}


		if (this.whisperUserID != null && this.whisperUserID != user.id && user != palace.theUser) {
			this.context.globalAlpha = 0.5;
		}
		if (user.scale != 1) {
			var size = 1/user.scale;
			this.context.scale(size,size);
		}
		var loc = user.nameRectBounds;

		this.context.drawImage(user.nametag, loc.x, loc.y);
		if (this.context.shadowBlur > 0) {
			this.context.shadowColor = 'transparent';
			this.context.shadowBlur = 0;
		}
		if (this.context.globalAlpha < 1) {
			this.context.globalAlpha = 1;
		}
		if (user.scale != 1) {
			this.context.setTransform(1, 0, 0, 1, 0, 0); // resets transform
		}

	}

	drawAvatar(user) {
		var overUser = (this.mouseHoverUser != palace.theUser && this.mouseHoverUser == user);

		if (overUser && this.whisperUserID == user.id) {
			this.context.shadowColor = 'IndianRed';
			this.context.shadowBlur = 6;
		} else if (((overUser && this.whisperUserID != user.id) || this.whisperUserID == user.id) || user.light > 0) {
			this.context.shadowColor = 'rgba(152,251,152,'+user.light+')';
			this.context.shadowBlur = 6;
			this.context.filter = 'brightness('+(user.light*15+100).fastRound()+'%)';
		}

		if (user.scale != 1) {
			var size = 1/user.scale;
			this.context.scale(size,size);
		}

		if ((this.whisperUserID != null && this.whisperUserID != user.id && user != palace.theUser)) {
			this.context.globalAlpha = 0.5;
		}
		if (user.showHead !== false || user.propMuted) {
			this.drawSmiley(user);
		}
		if (!user.propMuted) {
			for (var i = 0; i < user.props.length; i++) {
				var aProp = allProps[user.props[i]];
				if (aProp && (!aProp.animated || user.animatePropID === undefined || user.animatePropID == aProp.id)) {
					this.drawUserProp(user,aProp);
				}
			}
		}
		if (this.context.shadowBlur > 0) {
			this.context.shadowColor = 'transparent';
			this.context.shadowBlur = 0;
			this.context.filter = 'none';
		}
		if (this.context.globalAlpha < 1) this.context.globalAlpha = 1;
		if (user.scale != 1) this.context.setTransform(1, 0, 0, 1, 0, 0); // resets transform
	}

	drawSmiley(user) {
		this.context.drawImage(smileys[user.face+','+user.color],user.x*user.scale-21,user.y*user.scale-21);
	}

	drawUserProp(user,aProp) {
		if (aProp.isComplete) {
			var iAlpha = this.context.globalAlpha;
			if (aProp.ghost) this.context.globalAlpha = iAlpha/2;
			var draggingSelfProp = (aProp.id == this.mouseSelfProp && user == palace.theUser);
			if (draggingSelfProp) {
				this.context.shadowColor = 'LawnGreen';
				this.context.shadowBlur = 4;
			}
			this.context.drawImage(aProp.img,user.x*user.scale-22+aProp.x,user.y*user.scale-22+aProp.y,aProp.w,aProp.h);
			if (aProp.ghost) this.context.globalAlpha = iAlpha; //minimizing changes to machine state
			if (draggingSelfProp) {
				this.context.shadowColor = 'transparent';
				this.context.shadowBlur = 0;
			}
		}
	}



	drawLimboProp() { /* when dragging a prop from self or another location */
		if (this.grabbedProp && this.grabbedProp.index == -1) {
			var aProp = allProps[this.grabbedProp.id];
			if (aProp && aProp.isComplete) {
				if (aProp.ghost) this.context.globalAlpha = 0.5;
				this.context.globalAlpha = this.context.globalAlpha/2;
				this.context.drawImage(aProp.img,this.grabbedProp.mx,this.grabbedProp.my);
				this.context.globalAlpha = 1;
			}
		}
	}


	drawDraws(draw,foreground) {
		if (Boolean(roomDrawConsts.front & draw.type) == foreground) {
			this.context.lineWidth = draw.pensize;
			this.context.fillStyle = draw.fillcolor;
			this.context.strokeStyle = draw.pencolor;

			if (!Boolean(draw.type & roomDrawConsts.text) && !Boolean(draw.type & roomDrawConsts.oval)) {
				this.context.beginPath();
				this.context.moveTo(draw.points[0], draw.points[1]);

				for (var item = 2; item < draw.points.length-1; item += 2)
					this.context.lineTo(draw.points[item], draw.points[item+1]);

				if (roomDrawConsts.shape & draw.type) {
					this.context.closePath();
					this.context.fill();
				}
				this.context.stroke();

			}
		}
	}

	preDrawDrawing() {
		var l = this.drawPoints.length;
		if (l > 0) {
			this.context.lineWidth = prefs.draw.size;
			this.context.fillStyle = prefs.draw.fill;
			this.context.strokeStyle = prefs.draw.color;

			this.context.beginPath();

			var offset = 0;
			if (prefs.draw.type == 0) offset = Math.floor(prefs.draw.size/2);

			this.context.moveTo(this.drawPoints[0]+offset, this.drawPoints[1]+offset);

			for (var item = 2; item < l-1; item += 2)
				this.context.lineTo(this.drawPoints[item]+offset, this.drawPoints[item+1]+offset);

			if (prefs.draw.type == 1) {
				this.context.closePath();
				this.context.fill();
			}
			this.context.stroke();
		}
	}


	static drawingEnd() { // might redo these functions, don't like it like that
		palace.sendDraw({
			type:(prefs.draw.type == 1),
			front:prefs.draw.front,
			color:prefs.draw.color.getNbrs(),
			fill:prefs.draw.fill.getNbrs(),
			size:prefs.draw.size,
			points:palace.theRoom.drawPoints
		});

		window.removeEventListener('mousemove',Renderer.drawing);
		window.removeEventListener('mouseup',Renderer.drawingEnd);

		palace.theRoom.drawPoints = [];
	}
	static drawing(event) {
		var offset = 0;
		if (prefs.draw.type == 0) offset = Math.floor(prefs.draw.size/2);
		var x = ((event.x+document.body.scrollLeft-overLayer.offsetLeft)/viewScale).fastRound()-offset;
		var y = ((event.y+document.body.scrollTop-overLayer.offsetTop)/viewScale).fastRound()-offset; //45 get new toolbar height if zooming
		if (event.shiftKey && drawPoints.length > 3) {
			palace.theRoom.drawPoints[palace.theRoom.drawPoints.length-1] = y;
			palace.theRoom.drawPoints[palace.theRoom.drawPoints.length-2] = x;
		} else {
			palace.theRoom.drawPoints.push(x);
			palace.theRoom.drawPoints.push(y);
		}

		palace.theRoom.reDraw();
	}
}



class PalaceRoom extends Renderer {
	constructor(info) {
		super(bgEnv);

		Object.assign(this, info); // copy info to the new instance

		bgEnv.onmousedown = (e) => {this.mouseDown(e)};
		bgEnv.onmousemove = (e) => {this.mouseMove(e)};
		bgEnv.onmouseup = (e) => {this.mouseUp(e)};
		bgEnv.onmouseleave = (e) => {this.mouseLeave(e)};
		bgEnv.ondrop = (e) => {this.drop(e)};
		bgEnv.ondragover = (e) => {this.dragOver(e)};

		this.whisperUserID = null; // redo code so this isn't needed
		this.mouseHoverUser = null;
		this.mouseLooseProp = null;
		this.mouseSelfProp = null;

		var mCanvas = document.createElement('canvas'); /* offscreen buffer for prop pixel detection */
		mCanvas.width = 220;
		mCanvas.height = 220;
		this.mCtx = mCanvas.getContext('2d');


		Bubble.deleteAllBubbles();

		document.getElementById('palaceroom').innerText = this.name;

		var media = passUrl(this.background);
		var ext = parseURL(media).pathname.split('.').pop();
		if (media != palace.lastLoadedBG) {	/* prevent reloading of background media when room is authored */
			//setEnviornment(window.innerWidth-logField.offsetWidth,window.innerHeight-overLayer.offsetTop,'');
			setEnviornment(bgEnv.width,bgEnv.height,'');
			toggleLoadingBG(true);
			if (ext == 'mp4' || ext == 'ogg' || ext == 'webm' || ext == 'm4v') {	/* eventually use http request as well, to determine resource type */
				setBackGroundVideo(media);
			} else {
				setBackGround(media);
			}
		}

		PalaceRoom.removeAllSpotPics();

		this.pics = [];

		info.pictures.forEach((pict) => {
			var newImg = document.createElement('img');
			newImg.onload = () => {
				this.spots.forEach((spot) => {
					if (!spot.img) {
						spot.img = PalaceRoom.createSpotPicPlaceholder();
						overLayer.appendChild(spot.img);
					}
					this.setSpotImg(spot);
				});
			};
			pict.img = newImg;
			this.pics[pict.id] = pict;
			newImg.src = passUrl(pict.name);
		});

	}

	dragOver(event) {
		event.preventDefault();
	}

	drop(event) {
		event.preventDefault();
		if (palace.theUser && dragPropID) {
			var x = (event.layerX/viewScale).fastRound();
			var y = (event.layerY/viewScale).fastRound();
			var overSelf = (palace.theUser && palace.theUser.x-22 < x && palace.theUser.x+22 > x && palace.theUser.y-22 < y && palace.theUser.y+22 > y);

			loadProps([dragPropID],true,function() { //callback to drop the prop once it is loaded from the users bag
				var prop = allProps[dragPropID];
				if (prop) {
					if (!overSelf) {
						palace.sendPropDrop(x-prop.w/2,y-prop.h/2,dragPropID);
					} else {
						palace.addSelfProp(dragPropID);
						palace.selfPropChange(); //normally the mouse up even for the canvas would handle this but we're now async?
					}
				}
			});
		}
	}

	mouseMove(event) {
		if (palace.theRoom) {
			var isDrawing = document.getElementById('drawcheckbox').checked;

			if (isDrawing) {
				switch(prefs.draw.type) {
					case 1: bgEnv.style.cursor = 'url(img/bucket.cur) 16 13,crosshair'; break;
					default: bgEnv.style.cursor = 'url(img/pen.cur) 1 14,crosshair';
				}
				bgEnv.dataset.cursorName = '';
				return true;
			}
			if (palace.theUser == null) return false;

			var x = (event.layerX/viewScale).fastRound();
			var y = ((event.layerY+(45*webFrame.getZoomFactor() - 45))/viewScale).fastRound();

			if (!palace.theRoom.grabbedProp) {

				if (!event.shiftKey) { /* shift toggles between user and props */
					var mUser = palace.theRoom.mouseOverUser(x,y);
					if (palace.theRoom.mouseHoverUser != mUser) {
						if (mUser != null) {
							palace.theRoom.mouseEnterUser(mUser);
						} else {
							palace.theRoom.mouseExitUser();
						}
					}
				} else {
					palace.theRoom.mouseExitUser();
				}

				if (event.shiftKey) { /* for efficiency sake, check shiftkey before bothering to scan */
					var pid = palace.theRoom.mouseOverSelfProp(x,y);
					if (palace.theRoom.mouseSelfProp != pid) {
						if (pid != null) {
							palace.theRoom.mouseEnterSelfProp(pid);
						} else {
							palace.theRoom.mouseExitSelfProp();
						}
					}
				} else {
					palace.theRoom.mouseExitSelfProp();
				}

				var lpIndex = palace.theRoom.mouseOverLooseProp(x,y);
				if (lpIndex != palace.theRoom.mouseLooseProp) {
					if (lpIndex != null) {
						palace.theRoom.mouseEnterLooseProp(lpIndex);
					} else {
						palace.theRoom.mouseExitLooseProp();
					}
				}
			} else {
				palace.theRoom.mouseExitLooseProp();
				palace.theRoom.mouseExitSelfProp();

				if (palace.theUser.x-22 < x && palace.theUser.x+22 > x && palace.theUser.y-22 < y && palace.theUser.y+22 > y) {
					palace.addSelfProp(palace.theRoom.grabbedProp.id);
					palace.theRoom.grabbedProp.mx = -999; /* temp vanishing */
					palace.theRoom.grabbedProp.my = -999;
				} else {
					if (event.altKey == false && (palace.theUser.propsChanged == true || palace.theRoom.grabbedProp.index < 0))
						palace.removeSelfProp(palace.theRoom.grabbedProp.id);

					palace.theRoom.grabbedProp.mx = (x-palace.theRoom.grabbedProp.offsetX);
					palace.theRoom.grabbedProp.my = (y-palace.theRoom.grabbedProp.offsetY);
				}
				palace.theRoom.reDraw();
			}

			if (palace.theRoom.grabbedProp && event.altKey) {
				setEnvCursor('copy');
			} else if (palace.theRoom.mouseLooseProp != null || palace.theRoom.mouseSelfProp != null || palace.theRoom.grabbedProp) {
				setEnvCursor('move');
			} else if (palace.theRoom.mouseHoverUser == palace.theUser && event.ctrlKey) {
				setEnvCursor('context-menu');
			} else {
				var spot = palace.theRoom.mouseInSpot(x,y);
				if ((palace.theRoom.mouseHoverUser != null && palace.theRoom.mouseHoverUser != palace.theUser) || (spot && spot.type > 0)) {
					setEnvCursor('pointer');
				} else {
					setEnvCursor('default');
				}
			}
		}
	}

	mouseLeave(event) { // this wouldn't be nessacery if i used the windows mouse events
		if (palace.theRoom) {
			var x = (event.layerX/viewScale).fastRound();
			var y = (event.layerY/viewScale).fastRound();
			palace.theRoom.mouseExitSelfProp();
			palace.theRoom.mouseExitLooseProp();
			palace.theRoom.mouseExitUser();
		}
	}

	mouseUp(event) {
		if (palace.theRoom) {
			if (palace.theRoom.grabbedProp) {
				var x = (event.layerX/viewScale).fastRound();
				var y = ((event.layerY+(45*webFrame.getZoomFactor() - 45))/viewScale).fastRound();
				var overSelf = (palace.theUser && palace.theUser.x-22 < x && palace.theUser.x+22 > x && palace.theUser.y-22 < y && palace.theUser.y+22 > y);
				if (palace.theRoom.grabbedProp.index == -1) {
					if (!overSelf) {
						palace.sendPropDrop(x - palace.theRoom.grabbedProp.offsetX,y - palace.theRoom.grabbedProp.offsetY, palace.theRoom.grabbedProp.id);
					} else {
						palace.addSelfProp(palace.theRoom.grabbedProp.id);
					}
				} else {
					if (!event.altKey) {
						if (overSelf) {
							palace.sendPropDelete(palace.theRoom.grabbedProp.index);
						} else {
							palace.sendPropMove(x - palace.theRoom.grabbedProp.offsetX,y - palace.theRoom.grabbedProp.offsetY, palace.theRoom.grabbedProp.index);
						}
					} else {
						if (!overSelf) palace.sendPropDrop(x - palace.theRoom.grabbedProp.offsetX,y - palace.theRoom.grabbedProp.offsetY, palace.theRoom.grabbedProp.id);
					}
				}
				palace.theRoom.reDraw();
			}
			delete palace.theRoom.grabbedProp;
			if (palace.theUser && palace.theUser.propsChanged === true) palace.selfPropChange();
		}
	}

	mouseDown(event) {
		document.getElementById('chatbox').blur();
		if (palace.theUser && event.button == 0) {
			event.preventDefault();
			var isDrawing = document.getElementById('drawcheckbox').checked;
			var x = (event.layerX/viewScale).fastRound();
			var y = ((event.layerY + (45*webFrame.getZoomFactor() - 45)) /viewScale).fastRound(); // get excess toolbar height if windows is scaling
			if (isDrawing) {
				var offset = 0;
				if (prefs.draw.type == 0) offset = Math.floor(prefs.draw.size/2);
				this.drawPoints = [x-offset,y-offset];
				window.addEventListener('mousemove',Renderer.drawing);
				window.addEventListener('mouseup',Renderer.drawingEnd);
			} else {
				var lpIndex = null;
				var pid = null;

				var mUser = this.mouseOverUser(x,y);
				if (!event.shiftKey && mUser != palace.theUser && mUser != null) {
					this.enterWhisperMode(mUser.id,mUser.name);
				} else {
					if (event.shiftKey) pid = this.mouseOverSelfProp(x,y);
					if (pid == null) lpIndex = this.mouseOverLooseProp(x,y);

					if (pid != null) {
						var aProp = allProps[pid];
						this.makeDragProp(-1, pid, x, y, x-aProp.x-palace.theUser.x+22, y-aProp.y-palace.theUser.y+22);
					} else if (lpIndex != null) {
						var lProp = this.looseProps[lpIndex];
						this.makeDragProp(lpIndex, lProp.id, x, y, x-lProp.x, y-lProp.y);
					} else if (mUser == null || mUser == palace.theUser) { /* if not clicking another user */

						var clickSpotInfo = (x,y) => {
							var ai = {};
							var spot;
							for (var i = this.spots.length; --i >= 0;) {
								spot = this.spots[i];
								this.makeHotSpot(spot);
								if (this.context.isPointInPath(x,y)) {
									if (ai.spot == null) ai.spot = spot;
									if (spotConsts.DontMoveHere & spot.flags) ai.dontMove = true;
								}
							}
							return ai;
						};

						var areaInfo = clickSpotInfo(x,y);
						if (areaInfo.dontMove !== true) setpos(x,y);
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
									var d = this.getSpot(dest);
									if (d != null) {
										if (d.state == 0) {
											palace.sendLockRoom(dest)
										} else {
											palace.sendUnlockRoom(dest)
										}
									}
									break;
							}
						}
					}
				}
			}
		}
	}

	static createSpotPicPlaceholder() {
		var ph = document.createElement('span');
		ph.className = 'spholder';
		return ph;
	}
	static removeAllSpotPics() {
		var childs = overLayer.children;
		for (var i = childs.length; --i >= 0;) {
			if (childs[i].className.substr(0,7) == 'spotpic' || childs[i].className == 'spholder') {
				overLayer.removeChild(childs[i]);
			}
		}
	}

	draw(draw) {
		if (roomDrawConsts.clean & draw.type) {
			this.draws = [];
		} else if (roomDrawConsts.undo & draw.type) {
			this.draws.pop();
		} else {
			this.draws.push(draw);
		}
		palace.theRoom.reDraw();
	}

	setSpotImg(spot) {
		var statepic = spot.statepics[spot.state];
		if (statepic && this.pics[statepic.id]) {
			var img = this.pics[statepic.id].img;
			if (img.naturalWidth > 0) {
				if (spot.img.src !== img.src) {
					img = img.cloneNode(false);
					img.style.left = spot.x+statepic.x-(img.naturalWidth/2).fastRound()+'px';
					img.style.top = spot.y+statepic.y-(img.naturalHeight/2).fastRound()+'px';
					img.className = 'spotpic';
					if (Boolean(spotConsts.PicturesAboveAll & spot.flags || spotConsts.PicturesAboveProps & spot.flags || spotConsts.PicturesAboveNameTags & spot.flags)) {
						img.className += ' ontop';
					}
					overLayer.replaceChild(img,spot.img); // was an error with this, not sure if it is fixed
					spot.img = img;
				} else {
					spot.img.style.left = spot.x+statepic.x-(spot.img.naturalWidth/2).fastRound()+'px';
					spot.img.style.top = spot.y+statepic.y-(spot.img.naturalHeight/2).fastRound()+'px';
				}
			}
		} else if (spot.img && spot.img.className != 'spholder') { /* spot is not displaying a pic so put in placeholder */
			var img = PalaceRoom.createSpotPicPlaceholder();
			overLayer.replaceChild(img,spot.img);
			spot.img = img;
		}
	}

	spotStateChange(info) {
		var spot = this.getSpot(info.spotid);
		if (this.id == info.roomid && spot) {
			spot.state = info.state;
			this.setSpotImg(spot);
			if (info.lock === false) {
				if (!prefs.general.disableSounds) systemAudio.dooropen.play();
			} else if (info.lock === true) {
				if (!prefs.general.disableSounds) systemAudio.doorclose.play();
			}
		}
	}

	spotMove(info) {
		var spot = this.getSpot(info.spotid);
		if (this.id == info.roomid && spot) {
			spot.x = x;
			spot.y = y;
			this.setSpotImg(spot);
			this.reDraw();
		}
	}

	spotMovePic(info) {
		var spot = this.getSpot(info.spotid);
		if (this.id == info.roomid && spot && spot.statepics[spot.state]) {
			spot.statepics[spot.state].x = x;
			spot.statepics[spot.state].y = y;
			this.setSpotImg(spot);
			//palace.theRoom.reDraw();
		}
	}

	getSpot(spotid) {
		return this.spots.find(function(spot){return spotid == spot.id;});
	}


	loosePropAdd(data) {
		this.looseProps.unshift(data);

		/* corrects index of currently dragged loose prop to prevent moving the wrong one */
		if (this.grabbedProp && this.grabbedProp.index > -1) this.grabbedProp.index++;
		if (this.mouseLooseProp != null) this.mouseLooseProp++;
		if (loosePropMenu.lpindex != undefined) loosePropMenu.lpindex++;

		loadProps([data.id]);
		this.reDraw();
	}

	loosePropMove(x,y,index) {
		if (index >= 0 && this.looseProps.length > index) {
			var lp = this.looseProps[index];
			if (lp && (lp.x != x || lp.y != y)) {
				lp.x = x;
				lp.y = y;
				this.reDraw();
			}
			/* mouseMove(event); */
		}
	}

	loosePropDelete(index) {
		var change = false;
		if (index < 0) {
			if (this.looseProps.length > 0) change = true;
			this.looseProps = [];
		} else if (this.looseProps.length >= index) {

			var adjustIndex = function(idx) {
				if (idx > -1) {
					if (index == idx) {
						return null;
					} else if (index < idx) {
						return --idx;
					}
					return idx;
				}
			};

			if (this.grabbedProp) this.grabbedProp.index = adjustIndex(this.grabbedProp.index);
			if (this.mouseLooseProp != null) this.mouseLooseProp = adjustIndex(this.mouseLooseProp);
			if (loosePropMenu.lpindex != undefined) loosePropMenu.lpindex = adjustIndex(loosePropMenu.lpindex);

			change = true
			this.looseProps.splice(index,1);
		}
		if (change) this.reDraw();
	}



	removeUser(info) {
		var user = this.getUser(info.id);
		if (user) {
			if (user == palace.theUser) {
				user.remove();
			} else {
				logmsg(user.name+' has '+(info.logoff?'signed off.':'left the room.'));
				user.shrink(10);
			}

			return true;
		}
	}



	addUser(info) {
		var dude = new PalaceUser(info);
		var loggedOn = (palace.lastUserLogOnID == dude.id && ticks()-palace.lastUserLogOnTime < 900);
		if (loggedOn) { // if under 15 seconds
			palace.lastUserLogOnID = 0;
			palace.lastUserLogOnTime = 0;
			if (!prefs.general.disableSounds) systemAudio.signon.play();
		}
		if (palace.theUserID == dude.id && palace.theUser != dude) {
			setUserInterfaceAvailability(false);
			palace.theUser = dude;
		}

		if (dude != palace.theUser) {
			logmsg(dude.name+' has '+(loggedOn?'signed on.':'entered the room.'));
		}

		this.users.push(dude);

		loadProps(dude.props);
		dude.animator();
		dude.grow(10);
		this.setUserCount(); // add to palace client class
	}
	getUser(uid) {
		return this.users.find(function(user){return uid == user.id;});
	}
	loadUsers(infos) {
		this.stopAllUserAnimations();

		var dudes = [];
		infos.find(function(info){dudes.push(new PalaceUser(info))});

		this.users = dudes;

		var pids = [];
		dudes.find(function(dude){pids = dude.props.concat(pids)});
		this.looseProps.find(function(prop){pids.push(prop.id)});

		loadProps(pids.dedup());
		dudes.find(function(dude){dude.animator()});

		this.setUserCount();

		this.refresh();
	}

	stopAllUserAnimations() {
		if (this.users) this.users.forEach(function(dude){if (dude.animateTimer) dude.stopAnimation();});
	}


	userColorChange(info) {
		var user = this.getUser(info.id);
		if (user && user.color != info.color) {
			user.color = info.color;
			user.preRenderNametag();
			this.reDraw();
			return true;
		}
	}
	userFaceChange(info) {
		var user = this.getUser(info.id);
		if (user && user.face != info.face) {
			user.face = info.face;
			this.reDraw();
			return true;
		}
	}
	userPropChange(info) {
		var user = this.getUser(info.id);
		if (user) user.changeUserProps(info.props);
	}

	userAvatarChange(info) {
		var user = this.getUser(info.id);
		if (user) {
			user.color = info.color;
			user.face = info.face;
			user.preRenderNametag();
			user.changeUserProps(info.props);
			this.reDraw();
		}
	}
	userNameChange(info) {
		var user = this.getUser(info.id);
		if (user && user.name !== info.name) {
			user.name = info.name;
			user.preRenderNametag();
			this.reDraw();
		}
	}
	userMove(info) {
		var user = this.getUser(info.id);
		if (user && (user.x != info.x || user.y != info.y)) {
			user.popBubbles();
			user.x = info.x;
			user.y = info.y;
			this.reDraw();
		}
	}
	userChat(chat) {
		var user = this.getUser(chat.id);
		var chatspan = document.createElement('div');
		chatspan.className = 'userlogchat';
		var namespan = document.createElement('div');
		namespan.className = 'userlogname';

		var bubInfo = Bubble.processChatType(chat.chatstr);

		if (bubInfo.type > -1 && bubInfo.start < chat.chatstr.length) new Bubble(user,chat,bubInfo);

		if (user) {
			namespan.innerText = user.name;
	 		namespan.style.color = getHsl(user.color,40);
		} else {
			namespan.innerText = '***';
			if (chat.whisper !== true) chatspan.style.color = 'IndianRed';
		}

		var timestamp = document.createElement('span');
		timestamp.className = 'userlogtime';
		timestamp.innerText = ' '+timeStampStr(true);
		chatspan.appendChild(timestamp);

		if (chat.whisper === true) {
			chatspan.className = chatspan.className + ' userlogwhisper';
			if (!document.hasFocus() && !prefs.general.disableSounds) systemAudio.whisper.play();
		}
		chatspan.appendChild(namespan);
		chatspan.appendChild(makeHyperLinks(chat.chatstr));

		logAppend(chatspan);
	}

	setUserCount() {
		document.getElementById('palaceroom').title = this.users.length + ' / ' + palace.serverUserCount;
	}



	enterWhisperMode(userid,name) {
		var cancel = (this.whisperUserID == userid);
		if (this.whisperUserID != null || cancel) {
			this.exitWhisperMode(); /* whisper toggle */
		}
		if (!cancel) {
			document.getElementById('chatbox').placeholder = 'Whisper to ' + name;
			this.whisperUserID = userid;
			var user = this.getUser(userid);
			if (user) {
				user.light = 1;
				user.poke();
			}
			this.refresh();
		}
	}

	exitWhisperMode() {
		document.getElementById('chatbox').placeholder = 'Chat...';
		var user = this.getUser(this.whisperUserID);
		if (user) {
			user.light = 0;
			user.poke();
		}
		this.whisperUserID = null;
		this.refresh();
	}

	makeDragProp(i,pid,x,y,x2,y2) {
		this.grabbedProp = {index:i,id:pid,offsetX:x2,offsetY:y2,mx:x-x2,my:y-y2};
	}

	mouseInSpot(x,y) {
		var spot;
		for (var i = this.spots.length; --i >= 0;) {
			spot = this.spots[i];
			this.makeHotSpot(spot);
			if (this.context.isPointInPath(x,y)) return spot;
		}
	}

	mouseOverUser(x,y) {
		for (var i = this.users.length; --i >= 0;) {
			var user = this.users[i];
			if (user.x+22 > x && user.x-22 < x && user.y+22 > y && user.y-22 < y)
				return user;
		}
	}

	mouseOverSelfProp(x,y) {
		if (!this.grabbedProp) {
			for (var i = palace.theUser.props.length; --i >= 0;) {
				var aProp = allProps[palace.theUser.props[i]];
				var px = (palace.theUser.x + aProp.x)-22;
				var py = (palace.theUser.y + aProp.y)-22;
				if (aProp && (!aProp.animated || palace.theUser.animatePropID === undefined || palace.theUser.animatePropID == aProp.id) && aProp.isComplete && px < x && (px+aProp.w) > x && py < y && (py+aProp.h) > y) {
					if (this.mouseOverProp(aProp,x,y,px,py)) return aProp.id; /* maybe pass object instead of id */
				}
			}
		}
	}

	mouseOverLooseProp(x,y) {
		if (!this.grabbedProp) {
			for (var i = this.looseProps.length; --i >= 0;) {
				var lProp = this.looseProps[i];
				var aProp = allProps[lProp.id];
				if (aProp && aProp.isComplete && lProp.x < x && (lProp.x+aProp.w) > x && lProp.y < y && (lProp.y+aProp.h) > y) {
					if (this.mouseOverProp(aProp,x,y,lProp.x,lProp.y)) return i; /* maybe pass object instead of index */
				}
			}
		}
	}

	mouseOverProp(aProp,x,y,px,py) { // maybe store props as canvas instead...
		this.mCtx.clearRect(0,0,this.mCtx.canvas.width,this.mCtx.canvas.height);
		this.mCtx.drawImage(aProp.img,0,0,aProp.w,aProp.h);
		return (this.mCtx.getImageData((x-px),(y-py),1,1).data[3] > 0);
	}

	mouseEnterUser(user) {
		this.mouseExitSelfProp();
		this.mouseExitLooseProp();
		this.mouseExitUser();
		if (user != palace.theUser) user.light = 1;
		this.mouseHoverUser = user;
		this.reDraw();
	}

	mouseExitUser() {
		if (this.mouseHoverUser) {
			var target = this.mouseHoverUser;
			if (this.whisperUserID != this.mouseHoverUser.id && target != palace.theUser) {
				target.light = 1;
				var fadeTimer = setInterval(() => {
					var user = this.getUser(target.id);
					if (target.light - 0.1 <= 0 || user == this.mouseHoverUser || !user) {
						if (!this.mouseHoverUser || user != this.mouseHoverUser) target.light = 0;
						clearInterval(fadeTimer);
					} else {
						target.light -= 0.09;
						this.reDraw();
					}

				},20);
			}
			this.mouseHoverUser = null;
			this.reDraw();
		}
	}


	mouseEnterLooseProp(lpIndex) {
		if (this.mouseHoverUser == null && this.mouseSelfProp == null) {
			this.mouseExitLooseProp();
			this.mouseLooseProp = lpIndex;
			this.looseProps[this.mouseLooseProp].light = 1;
			this.reDraw();
		}
	}

	mouseExitLooseProp() {
		if (this.mouseLooseProp != null) {
			var target = this.looseProps[this.mouseLooseProp];
			if (target) {
				target.light = 1;
				var fadeTimer = setInterval(() => {
					var idx = this.looseProps.indexOf(target);
					if (target.light - 0.1 <= 0 || target == this.looseProps[this.mouseLooseProp] || idx < 0) {
						if (target != this.looseProps[this.mouseLooseProp]) target.light = 0;
						clearInterval(fadeTimer);
						//delete fadeTimer;
					} else {
						target.light -= 0.09;
						this.reDraw();
					}

				},20);
			}
			this.mouseLooseProp = null;
			this.reDraw();
		}
	}

	mouseEnterSelfProp(pid) {
		this.mouseExitLooseProp();
		if (this.mouseHoverUser == null) {
			this.mouseExitSelfProp();
			this.mouseSelfProp = pid;
			this.reDraw();
		}
	}
	mouseExitSelfProp() {
		if (this.mouseSelfProp != null) {
			this.mouseSelfProp = null;
			this.reDraw();
		}
	}

	get nbrLooseProps() {
		return this.looseProps.length;
	}

	get nbrRoomProps() {
		var count = 0;
		for (var i = 0; i < this.users.length; i++) {
			count += this.users[i].props.length;
		}
		count += this.nbrLooseProps;
		return count;
	}

	propInUse(id) {
		for (var i = 0; i < this.users.length; i++)
			for (var j = 0; j < this.users[i].props.length; j++)
				if (this.users[i].props[j] == id) return true;
		for (var o = 0; o < this.looseProps.length; o++)
				if (this.looseProps[o].id == id) return true;
		return false;
	}

	navigationError(type) { //maybe change this to css eventually
		switch(type) {
			case 0:
				logmsg('Internal Server Error!');
				break;
			case 1:
				logmsg('Unknown room.');
				break;
			case 2:
				logmsg('Room is full.');
				break;
			case 3:
				logmsg('Room is closed.');
				break;
			case 4:
				logmsg('You can\'t author.');
				break;
			case 5:
				logmsg('The Server is full.');
				break;
			default:
				logmsg('Unknown navigation error.');
				break;
		}
	}
}



bgVideo.onloadeddata = function () {
	if (this.webkitAudioDecodedByteCount > 0) document.getElementById('muteaudio').style.display = 'block';
};

bgVideo.onloadedmetadata = function () {
	palace.lastLoadedBG = this.src; /* to prevent reloading the video when authoring */
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
	if (palace.currentBG == this.src) {
		if (this.naturalWidth > 0) {
			palace.lastLoadedBG = this.src; /* to prevent reloading the image when authoring */
			setEnviornment(this.naturalWidth,this.naturalHeight,"url("+this.src+")");
		} else {
			bgError();
		}
	}
}

function bgError(force) {
	if (force || palace.currentBG == this.src)
		setEnviornment(window.innerWidth-logField.offsetWidth,window.innerHeight-overLayer.offsetTop,"url(img/error.png)");
}


function setBackGround(url) {
	palace.currentBG = url;
	unloadBgVideo();
	var bg = document.createElement('img');
	bg.onload = bgFinished;
	bg.onerror = bgError;
	bg.src = url;
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


function setEnvCursor(name) {
	if (bgEnv.dataset.cursorName != name) {
		bgEnv.style.cursor = name;
		bgEnv.dataset.cursorName = name;
	}

}

function unloadBgVideo() {
	document.getElementById('muteaudio').style.display = 'none';
	bgVideo.style.display = 'none';
	if (bgVideo.src != '') bgVideo.src = '';
}
function setEnviornment(w,h,bg) {
	toggleLoadingBG();
	setEnviornmentSize(w,h);
	backGround.style.backgroundImage = bg;
    Bubble.resetDisplayedBubbles();
    if (palace.theRoom) palace.theRoom.refresh();
}

function setEnviornmentSize(w,h) {
	bgEnv.width = w;
	bgEnv.height = h;

	if (palace.theRoom) {
		palace.theRoom.context.lineJoin = 'round';
		palace.theRoom.context.lineCap = 'round';
		palace.theRoom.context.imageSmoothingEnabled = false;
	}
	scale2Fit();
	backGround.style.width = w+'px';
    backGround.style.height = h+'px';
	overLayer.style.width = w+'px';
    overLayer.style.height = h+'px';
  											 // 45 is toolbar height
    document.body.style.height = bgEnv.height + 45 + document.getElementById('chatbox').offsetHeight + 'px';
    setBodyWidth();
}

function createAudio(name) {
	var a = document.createElement("audio");
	a.src = 'audio/system/' + name + '.wav';
	return a;
}

function passUrl(s) {
	var url = s.trim().replace(/ /g,'%20');
	return (url.indexOf('http') === 0)? url:palace.mediaUrl+url;
}


gotourl(prefs.general.home);
