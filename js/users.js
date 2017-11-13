var userNameTagHeight = getTextHeight('bold 18px sans-serif')+2;

class PalaceUser {
	constructor(info) {
		Object.assign(this, info); // copy info to the new instance
		this.scale = 1;
		this.preRenderNametag();
	}

	poke() { // when you click a user (might use for something else later) pressure variable might be an idea!
		var target = this;
		this.scale = 1.05;
		palace.theRoom.reDraw();
		var pokeTimer = setInterval(function() {
			target.scale -= 0.01;
			if (target.scale < 1) {
				target.scale = 1;
				clearInterval(pokeTimer);
			}
			palace.theRoom.reDraw();
		},20);
	}

	grow(from) {
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
			palace.theRoom.reDraw();
		},20);
	}

	shrink(to) {
		var target = this;
		target.id = -1; // marks user as exited and going to be removed from the room.
		var timer = setInterval(function(){
			if (target.scale < to) target.scale += (target.scale/8);
			if (target.scale >= to) {
				clearInterval(timer);
				target.remove();
			}
			palace.theRoom.reDraw();
		},20);
	}

	remove() {
		if (this.stopAnimation) this.stopAnimation();
		this.popBubbles();
		palace.theRoom.users.splice(palace.theRoom.users.indexOf(this),1);
		palace.theRoom.setUserCount();
		palace.theRoom.reDraw();
	}

	preRenderNametag() {
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

		var grd = ctx.createLinearGradient(0, 5, 0, userNameTagHeight-5);
		grd.addColorStop(0, getHsl(this.color,78));
		grd.addColorStop(1, getHsl(this.color,60));
		ctx.fillStyle = grd;
		ctx.fillText(this.name, 2, 0);
		ctx.shadowOffsetY = 1;
		ctx.fillText(this.name, 2, 0);
	}


	nametagLoc() { // need to reduce size of this function!
		var w = this.nametag.width;
		var h = this.nametag.height;
		var half = (w/2);
		var x = this.x*this.scale;
		var y = (this.y+2)*this.scale;
		var bgw = bgEnv.width*this.scale;
		var bgh = bgEnv.height*this.scale;

		if (x-half < 0) x = half;
		if (x > bgw-half) x = bgw-half;

		if (this.scale != 1) {
			x = x-half;
			y = y+(h/2-2);
		} else {
			x = (x-half).fastRound();
			y = (y+(h/2-2)).fastRound();
		}

		if (y < 0) y = 0;
		if (y > bgh-(h-3)) y = bgh-(h-3);

		return {x:x,y:y,w:w,h:h};
	}

	nextFrame() { // if wearing animated props
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
		palace.theRoom.reDraw();
	}


	animator() {
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
	}

	stopAnimation() {
		if (this.animateTimer) {
			clearInterval(this.animateTimer);
			delete this.animateTimer;
		}
		delete this.animatePropID;
		delete this.animationPropIDs;
		delete this.reverseAnimation;
	}

	popBubbles() {
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
	}

	changeUserProps(props,fromSelf) { // this function compares prop arrays to check for actual changes before sending out protocol or requesting a prop load,, i may have overdone it..
		var wasChange = (this.props.length != props.length);
		var i = 0;
		var significantChange;
		props.find(function(pid) {
			if (this.props.indexOf(pid) < 0) significantChange = true;
			if (!wasChange && this.props[i] != pid) wasChange = true;
			i++;
		},this);
		this.props = props;
		if (significantChange) loadProps(this.props,fromSelf);
		if (wasChange) {
			if (this == palace.theUser) {
				enablePropButtons();
			}
			this.animator();
			palace.theRoom.reDraw();
			return true;
		}
	}



}
