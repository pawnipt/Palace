// @flow

var chatBubs = [];
var quedBubbles = [];

class Bubble {
	constructor(user,chat,bubInfo) {
		var x = 0;
		var y = 0;

		if (user) {
			if (user.sticky) {
				user.sticky.remove(true);
				user.sticky = null;
				palace.theRoom.reDraw();
			}
			x = user.x;
			y = user.y;
		} else if (palace.theRoom.sticky) {
			palace.theRoom.sticky.remove(true);
			palace.theRoom.sticky = null;
			palace.theRoom.reDraw();
		}

		if (bubInfo.x !== undefined) {
			x = bubInfo.x;
			y = bubInfo.y;
		}

		this.p = document.createElement('div');
		this.p.className = 'chatBubble';
		if (chat.whisper) this.p.style.fontStyle = 'italic';

		this.p.textContent = chat.chatstr.substring(bubInfo.start);
		this.p.style.top = '-9999px'; /* hide html element for now */

		this.user = user;

		if (user) this.color = user.color;
		this.size = 0.5;
		this.sticky = Boolean(bubInfo.type & 1);
		this.thought = Boolean(bubInfo.type & 2);
		this.shout = Boolean(bubInfo.type & 4);
		this.storedOriginX = x;
		this.storedOriginY = y;
		this.adjustOrigin();
		this.padA = bubbleConsts.padding;
		this.padB = bubbleConsts.padding*2;
		if (this.shout) { /* needs more space */
			this.padA += bubbleConsts.padding*2;
			this.padB += bubbleConsts.padding*4;
		}
		this.p.style.maxHeight = (palace.roomHeight - this.padB*2+this.padA)+'px';
		if (palace.roomWidth < 550) {
			this.p.style.maxWidth = Math.max(50,Math.trunc(palace.roomWidth/3.5)) + 'px';
		}
		palace.container.appendChild(this.p); /* append to DOM before measurements are possible */
		this.textWidth = this.p.offsetWidth;
		this.textHeight = this.p.offsetHeight;
		if (this.isOverflown) {
			this.p.style.pointerEvents = 'auto';
		}
		if (this.textHeight < this.padB && !this.shout) this.textHeight = this.padB;

		if (!this.awaitDirection()) {
			this.show();
		} else {
			quedBubbles.push(this);
		}
	}
	get isOverflown() {
    	return this.p.scrollHeight > this.p.clientHeight || this.p.scrollWidth > this.p.clientWidth;
	}
	adjustOrigin() {
		this.originX = this.storedOriginX;
		this.originY = this.storedOriginY;
		if (this.originX < 0) this.originX = 0;
		if (this.originY < 0) this.originY = 0;
		if (this.originX > palace.roomWidth) this.originX = palace.roomWidth;
		if (this.originY > palace.roomHeight) this.originY = palace.roomHeight;
	}
	remove(now) {
		if (now) {
			var index = chatBubs.indexOf(this);
			if (this.timer) clearInterval(this.timer);
			this.timer = null;
			if (this.popTimer) clearTimeout(this.popTimer);
			this.popTimer = null;
			this.user = null;
			if (index > -1) {
				palace.container.removeChild(this.p);
				chatBubs.splice(index,1);
			}
		} else {
			this.deflate(true);
		}
		Bubble.pushBubbles();
	}
	show() {
		if (this.sticky && this.user) this.user.sticky = this;
		if (this.sticky && !this.user) palace.theRoom.sticky = this;

		chatBubs.push(this);

		this.inflate();

		if (!this.sticky) {
			var speed = this.p.textContent.length * 130;
			if (speed < 3540) {
				speed = 3540;
			} else if (speed > 12000) {
				speed = 12000;
			}
			this.popTimer = setTimeout(() =>{this.remove(false)}, speed); //is bub=null; required?
		}
		palace.theRoom.reDraw();
	}
	inflate() {
		this.deflated = false;
		if (this.timer) clearInterval(this.timer);
		this.timer = setInterval(() => {
			if (this.size < 1) {
				this.size += 0.08;
			} else {
				this.size = 1;
				if (this.timer) {
					clearInterval(this.timer);
					this.timer = null;
				}
				this.p.style.left = this.x+'px';
				this.p.style.top = this.y+'px';
			}
			palace.theRoom.reDraw();
		},20);
	}
	deflate(remove) {
		this.p.style.top = '-9999px';
		this.deflated = true;
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
		this.timer = setInterval(() => {
			if (this.size > 0.6) {
				this.size -= 0.1;
			} else {
				this.size = 0.5;
				if (this.timer) {
					clearInterval(this.timer);
					this.timer = null;
				}
				if (remove) this.remove(true);
			}

			palace.theRoom.reDraw();
		},20);
	}
	makeShoutBubble(ctx) {
		var w = this.textWidth*this.size;
		var h = this.textHeight*this.size;
		var centerX = (this.x + (this.textWidth/2));
		var centerY = (this.y + (this.textHeight/2));
		var radiusW = (w/1.45)+bubbleConsts.padding;
		var radiusH = (h/1.45)+bubbleConsts.padding;
		var circum = radiusW * radiusH * Math.PI;
		var inter = circum/(circum/(bubbleConsts.spikeSize+Math.round((radiusW+radiusH)/bubbleConsts.spikeSpread)));

		var pie = Math.PI/inter;

		ctx.beginPath();
		ctx.moveTo(centerX + radiusW * Math.cos(pie), centerY + radiusH * Math.sin(pie));

		var angle = 0;
		for (var n = 0; n < inter; n++) {
			pie = Math.PI/inter;

			angle += pie;
			ctx.lineTo(centerX + radiusW * Math.cos(angle), centerY + radiusH * Math.sin(angle));

			angle += pie;
			var r1 = 16;
			var r2 = 16;
			if (this.size < 1) {
				r1 = (r1+4)*Math.random();
				r2 = (r1+4)*Math.random();
			}

			ctx.lineTo(centerX + (radiusW+5+r1) * Math.cos(angle), centerY + (radiusH+5+r2) * Math.sin(angle));
		}
		ctx.closePath();
	}
	makeRegularBubble(ctx) {
		let radius = (14*this.size);
		if (radius < 10) radius = 10;
		let x = this.x - bubbleConsts.padding;
		let y = this.y - bubbleConsts.padding;
		let width = this.textWidth + (bubbleConsts.padding*2);
		let height = this.textHeight + (bubbleConsts.padding*2);
		let ux = this.originX;
		let uy = this.originY;
		let dist = 23;
		let space = 4;



		let w = width;
		if (this.right) {
			width = width*this.size;
			x = x + w/4 - (width*this.size)/4;
		} else {
			width = width*this.size;
			x = x + w/3 - (width*this.size)/3;
		}

		let h = height;
		height = height*this.size;
		y = y + h/3 - (height*this.size)/3;

		ctx.beginPath();
		ctx.moveTo(x + radius, y);
		ctx.lineTo(x + width - radius, y);
		ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
		if (!this.right && !this.sticky) {
			let neck = uy;
			if (y + radius > neck) neck = y + radius;
			if (y + height - radius < neck) neck = y + height - radius;
			dist = dist/this.size;
			if (dist > 35) dist = 35;
			ctx.lineTo(x + width, neck - space);
			ctx.lineTo(ux - dist, uy);
			ctx.lineTo(x + width, neck + space);
		}
		ctx.lineTo(x + width, y + height - radius);
		ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
		ctx.lineTo(x + radius, y + height);
		ctx.quadraticCurveTo(x, y + height, x , y + height - radius);
		if (this.right && !this.sticky) {
			let neck = uy;

			if (y + height - radius < neck) neck = y + height - radius;
			if (y + radius > neck) neck = y + radius;
			dist = dist/this.size;
			if (dist > 35) dist = 35;
			ctx.lineTo(x, neck + space);
			ctx.lineTo(ux + dist, uy);
			ctx.lineTo(x, neck - space);
		}
		ctx.lineTo(x, y + radius );
		ctx.quadraticCurveTo(x, y, x + radius, y);
		ctx.closePath();
	}
	avoidOthers() {
		var submissives = [];
		var x1 = this.x-this.padA;
		var y1 = this.y-this.padA;
		var w1 = this.textWidth+this.padB;
		var h1 = this.textHeight+this.padB;

		//for (var i = chatBubs.length; --i >= 0;) {
		var bub = this;
		if (chatBubs.find(function(boob) {
			if (bub != boob) {
				var x2 = boob.x-boob.padA;
				var y2 = boob.y-boob.padA;
				var w2 = boob.textWidth+boob.padB;
				var h2 = boob.textHeight+boob.padB;
				var overLaps = (x1>=x2+w2 || x1+w1<=x2 || y1>=y2+h2 || y1+h1<=y2)===false;
				if (((bub.sticky && boob.sticky) || (!boob.deflated && !boob.sticky)) && overLaps)
					return true;
				if (!bub.sticky && boob.sticky && overLaps)
					submissives.push(boob);
			}
		})) return true;

		if ((x1 < 0 || y1 < 0 || x1+w1 > palace.roomWidth || y1+h1 > palace.roomHeight)) {// is bubble offscreen

			return true;
		}

		submissives.forEach(function(sub){sub.deflate(false)});
	}

	awaitDirection() {
		var side = (palace.roomWidth/2 < this.originX);
		var offsetOrigin = 42;
		if (this.sticky) offsetOrigin = -this.textWidth/2;
		var iterations = 0;

		do {
			if (iterations > 1) return true; /* bub must wait */

			iterations++;

			var x = this.originX;
			var y = this.originY;

			if (side || this.sticky) {
				x -= this.textWidth + offsetOrigin;
				this.right = false;
			} else {
				x += offsetOrigin;
				this.right = true;
			}
			y -= this.textHeight/2;

			if (y+this.textHeight+this.padB > palace.roomHeight)
				y = palace.roomHeight-(this.textHeight+this.padB);
			if (y-this.padA < 0)
				y = this.padA;

			if (x+this.textWidth+this.padB > palace.roomWidth && (this.right === false || this.sticky || this.shout))
				x = palace.roomWidth-(this.textWidth+this.padB);
			if (x-this.padA < 0 && (this.right === true || this.sticky || this.shout))
				x = this.padA;

			this.x = x;
			this.y = y;

			side = !side;
		} while (this.avoidOthers());

		return false; /* okay to display bub */
	}





	static processChatType(chatstr) {
		var i, r, end;
		var bubInfo = {start:0,type:0};
		var chatLen = chatstr.length;
		for (i = 0; i < chatLen; i++) {
			switch(chatstr.charAt(i)) {
				case '!':
					bubInfo.type |= 4;
					break;
				case ':':
					bubInfo.type |= 2;
					break;
				case '^':
					bubInfo.type |= 1;
					break;
				case ')':
					r = bubbleConsts.sound.exec(chatstr.substr(i+1));
					if (r && r[1].length > 0) {
						palace.playSound(r[1]);
						i += r[0].length;
					}
					break;
				case '@':
					r = bubbleConsts.spoof.exec(chatstr);
					if (r) {
						bubInfo.x = Number(r[1]);
						bubInfo.y = Number(r[2]);
						i += r[0].length;
					}
					break;
				case ';':
					bubInfo.type = -1;
					bubInfo.start = i;
					return bubInfo;
				default:
					end = true;
			}
			if (end) break;
		}
		bubInfo.start = i;
		return bubInfo;
	}

	static deleteAllBubbles() {
		var i = 0;
		for (i = quedBubbles.length; --i >= 0;) {
			palace.container.removeChild(quedBubbles[i].p);
		}
		quedBubbles = [];
		for (i = chatBubs.length; --i >= 0;) {
			chatBubs[i].remove(true);
		}

		if (palace.theRoom && palace.theRoom.sticky) {
			palace.theRoom.sticky.remove(true);
			palace.theRoom.sticky = null;
		}
	}

	static pushBubbles() {
		for (let i = 0; i < quedBubbles.length; i++) {
			let bub = quedBubbles[i];
			if (!bub.awaitDirection()) {
				quedBubbles.splice(i,1);
				bub.show();
				i--;
			}
		}
		for (let i = chatBubs.length; --i >= 0;) {
			let bub = chatBubs[i];
			if (bub.sticky && bub.deflated && !bub.awaitDirection()) {
				bub.inflate();
			}
		}
	}

	static resetDisplayedBubbles() {
		for (var i = 0; i < chatBubs.length; i++) {
			var bub = chatBubs[i];
			bub.adjustOrigin();
			bub.awaitDirection();
			if (bub.p.style.top != '-9999px') {
				bub.p.style.left = bub.x+'px';
				bub.p.style.top = bub.y+'px';
			}
		}
		Bubble.pushBubbles();
	}
}
