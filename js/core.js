// @flow
const smileys = {};
const palace = new PalaceClient(prefs.registration.regi,prefs.registration.puid);


loadSmileys(() => { // gotta be able to smile on a palace!
	palace.goto(prefs.general.home);
});

function loadSmileys(callback) {
	//slice up and preload Smiley Set into object urls
    var buff = document.createElement('canvas');
	buff.height = 44;
	buff.width = 44;
	buff = buff.getContext('2d');
	var smile = document.createElement('img');
	smile.onload = function() {
		let count = 0;
		for (let x = 0; x < 13; x++) {
			for (let y = 0; y < 16; y++) {
				buff.clearRect(0,0,44,44);
				buff.drawImage(this,x*45,y*45,44,44,0,0,44,44);
				smileys[x+','+y] = document.createElement('img');
				buff.canvas.toBlob(function(blob) {
					smileys[x+','+y].src = URL.createObjectURL(blob);
					count++;
					if (count === 208) {
						callback();
					}
				});
			}
		}


		smileys[5+',0'].onload = function () {
			var nakedbutton = document.getElementById('removeprops');
			var src = 'url('+this.src+')';
			nakedbutton.style.backgroundImage = src;

			var smileyfaces = document.getElementById('smileyfaces');
			smileyfaces.style.backgroundImage = src;
			smileyfaces.onclick = function(event) {
				toggleZoomPanel('smileypicker');
			};
			updateDrawPreview();
			this.onload = null;
		};



		var smileycolorpicker = document.getElementById('smileycolorpicker');

		var s = '';
		for (var i = 0; i < 15; i++) s += getHsl(i,50)+',';
		smileycolorpicker.style.background = 'linear-gradient(to right,'+s.substring(0,s.length-1)+')';

		var mouseDown = false;
		smileycolorpicker.onmousemove = function(event) {
			//idfk...
			var color = ((event.x-(this.offsetLeft+this.parentNode.offsetLeft))/(this.clientWidth/15)).fastRound();
			if (mouseDown && color > -1 && color < 16 && palace.theRoom.userColorChange({id:palace.theUserID,color:color})) {
				palace.sendFaceColor(color);
			}
		};
		smileycolorpicker.onmousedown = function(event) {
			event.preventDefault();
			mouseDown = true;
			smileycolorpicker.onmousemove(event);
		};
		smileycolorpicker.onmouseup = function(event) {
			mouseDown = false;
		};
		smileycolorpicker.onmouseleave = smileycolorpicker.onmouseup;
		var smileypicker = document.getElementById('smileypicker');
		for (var i = 0; i < 13; i++) {
			var img = smileys[i+',0'];
			img.className = 'smileyface';
			img.draggable = false;
			img.onclick = function() {
				var faces = this.parentNode.getElementsByTagName('img');
				for (var e = 0; e < faces.length; e++) {
					if (faces[e] == this && palace.theRoom.userFaceChange({id:palace.theUserID,face:e})) {
						palace.sendFace(e);
					}
				}
			}
			smileypicker.appendChild(img);
		}


		this.onload = null;
	};
	smile.src = 'img/smileys.png';
}

class Renderer {
	constructor(canvas,canvas2) {
		this.context = canvas.getContext("2d");
		this.topcontext = canvas2.getContext("2d");
		this.drawPoints = [];
	}

	get canvas() {
		return this.context.canvas;
	}

	refreshTop() {
		if (this.drawTimer2) {
			clearTimeout(this.drawTimer2);
			this.drawTimer2 = null;
		}
		this.topcontext.clearRect(0,0,this.topcontext.canvas.width,this.topcontext.canvas.height);

		let i;


		for (i = 0; i < this.draws.length; i++) {this.drawDraws(this.draws[i],true,this.topcontext);}
		if (prefs.draw.front) this.preDrawDrawing(this.topcontext);
		for (i = 0; i < this.spots.length; i++) {this.drawSpot(this.spots[i],true,this.topcontext);} // need to make clicking a spot work if they are above a user and loose props
		for (i = 0; i < this.spots.length; i++) {this.drawSpotName(this.spots[i],true,this.topcontext);}

		for (i = 0; i < chatBubs.length; i++) {this.drawBubble(chatBubs[i]);} // add chat bubbles to PalaceRoom..

		if (this.topcontext.shadowBlur > 0) {	//intelligently and efficiently restore state machine.
			this.topcontext.shadowColor = 'transparent';
			this.topcontext.globalAlpha = 1;
			this.topcontext.shadowBlur = 0;
			this.topcontext.shadowOffsetY = 0;
		}
	}

	reDrawTop() {
		if (!this.drawTimer2) {
			this.drawTimer2 = setTimeout(() => {this.refreshTop();},15);
		}
	}

	refresh() {
		if (this.drawTimer) {
			clearTimeout(this.drawTimer);
			this.drawTimer = null;
		}
		this.context.clearRect(0,0,this.context.canvas.width,this.context.canvas.height);

		let i;

		for (i = 0; i < this.spots.length; i++) {this.drawSpot(this.spots[i],false,this.context);}
		for (i = 0; i < this.draws.length; i++) {this.drawDraws(this.draws[i],false,this.context);}
		if (!prefs.draw.front) this.preDrawDrawing(this.context);
		for (i = 0; i < this.spots.length; i++) {this.drawSpotName(this.spots[i],false,this.context);}
		this.drawLimboProp();
		for (i = 0; i < this.looseProps.length; i++) {this.drawLooseProp(this.looseProps[i]);}

		if (this.context.shadowBlur > 0) {	//intelligently and efficiently restore state machine.
			this.context.shadowColor = 'transparent';
			this.context.globalAlpha = 1;
			this.context.shadowBlur = 0;
			this.context.shadowOffsetY = 0;
		}

	}

	reDraw() {
		if (!this.drawTimer) {
			this.drawTimer = setTimeout(() => {this.refresh();},15);
		}
	}

	drawBubble(bub) {

		if (this.topcontext.shadowBlur !== 2) {
			this.topcontext.shadowColor = 'RGBA(0,0,0,.6)';
			this.topcontext.shadowOffsetY = 1;
			this.topcontext.shadowBlur = 3;
		}

		if (bub.user) {
			var grd;
			if (bub.right) {
				grd = this.topcontext.createLinearGradient(bub.x, 0, bub.x+bub.textWidth, 0);
			} else {
				grd = this.topcontext.createLinearGradient(bub.x+bub.textWidth, 0,bub.x, 0);
			}

			grd.addColorStop(0, getHsl(bub.color,73));
			grd.addColorStop(0.5, getHsl(bub.color,79));
			grd.addColorStop(1, getHsl(bub.color,73));


			this.topcontext.fillStyle = grd;
		} else {
			this.topcontext.fillStyle = 'white';
		}

		if (bub.shout) {
			bub.makeShoutBubble(this.topcontext);
		/* } else if (bub.thought) { */

		} else {
			bub.makeRegularBubble(this.topcontext);
		}
		this.topcontext.globalAlpha = bub.size-0.1;
		this.topcontext.fill();

	}

	drawSpot(spot,above,ctx) {
		if (above === Boolean(spotConsts.PicturesAboveAll & spot.flags || spotConsts.PicturesAboveProps & spot.flags || spotConsts.PicturesAboveNameTags & spot.flags)) {
			if ((spotConsts.ShowFrame & spot.flags) || (spotConsts.Shadow & spot.flags)) {
				this.makeHotSpot(spot); /* the spots polygon frame */

				if (spotConsts.Shadow & spot.flags) {
					ctx.fillStyle = 'black';
					ctx.fill();
				}
				if (spotConsts.ShowFrame & spot.flags) {
					ctx.strokeStyle = 'black';
					ctx.lineWidth = 1;
					ctx.stroke();
				}
			}
		}
	}

	roundRect(x, y, width, height, radius) {

		this.context.beginPath();
		this.context.moveTo(x + radius, y);
		this.context.lineTo(x + width - radius, y);
		this.context.quadraticCurveTo(x + width, y, x + width, y + radius);
		this.context.lineTo(x + width, y + height - radius);
		this.context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
		this.context.lineTo(x + radius, y + height);
		this.context.quadraticCurveTo(x, y + height, x, y + height - radius);
		this.context.lineTo(x, y + radius);
		this.context.quadraticCurveTo(x, y, x + radius, y);
		this.context.closePath();

		this.context.fill();

	}

	drawSpotName(spot,above,ctx) {
		if ((spotConsts.ShowName & spot.flags) && spot.name.length > 0) {
			if (above === Boolean(spotConsts.PicturesAboveAll & spot.flags || spotConsts.PicturesAboveProps & spot.flags || spotConsts.PicturesAboveNameTags & spot.flags)) {
				var size = 12;
				ctx.fillStyle = 'white';
				ctx.font = size+'px sans-serif';
				ctx.textBaseline = 'top';
				ctx.textAlign = 'center';
				var w = ctx.measureText(spot.name).width+4;
				this.roundRect(spot.x-(w/2)-2, spot.y-1, w+4, size+4, 4);
				ctx.fillStyle = 'black';
				ctx.fillText(spot.name, spot.x, spot.y);
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

			if (this.grabbedProp && this.grabbedProp.looseprop === lProp) {
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

	drawLimboProp() { /* when dragging a prop from self or another location */
		if (this.grabbedProp && !this.grabbedProp.looseprop) {
			var aProp = allProps[this.grabbedProp.id];
			if (aProp && aProp.isComplete) {
				if (aProp.ghost) this.context.globalAlpha = 0.5;
				this.context.globalAlpha = this.context.globalAlpha/2;
				this.context.drawImage(aProp.img,this.grabbedProp.mx,this.grabbedProp.my);
				this.context.globalAlpha = 1;
			}
		}
	}


	drawDraws(draw,foreground,ctx) {
		if (Boolean(drawType.PENFRONT & draw.type) === foreground) {

			ctx.lineWidth = draw.pensize;
			ctx.fillStyle = draw.fillcolor;
			ctx.strokeStyle = draw.pencolor;

			if (!Boolean(draw.type & drawType.TEXT) && !Boolean(draw.type & drawType.OVAL)) {
				if (draw.type & drawType.ERASER) ctx.globalCompositeOperation='destination-out'; //for potential eraser drawing tool!
				ctx.beginPath();
				ctx.moveTo(draw.points[0], draw.points[1]);

				for (var item = 2; item < draw.points.length-1; item += 2)
					ctx.lineTo(draw.points[item], draw.points[item+1]);

				if (drawType.SHAPE & draw.type) {
					ctx.closePath();
					ctx.fill();
				}
				ctx.stroke();
				if (draw.type & drawType.ERASER) this.context.globalCompositeOperation='source-over';
			}
		}
	}

	preDrawDrawing(ctx) {
		let l = this.drawPoints.length;
		if (l > 0) {
			ctx.lineWidth = prefs.draw.size;
			ctx.fillStyle = prefs.draw.fill;
			ctx.strokeStyle = prefs.draw.color;

			ctx.beginPath();

			let offset = (prefs.draw.type !== 1?Math.floor(prefs.draw.size/2):0);

			ctx.moveTo(this.drawPoints[0]+offset, this.drawPoints[1]+offset);

			for (let item = 2; item < l-1; item += 2) {
				ctx.lineTo(this.drawPoints[item]+offset, this.drawPoints[item+1]+offset);
			}

			if (prefs.draw.type === 2) {
				ctx.globalCompositeOperation='destination-out';
			} else if (prefs.draw.type === 1) {
				ctx.closePath();
				ctx.fill();
			}
			ctx.stroke();
			if (prefs.draw.type === 2) {
				ctx.globalCompositeOperation='source-over';
			}
		}
	}

}



class PalaceRoom extends Renderer {
	constructor(info) {
		super(palace.canvas,palace.canvas2);

		Object.assign(this, info); // copy info to the new instance

		super.canvas.onmousedown = (e) => {this.mouseDown(e)};
		super.canvas.onmousemove = (e) => {this.mouseMove(e)};
		super.canvas.onmouseup = (e) => {this.mouseUp(e)};
		super.canvas.onmouseleave = (e) => {this.mouseLeave(e)};
		super.canvas.ondrop = (e) => {this.drop(e)};
		super.canvas.ondragover = (e) => {this.dragOver(e)};

		this.mouseLooseProp = null;

		let mCanvas = document.createElement('canvas'); /* offscreen buffer for prop pixel detection */
		mCanvas.width = 220;
		mCanvas.height = 220;
		this.mCtx = mCanvas.getContext('2d');


		if (!info.authored) {
			Bubble.deleteAllBubbles();
		}

		document.getElementById('palaceroom').innerText = this.name;

		let media = palace.passUrl(this.background);

		if (media !== palace.lastLoadedBG) {	/* prevent reloading of background media when room is authored */
			palace.setRoomBG(super.canvas.width,super.canvas.height,'');
			palace.toggleLoadingBG(true);

			palace.currentBG = media; // prevent loading of the media later on, if it has changed before it completed downloading
			let ext = parseURL(media).pathname.split('.').pop();
			if (['jpg','jpeg','bmp','png','apng','gif','svg','webp','pdf','ico'].indexOf(ext) > -1) { // valid img file extension takes the cake
				palace.setBackGround(media);
			} else {
				httpHeadAsync(media,function(info) {
					// video content-type or valid video file extension
					if (info.indexOf('video') > -1 || ['mp4','ogg','webm','m4v'].indexOf(ext) > -1) {	/* eventually use http request as well, to determine resource type */
						palace.setBackGroundVideo(media);
					} else {
						palace.setBackGround(media); // fallback
					}
				});
			}


		}

		palace.removeSpotPicElements();

		this.pics = [];

		info.pictures.forEach((pict) => {
			let newImg = document.createElement('img');
			newImg.onload = () => {
				if (this === palace.theRoom) { // check because async...
					this.spots.forEach((spot) => {
						if (!spot.img) {
							spot.img = PalaceRoom.createSpotPicPlaceholder();
							palace.container.appendChild(spot.img);
						}
						this.setSpotImg(spot);
					});
				}
			};
			pict.img = newImg;
			this.pics[pict.id] = pict;
			newImg.src = palace.passUrl(pict.name);
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
			var dragpid = dragPropID;

			loadProps([dragpid],true,function() { //callback to drop the prop once it is loaded from the users bag
				var prop = allProps[dragpid];
				if (prop) {
					if (!overSelf) {
						palace.sendPropDrop(x-prop.w/2,y-prop.h/2,dragpid);
					} else {
						palace.addSelfProp(dragpid);
						palace.selfPropChange(); //normally the mouse up even for the canvas would handle this but we're now async?
					}
				}
			});
		}
	}

	setEnvCursor(name) {
		if (super.canvas.dataset.cursorName !== name) {
			super.canvas.style.cursor = name;
			super.canvas.dataset.cursorName = name;
		}

	}

	mouseMove(event) {
		if (palace.theRoom && palace.theUser) {
			var isDrawing = document.getElementById('drawcheckbox').checked;

			if (isDrawing) {
				switch(prefs.draw.type) {
					case 1: this.setEnvCursor('url(img/bucket.cur) 16 13,crosshair'); break;
					case 2: this.setEnvCursor('url(img/eraser.cur) 5 15,crosshair'); break;
					default: this.setEnvCursor('url(img/pen.cur) 1 14,crosshair');
				}
				return true;
			}

			var x = (event.layerX/viewScale).fastRound();
			var y = ((event.layerY+palace.zoomFactorY)/viewScale).fastRound();

			if (!this.grabbedProp) {

				if (!event.shiftKey) { /* shift toggles between user and props */
					var mUser = this.mouseOverUser(x,y);
					if (this.mouseHoverUser !== mUser) {
						if (mUser != null) {
							this.mouseEnterUser(mUser);
						} else {
							this.mouseExitUser();
						}
					}
				} else {
					this.mouseExitUser();
				}

				if (event.shiftKey) {
					var pid = this.mouseOverSelfProp(x,y);
					if (this.mouseSelfProp !== pid) {
						if (pid) {
							this.mouseEnterSelfProp(pid);
						} else {
							this.mouseExitSelfProp();
						}
					}
				} else {
					this.mouseExitSelfProp();
				}

				var lpIndex = this.mouseOverLooseProp(x,y);
				if (lpIndex != this.mouseLooseProp) {
					if (lpIndex !== undefined) {
						this.mouseEnterLooseProp(lpIndex);
					} else {
						this.mouseExitLooseProp();
					}
				}
			} else {
				this.mouseExitLooseProp();
				this.mouseExitSelfProp();

				if (palace.theUser.x-22 < x && palace.theUser.x+22 > x && palace.theUser.y-22 < y && palace.theUser.y+22 > y) {
					palace.addSelfProp(this.grabbedProp.id);
					this.grabbedProp.mx = -999; /* temp vanishing */
					this.grabbedProp.my = -999;
				} else {
					if (event.altKey === false && (palace.theUser.propsChanged === true || !this.grabbedProp.looseprop)) {
						palace.removeSelfProp(this.grabbedProp.id);
					}

					this.grabbedProp.mx = (x-this.grabbedProp.offsetX);
					this.grabbedProp.my = (y-this.grabbedProp.offsetY);
				}
				this.reDraw();
			}

			if (this.grabbedProp && event.altKey) {
				this.setEnvCursor('copy');
			} else if (this.mouseLooseProp !== null || this.mouseSelfProp || this.grabbedProp) {
				this.setEnvCursor('move');
			} else if (this.mouseHoverUser === palace.theUser && event.ctrlKey) {
				this.setEnvCursor('context-menu');
			} else {
				var spot = this.mouseInSpot(x,y);
				if ((this.mouseHoverUser && this.mouseHoverUser !== palace.theUser) || (spot && spot.type > 0)) {
					this.setEnvCursor('pointer');
				} else {
					this.setEnvCursor('default');
				}
			}
		}
	}

	mouseLeave(event) { // this wouldn't be nessacery if i used the windows mouse events
		var x = (event.layerX/viewScale).fastRound();
		var y = (event.layerY/viewScale).fastRound();
		this.mouseExitSelfProp();
		this.mouseExitLooseProp();
		this.mouseExitUser();
	}

	mouseUp(event) {
		if (this.grabbedProp) {
			let x = (event.layerX/viewScale).fastRound();
			let y = ((event.layerY+palace.zoomFactorY)/viewScale).fastRound();
			let overSelf = (palace.theUser && palace.theUser.x-22 < x && palace.theUser.x+22 > x && palace.theUser.y-22 < y && palace.theUser.y+22 > y);
			if (!this.grabbedProp.looseprop) {
				if (!overSelf) {
					palace.sendPropDrop(x - this.grabbedProp.offsetX,y - this.grabbedProp.offsetY, this.grabbedProp.id);
				} else {
					palace.addSelfProp(this.grabbedProp.id);
				}
			} else {
				if (!event.altKey) {
					let index = this.looseProps.indexOf(this.grabbedProp.looseprop);
					if (index > -1) {
						if (overSelf) {
							palace.sendPropDelete(index);
						} else {
							palace.sendPropMove(x - this.grabbedProp.offsetX,y - this.grabbedProp.offsetY, index);
						}
					}
				} else {
					if (!overSelf) {
						palace.sendPropDrop(x - this.grabbedProp.offsetX,y - this.grabbedProp.offsetY, this.grabbedProp.id);
					}
				}
			}
			this.reDraw();
		}
		this.grabbedProp = null;
		if (palace.theUser && palace.theUser.propsChanged === true) {
			palace.selfPropChange();
		}
	}

	clickSpotInfo(x,y) {
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
	}


	get noPainting() {
		return Boolean(this.flags & 0x0004);
	}

	mouseDown(event) {
		if (document.activeElement !== document.body) {
			document.activeElement.blur();
		}
		if (palace.theUser && event.button == 0) {
			event.preventDefault();
			let isDrawing = document.getElementById('drawcheckbox').checked;
			let x = (event.layerX/viewScale).fastRound();
			let y = ((event.layerY + palace.zoomFactorY) /viewScale).fastRound(); // get excess toolbar height if windows is scaling
			if (isDrawing) {
				if (!palace.allowPainting && !palace.isOperator) {
					logmsg('Painting is not allowed on this server.');
					return false;
				}
				if (this.noPainting && !palace.isOperator) {
					logmsg('Painting is not allowed in this room.');
					return false;
				}
				this.startDrawing(x,y);
			} else {


				let mUser = this.mouseOverUser(x,y);
				if (!event.shiftKey && mUser != palace.theUser && mUser) {
					this.enterWhisperMode(mUser.id,mUser.name);
				} else {
					let lpIndex = null;
					let pid;

					if (event.shiftKey) {
						pid = this.mouseOverSelfProp(x,y);
					}
					if (!pid) {
						lpIndex = this.mouseOverLooseProp(x,y);
					}

					if (pid) {
						let aProp = allProps[pid];
						this.makeDragProp(null, pid, x, y, x-aProp.x-palace.theUser.x+22, y-aProp.y-palace.theUser.y+22);
					} else if (lpIndex != null) {
						let lProp = this.looseProps[lpIndex];
						this.makeDragProp(lProp, lProp.id, x, y, x-lProp.x, y-lProp.y);
					} else if (!mUser || mUser == palace.theUser) { /* if not clicking another user */
						let areaInfo = this.clickSpotInfo(x,y);
						if (areaInfo.dontMove !== true) palace.setpos(x,y);
						if (areaInfo.spot) {
							let dest = areaInfo.spot.dest;
							switch(areaInfo.spot.type) {
								case spotConsts.types.passage:
									if (dest > 0) palace.gotoroom(dest);
									break;
								case spotConsts.types.shutable:
								case spotConsts.types.lockable:
									if (areaInfo.spot.state == 0) {
										palace.gotoroom(dest);
									} else {
										logmsg('Sorry the door is locked.');
									}
									break;
								case spotConsts.types.deadBolt:
									let d = this.getSpot(dest);
									if (d) {
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
		ph.className = 'spotholder';
		return ph;
	}


	startDrawing(x,y) {
		let offset = (prefs.draw.type !== 1?Math.floor(prefs.draw.size/2):0);
		this.drawPoints = [x-offset,y-offset];

		let drawing = (event) => {
			var newx = ((event.x+window.scrollX-palace.container.offsetLeft)/viewScale).fastRound()-offset;
			var newy = ((event.y+window.scrollY-palace.container.offsetTop)/viewScale).fastRound()-offset; //45 get new toolbar height if zooming
			if (event.shiftKey && drawPoints.length > 3) {
				this.drawPoints[this.drawPoints.length-2] = newx;
				this.drawPoints[this.drawPoints.length-1] = newy;
			} else {
				this.drawPoints.push(newx);
				this.drawPoints.push(newy);
			}
			prefs.draw.front?this.reDrawTop():this.reDraw();
		};

		let drawingEnd = () => {
			palace.sendDraw({
				type:prefs.draw.type,
				front:prefs.draw.front,
				color:getNbrs(prefs.draw.color),
				fill:getNbrs(prefs.draw.fill),
				size:prefs.draw.size,
				points:this.drawPoints
			});
			window.removeEventListener('mousemove',drawing);
			window.removeEventListener('mouseup',drawingEnd);
			this.drawPoints = [];
		}

		window.addEventListener('mousemove',drawing);
		window.addEventListener('mouseup',drawingEnd);

	}

	draw(draw) { //redo this
		if (drawType.CLEAN & draw.type) {
			this.draws = [];
			this.reDraw();
			this.reDrawTop();
		} else if (drawType.UNDO & draw.type) {
			let d = this.draws.pop();
			if (d) {
				if (d.type & drawType.PENFRONT) {
					this.reDrawTop();
				} else {
					this.reDraw();
				}
			}
		} else {
			this.draws.push(draw);
			if (draw.type & drawType.PENFRONT) {
				this.reDrawTop();
			} else {
				this.reDraw();
			}
		}

	}

	setSpotImg(spot) {
		let statepic = spot.statepics[spot.state];
		if (statepic && this.pics[statepic.id]) {
			let img = this.pics[statepic.id].img;
			if (img.naturalWidth > 0) {
				let left = spot.x+statepic.x-Math.trunc(img.naturalWidth/2)+'px';
				let top = spot.y+statepic.y-Math.trunc(img.naturalHeight/2)+'px';
				if (spot.img.src !== img.src) {
					img = img.cloneNode(false);
					img.style.left = left;
					img.style.top = top;
					img.className = 'spotpic';
					if (Boolean(spotConsts.PicturesAboveAll & spot.flags || spotConsts.PicturesAboveProps & spot.flags || spotConsts.PicturesAboveNameTags & spot.flags)) {
						img.className += ' ontop';
					}
					palace.container.replaceChild(img,spot.img); // was an error with this, not sure if it is fixed
					spot.img = img;
				} else {
					spot.img.style.left = left;
					spot.img.style.top = top;
				}
			}
		} else if (spot.img && spot.img.className !== 'spotholder') { /* spot is not displaying a pic so put in placeholder */
			let img = PalaceRoom.createSpotPicPlaceholder();
			palace.container.replaceChild(img,spot.img);
			spot.img = img;
		}
	}

	spotStateChange(info) {
		let spot = this.getSpot(info.spotid);
		if (this.id === info.roomid && spot) {
			spot.state = info.state;
			this.setSpotImg(spot);
			if (info.lock === false) {
				if (!prefs.general.disableSounds) {
					palace.sounds.dooropen.play();
				}
			} else if (info.lock === true) {
				if (!prefs.general.disableSounds) {
					palace.sounds.doorclose.play();
				}
			}
		}
	}

	spotMove(info) {
		var spot = this.getSpot(info.spotid);
		if (this.id === info.roomid && spot) {
			spot.x = info.x;
			spot.y = info.y;
			this.setSpotImg(spot);
			this.reDraw();
		}
	}

	spotMovePic(info) {
		var spot = this.getSpot(info.spotid);
		if (this.id === info.roomid && spot && spot.statepics[spot.state]) {
			spot.statepics[spot.state].x = info.x;
			spot.statepics[spot.state].y = info.y;
			this.setSpotImg(spot);
		}
	}

	getSpot(id) {
		return this.spots.find(function(spot){return id === spot.id;});
	}


	loosePropAdd(data) {
		this.looseProps.unshift(data);

		if (this.mouseLooseProp !== null) this.mouseLooseProp++;

		loadProps([data.id]);
		this.reDraw();
	}

	loosePropMove(info) {
		if (info.index >= 0 && this.looseProps.length > info.index) {
			var lp = this.looseProps[info.index];
			if (lp && (lp.x !== info.x || lp.y !== info.y)) {
				lp.x = info.x;
				lp.y = info.y;
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
					if (index === idx) {
						return null;
					} else if (index < idx) {
						return --idx;
					}
					return idx;
				}
			};

			if (this.mouseLooseProp !== null) this.mouseLooseProp = adjustIndex(this.mouseLooseProp);

			change = true
			this.looseProps.splice(index,1);
		}
		if (change) this.reDraw();
	}



	removeUser(info) {
		var user = this.getUser(info.id);
		if (user) {
			if (user === palace.theUser) {
				user.remove();
			} else {
				logmsg(user.name+' has '+(info.logoff?'signed off.':'left the room.'));
				user.shrink(10);
			}

			return true;
		}
	}



	addUser(info) {
		var dude = new PalaceUser(info,true);
		var loggedOn = (palace.lastUserLogOnID === dude.id && PalaceClient.ticks()-palace.lastUserLogOnTime < 900);
		if (loggedOn) { // if under 15 seconds
			palace.lastUserLogOnID = 0;
			palace.lastUserLogOnTime = 0;
			if (!prefs.general.disableSounds) palace.sounds.signon.play();
		}
		if (palace.theUserID === dude.id && palace.theUser !== dude) {
			setUserInterfaceAvailability(false);
			palace.theUser = dude;
		}

		if (dude !== palace.theUser) {
			logmsg(dude.name+' has '+(loggedOn?'signed on.':'entered the room.'));
		}

		this.users.push(dude);

		loadProps(dude.props);
		dude.grow();
		this.setUserCount();
	}

	getUser(uid) {
		return this.users.find(function(user){return uid == user.id;});
	}

	loadUsers(infos) {
		var dudes = [];
		infos.forEach(function(info){dudes.push(new PalaceUser(info))});

		this.users = dudes;

		var pids = [];
		dudes.forEach(function(dude){pids = dude.props.concat(pids)});
		this.looseProps.find(function(prop){pids.push(prop.id)});

		loadProps(dedup(pids));

		this.setUserCount();

		super.refresh();
	}


	userColorChange(info) {
		var user = this.getUser(info.id);
		if (user && user.color !== info.color) {
			user.color = info.color;
			user.setColor();
			this.reDraw();
			return true;
		}
	}
	userFaceChange(info) {
		var user = this.getUser(info.id);
		if (user && user.face !== info.face) {
			user.face = info.face;
			user.setFace();
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
			user.setColor();
			user.changeUserProps(info.props);
			this.reDraw();
		}
	}
	userNameChange(info) {
		var user = this.getUser(info.id);
		if (user && user.name !== info.name) {
			user.name = info.name;
			user.setName();
			user.setColor();
			this.reDraw();
		}
	}
	userMove(info) {
		var user = this.getUser(info.id);
		if (user && (user.x !== info.x || user.y !== info.y)) {
			user.popBubbles();
			user.x = info.x;
			user.y = info.y;
			user.setAvatarLocation();
			//this.reDraw();
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
			if (!document.hasFocus() && !prefs.general.disableSounds) palace.sounds.whisper.play();
		}
		chatspan.appendChild(namespan);
		chatspan.appendChild(makeHyperLinks(chat.chatstr,chatspan));

		logAppend(chatspan);
	}

	setUserCount() {
		document.getElementById('palaceroom').title = this.users.length + ' / ' + palace.serverUserCount;
	}



	enterWhisperMode(userid,name) {
		var cancel = (this.whisperUserID === userid);
		if (this.whisperUserID || cancel) {
			this.exitWhisperMode(); /* whisper toggle */
		}
		if (!cancel) {
			document.getElementById('chatbox').placeholder = 'Whisper to ' + name;
			this.whisperUserID = userid;
			var user = this.getUser(userid);
			this.users.forEach((u) => {
				if (u !== user && palace.theUser !== u) {
					u.putFilters(['blur(1px)','opacity(75%)']);
				}
			});

			if (user) {

				user.poke();
			}
		}
	}

	exitWhisperMode() {
		document.getElementById('chatbox').placeholder = 'Chat...';
		var user = this.getUser(this.whisperUserID);
		if (user) {
			this.users.forEach((u) => {
				if (u !== user && palace.theUser !== u) {
					u.removeFilters(['blur','opacity']);
				}
				if (u !== this.mouseHoverUser) {
					u.removeFilters(['brightness','drop-shadow']);
				}
			});
			user.poke();
		}
		this.whisperUserID = null;
	}

	makeDragProp(lp,pid,x,y,x2,y2) {
		this.grabbedProp = {looseprop:lp,id:pid,offsetX:x2,offsetY:y2,mx:x-x2,my:y-y2};
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
			if (user.x+22 > x && user.x-22 < x && user.y+22 > y && user.y-22 < y) {
				return user;
			}
		}
	}

	mouseOverSelfProp(x,y) {
		if (!this.grabbedProp) {
			for (var i = palace.theUser.props.length; --i >= 0;) {
				var aProp = allProps[palace.theUser.props[i]];
				var px = (palace.theUser.x + aProp.x)-22;
				var py = (palace.theUser.y + aProp.y)-22;
				if (aProp && (!aProp.animated || palace.theUser.animatePropID === undefined || palace.theUser.animatePropID == aProp.id) && aProp.isComplete && px < x && (px+aProp.w) > x && py < y && (py+aProp.h) > y) {
					if (this.mouseOverProp(aProp,x,y,px,py)) {
						return aProp.id; /* maybe pass object instead of id */
					}
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
					if (this.mouseOverProp(aProp,x,y,lProp.x,lProp.y)) {
						return i; /* maybe pass object instead of index */
					}
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
		if (user !== palace.theUser) {
			user.putFilters(['brightness(112%)','drop-shadow(0px 0px 4px PaleGreen)']);
		}
		this.mouseHoverUser = user;
	}

	mouseExitUser() {
		if (this.mouseHoverUser) {
			var target = this.mouseHoverUser;
			if (this.whisperUserID !== this.mouseHoverUser.id && target !== palace.theUser) {
				target.removeFilters(['brightness','drop-shadow']);
			}
			this.mouseHoverUser = null;
		}
	}


	mouseEnterLooseProp(lpIndex) {
		if (!this.mouseHoverUser && !this.mouseSelfProp) {
			this.mouseExitLooseProp();
			this.mouseLooseProp = lpIndex;
			this.looseProps[this.mouseLooseProp].light = 1;
			this.reDraw();
		}
	}

	mouseExitLooseProp() {
		if (this.mouseLooseProp !== null) {
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
		if (!this.mouseHoverUser) {
			this.mouseExitSelfProp();
			this.mouseSelfProp = pid;
			palace.theUser.findDomProp(pid).div.style.filter = 'drop-shadow(0px 0px 2px LawnGreen)';
		}
	}
	mouseExitSelfProp() {
		if (this.mouseSelfProp) {
			palace.theUser.findDomProp(this.mouseSelfProp).div.style.filter = '';
			this.mouseSelfProp = null;
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
			for (var j = 0; j < this.users[i].props.length; j++) {
				if (this.users[i].props[j] == id) {
					return true;
				}
			}
		for (var o = 0; o < this.looseProps.length; o++) {
			if (this.looseProps[o].id == id) {
				return true;
			}
		}
		return false;
	}

	navigationError(type) {
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
