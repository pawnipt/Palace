// @flow

var avPropHolder = document.createElement('div');
avPropHolder.className = 'avpropholder'; // placeholder for user props to optimize

class PalaceUser {
	constructor(info,entered) {
		Object.assign(this, info); // copy info to the new instance

		this.cssFilters = {};
		this.cssTransforms = {};

		this.domProp = [];
		this.domAvatar = document.createElement('div');
		this.style = this.domAvatar.style;
		this.domNametag = document.createElement('div');

		this.setAvatarLocation();
		if (entered) {
			this.shrink();

		}

		this.setColor();
		this.domAvatar.className = 'avatar';
		this.domNametag.className = 'avnametag';
		this.domNametag.innerText = this.name;

		this.domAvatar.appendChild(this.domNametag);
		this.setDomProps();
		palace.container.appendChild(this.domAvatar);
		this.domAvatar.offsetWidth; // hack to force update css changes

		this.nameWidth = this.domNametag.offsetWidth;
		this.nameHeight = this.domNametag.offsetHeight;

	}

	putFilters(filters) {
		for (let i = 0; i < filters.length; i++) {
			this.cssFilters[filters[i].match(/^[^\(]+/)] = filters[i];
		}
		this.applyFilters();
	}

	removeFilters(names) {
		for (let i = 0; i < names.length; i++) {
			delete this.cssFilters[names[i]];
		}
		this.applyFilters();
	}

	applyFilters() {
		let filters = '';
		for (let name in this.cssFilters) {
			filters += this.cssFilters[name]+' ';
 		}
		this.style.filter = filters;
	}

	putTransforms(transforms) {
		for (let i = 0; i < transforms.length; i++) {
			this.cssTransforms[transforms[i].match(/^[^\(]+/)] = transforms[i];
		}
		this.applyTransforms();
	}

	removeTransforms(names) {
		for (let i = 0; i < names.length; i++) {
			delete this.cssTransforms[names[i]];
		}
		this.applyTransforms();
	}

	applyTransforms() {
		let transforms = '';
		for (let name in this.cssTransforms) {
			transforms += this.cssTransforms[name]+' ';
 		}
		this.style.transform = transforms;
	}

	setDomProps(dlPid) {

		if (this.animateTimer) {
			clearInterval(this.animateTimer);
			this.animateTimer = null;
		}

		for (let i = this.props.length; i < 9; i++) {
			let d = this.domProp[i];
			if (d) {
				this.domProp[i] = null;
				this.domAvatar.removeChild(d.div);
			}
		}

		let animatedProps = [];
		for (let i = 0; i < this.props.length; i++) {
			let d = this.domProp[i];
			let pid = this.props[i];
			let wrongProp = (d && (!d.prop || d.prop.id !== pid));
			if (wrongProp || !d) {
				let prop = allProps[pid];
				if (prop && prop.img && prop.img.src) {
					if (d) d = d.div; // if dom prop is a placeholder or another prop
					let dd = this.createDomProp(i,prop,dlPid,d); //now recycles div elements
					if (prop.animated) {
						animatedProps.push(dd);
					}
					if (!d) { // if domProp was empty, and a prop was found
						this.domAvatar.appendChild(dd.div);
					}
					if (dlPid === prop.id) {
						dd.div.offsetWidth; //hack to force it to render so that opacity will transition
						dd.div.style.opacity = '1';
					}
				} else if (wrongProp && d.prop) { // replace wrong prop with placeholder since new one isn't yet available
					this.propPlaceHolder(i,d.div);
				} else if (!d) { // append placeholder if empty
					this.propPlaceHolder(i);
				}
			} else if (d.prop.animated) {
				animatedProps.push(d);
			} else {
				this.setDomPropVisibility(d,true);
			}
		}

		let head = this.hasHead; // if wearing a head prop don't render smiley
		if (head && !this.head) {
			this.head = head;
			this.style.backgroundImage = '';
		} else if (!head && this.head) {
			this.head = head;
			this.setFace(this.face);
		}


		if (animatedProps.length > 1) {
			this.animate(animatedProps);
		}

	}

	propPlaceHolder(i,div) {
		let ph = avPropHolder.cloneNode(false);
		this.domProp[i] = {div:ph, visible:false};
		if (div) {
			this.domAvatar.replaceChild(ph,div);
		} else {
			this.domAvatar.appendChild(ph);
		}
	}

	createDomProp(i,prop,dlPid,div) {
		let im = div && div.constructor === HTMLDivElement?div:document.createElement('div');
		if (dlPid === prop.id) im.style.opacity = '0';
		im.style.width = prop.w+'px';
		im.style.height = prop.h+'px';
		im.style.backgroundImage = 'url('+prop.img.src+')';
		im.style.transform = 'translate('+prop.x+'px,'+prop.y+'px)';
		im.className = 'avprop';
		var d = {div:im, prop:prop, visible:true};
		this.domProp[i] = d;
		return d;
	}

	get hasHead() {
		for (let i = 0; i < this.domProp.length; i++) {
			let d = this.domProp[i];
			if (d && d.prop && d.prop.head) {
				return true;
			}
		}
	}

	animate(animatedProps) {
		let bounce = false;
		animatedProps.forEach((d,i) => {
			if (d.prop.bounce) bounce = true;
			if (i !== 0) this.setDomPropVisibility(d,false);
		});
		let index = 0, last, forward = true, animator = () => {
			if (last) this.setDomPropVisibility(last,false);
			last = animatedProps[index];
			this.setDomPropVisibility(last,true);
			if (index === animatedProps.length-1) {
				bounce?forward = false:index = -1;
			} else if (index === 0) {
				forward = true;
			}
			forward?index++:index--;
		};
		this.animateTimer = setInterval(animator,350);
		animator();
	}

	setDomPropVisibility(d,visible) {
		if (visible && !d.visible) {
			d.div.style.visibility = 'visible';
		} else if (!visible && d.visible) {
			d.div.style.visibility = 'hidden';
		}
		d.visible = visible;
	}

	findDomProp(pid) {
		return this.domProp.find((d) => {
			return d.constructor === Object && d.prop.id === pid;
		});
	}

	changeUserProps(props,fromSelf) {

		let same = (this.props.length === props.length &&
			this.props.every( (v,i) => { return v === props[i] }));

		this.props = props;

		if (!same) {
			loadProps(this.props,fromSelf);
			if (this === palace.theUser) {
				enablePropButtons();
			}
			this.setDomProps();
			return true;
		}
	}



	setAvatarLocation() {
		this.putTransforms(['translate('+(this.x-110)+'px,'+(this.y-110)+'px)']);
		let bounds = this.nameRectBounds;
		this.domNametag.style.transform = 'translate('+bounds.x+'px, '+bounds.y+'px)';
	}

	setColor() {
		this.domNametag.style.color = getHsl(this.color,60);
		if (!this.head) this.style.backgroundImage = 'url('+smileys[this.face+','+this.color].src+')';
	}

	setFace() {
		if (!this.head) this.style.backgroundImage = 'url('+smileys[this.face+','+this.color].src+')';
	}

	poke() {
		let end = () => {
			this.style.transitionDuration = '0.2s, 0.15s, 0.3s';
			this.domAvatar.offsetWidth; // hack to force update css changes
			this.removeTransforms(['scale','scale3d']);
			this.domAvatar.removeEventListener('transitionend',end);
		}

		this.style.transitionDuration = '0.01s, 0.15s, 0.3s';
		this.domAvatar.offsetWidth; // hack to force update css changes
		this.putTransforms(['scale(0.95)','scale3d(1.1, 1, 1)']);


		this.domAvatar.addEventListener('transitionend',end);
	}

	grow() {
		this.removeTransforms(['scale']);
	}

	shrink(exit) {
		this.putTransforms(['scale(0.001)']);
		if (exit) {
			this.id = -1;// marks user as exited and going to be removed from the room.
			this.domAvatar.addEventListener('transitionend',() => {
				this.remove();
			});
		}
	}

	setName() {
		this.domNametag.innerText = this.name;
		this.nameWidth = this.domNametag.offsetWidth;
		this.nameHeight = this.domNametag.offsetHeight;
	}

	removeFromDom() {
		if (this.animateTimer) {
			clearInterval(this.animateTimer);
		}
		palace.container.removeChild(this.domAvatar);
	}

	remove() {
		this.popBubbles();
		this.removeFromDom();
		palace.theRoom.users.splice(palace.theRoom.users.indexOf(this),1);
		palace.theRoom.setUserCount();
		palace.theRoom.reDraw();
	}


	get nameRectBounds() {
		var w = this.nameWidth;
		var h = this.nameHeight;
		var halfW = (w/2);
		var halfH = (h/2);
		var x = this.x;
		var y = this.y;
		var bgw = palace.roomWidth;
		var bgh = palace.roomHeight;

		if (x-halfW < 0) x = halfW;
		if (x > bgw-halfW) x = bgw-halfW;

		x = Math.round(x-halfW);
		y = Math.round(y+(h/2));

		if (y < 0) y = 0;
		if (y > bgh-h) y = bgh-h;

		return {x:(x-this.x+halfW),y:(y-this.y-halfH)};
	}

	popBubbles() {
		var i = chatBubs.length;
		for (var a = quedBubbles.length; --a >= 0;) {
			var bub = quedBubbles[a];
			if (this === bub.user) {
				bub.user = null;
				palace.container.removeChild(bub.p);
				quedBubbles.splice(a,1);
			}
		}
		for (let c = i; --c >= 0;) {
			var bub = chatBubs[c];
			if (this === bub.user) {
				bub.remove(true);
			}
		}
		if (i > 0) palace.theRoom.reDrawTop();
	}





}
