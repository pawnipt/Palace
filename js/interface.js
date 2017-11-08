var roomList = null,
	userList = null,
	logField = document.getElementById('log'),
	genericSmiley = new Image(),
	selectedBagProps = [],
	propBag = document.getElementById('props'),
	resizingPropBag = null,
	resizingChatLog = null,
	viewScale = 1,
	viewScaleTimer = null,
	scanViewProps = [],
	dragPropID = null,
	currentColorControl = null,
	keysDown = [];


const electronSpellchecker = require('electron-spellchecker');
const SpellCheckHandler = electronSpellchecker.SpellCheckHandler;
const ContextMenuListener = electronSpellchecker.ContextMenuListener;
const ContextMenuBuilder = electronSpellchecker.ContextMenuBuilder;
window.spellCheckHandler = new SpellCheckHandler();
window.spellCheckHandler.attachToInput();
window.spellCheckHandler.switchLanguage('en-US'); // Start off as "US English, America" ...maybe use navigator.language
let contextMenuBuilder = new ContextMenuBuilder(window.spellCheckHandler);
// Add context menu listener
let contextMenuListener = new ContextMenuListener((info) => {
	contextMenuBuilder.showPopupMenu(info);
});


(function () { // setup

	// certain elements shouldn't accept focus!
	var items = document.getElementsByTagName('button');
	for (var i = 0; i < items.length; i++) {
		var item = items[i];
		item.tabIndex = -1;
		item.onfocus=function(){this.blur()};
	}
	items = document.getElementsByTagName('input');
	for (var i = 0; i < items.length; i++) {
		var item = items[i];
		if (item.type != 'text' && item.type) {
			item.tabIndex = -1;
			item.onfocus=function(){this.blur()};
		}
	}

	var preventFileDrop = function(event) {
		if (event.target != bgEnv) {
			event.preventDefault();
			event.dataTransfer.effectAllowed = 'none';
			event.dataTransfer.dropEffect = 'none';
		}
	};
	window.addEventListener("dragover",preventFileDrop);
	window.addEventListener("drop",preventFileDrop);


	// don't really need to call on the chatbox element much so I'm just using getElementById..
	document.getElementById('chatbox').onkeypress = function(event) {
		if (event.keyCode == 13) {
			var chat = event.target.value;
			if (chat.length > 0) {
				var chatCmd = chat.match(/^~([^ ]+)\s{0,1}(.*)$/);
				if (chatCmd && chatCmd.length > 2) {
					switch(chatCmd[1]) { // eventually add more client side commands
						case 'op':
						case 'susr':
							palaceTCP.sendOperatorRequest(chatCmd[2]);
							break;
						case 'clean':
							palaceTCP.sendDrawClear(3);
							palaceTCP.sendPropDelete(-1);
							break;
						default:
							break;
					}
				} else if (chat.charAt(0) == '/') {
					eval(chat.substring(1));
				} else {
					if (whisperUserID) {
						palaceTCP.sendWhisper(event.target.value,whisperUserID);
					} else {
						palaceTCP.sendXtlk(event.target.value);
					}
				}
				event.target.value = '';
			}
		}
	};


	window.addEventListener('mousemove',function(event) { // need to redesign this function...
		var restrictSidePanelSize = function(w) {
			if (w > window.innerWidth/1.5) w = (window.innerWidth/1.5).fastRound();
			if (w < 50) w = 50;
			return w;
		};

		if (resizingPropBag || (propBag.offsetLeft <= event.x && event.x < propBag.offsetLeft+2)) {
			propBag.style.cursor = 'ew-resize';
		} else {
			propBag.style.cursor = 'auto';
		}
		if (resizingChatLog || (logField.offsetLeft <= event.x && event.x < logField.offsetLeft+2)) {
			logField.style.cursor = 'ew-resize';
		} else {
			logField.style.cursor = 'auto';
		}
		if (resizingChatLog) {
			event.preventDefault();
			var w = restrictSidePanelSize(resizingChatLog.x-event.x+resizingChatLog.w);
			logField.style.width = w+'px';
			setBodyWidth();
			setGeneralPref('chatLogWidth',w);
			scale2Fit();
		} else if (resizingPropBag) {
			event.preventDefault();
			var w = restrictSidePanelSize(resizingPropBag.x-event.x+resizingPropBag.w);
			propBag.style.width = w+'px';
			setBodyWidth();
			setGeneralPref('propBagWidth',w);
			refreshPropBagView();
		}
	});


	propBag.onscroll = function() {
		refreshPropBagView();
	};
	propBag.ondragstart = function(event) {
		var dragged = event.target;
		dragPropID = Number(getBagPropID(dragged));
		var img = dragged.cloneNode(false);
		event.dataTransfer.setDragImage(img,img.width/2,img.height/2);
	};
	propBag.clickedProp = function(target) { // adding function to element! lol
		if (target.nodeName == 'DIV' || target.nodeName == 'IMG') {
			if (target.nodeName == 'IMG') return target.parentNode;
			return target;
		}
	};
	propBag.ondblclick = function(event) {
		if (propBag.clickedProp(event.target).dataset.pid) wearSelectedProps();
	};
	propBag.onmousedown = function(event) {
		var newTarget = propBag.clickedProp(event.target);
		if (event.target.nodeName != 'IMG') event.preventDefault();
		if (newTarget && (newTarget.className == '' || event.shiftKey || event.metaKey)) {
			var newPid = Number(newTarget.dataset.pid);
			if (newPid != null) {

				var lastPid;
				if (!event.metaKey) {
					if (event.shiftKey) lastPid = selectedBagProps[0];
					selectedBagProps = [];
				}

				if (lastPid == null) {
					selectedBagProps = [newPid];
				} else {
					var lastIdx = propBagList.indexOf(lastPid);
					var newIdx = propBagList.indexOf(newPid);
					var max = Math.max(newIdx,lastIdx);
					var min = Math.min(newIdx,lastIdx);
					selectedBagProps = propBagList.slice(min,max+1);
					if (newIdx < lastIdx) {
						selectedBagProps.reverse();
					}
				}
				refreshPropBagView(true);
				setPropButtons();
			}
		} else if (event.layerX-window.pageXOffset < 2) {
			event.preventDefault();
			window.addEventListener('mouseup',resizePropBagEnd);
			var style = getComputedStyle(propBag);
			var width = parseInt(style.getPropertyValue('width'));
			resizingPropBag = {x:event.x,w:width};
		}
	};
	document.getElementById('deleteprops').onclick = function() {
		var tx = db.transaction("props", "readwrite"); // maybe move database code to preferences file with the rest of it.
		var store = tx.objectStore("props");
		selectedBagProps.forEach(function(pid) {
			var index = propBagList.indexOf(pid);
			if (index > -1) {
				propBagList.splice(index,1);
				store.delete(pid);
			}
		});
		store.put({id: 'propList', list: propBagList});
		refreshPropBagView(true);
		setPropButtons();
	};
	document.getElementById('saveprop').onclick = function() {
		for (var i = theUser.props.length; --i >= 0;) saveProp(theUser.props[i]);
		this.disabled = true;
	};


	document.body.onresize = function(event) {
		if (logField.dataset.state == 1) logField.scrollTop = logField.scrollHeight - logField.clientHeight;
		if (propBag.dataset.state == 1) refreshPropBagView();
		scale2Fit();
	};

	document.body.onkeypress = function(keyboard) {
		var chr = String.fromCharCode(keyboard.keyCode);
		if (document.activeElement.nodeName == 'BODY' && !keyboard.metaKey && !keyboard.ctrlKey && okayChar.test(chr)) {
			//keyboard.preventDefault();
			//window.status = 'focuschat ' + chr;
			document.getElementById('chatbox').focus();
		}
	};
	document.body.onkeyup = function(keyboard) {
		if (keyboard.keyCode > 36 && keyboard.keyCode < 41) keysDown[keyboard.keyCode] = false;
	};
	document.body.onkeydown = function(keyboard) {
		if (document.activeElement.nodeName == 'BODY' && !keyboard.metaKey && !keyboard.ctrlKey) {

			var m = keyboard.altKey?1:4;
			var x = 0;
			var y = 0;

			if (keyboard.keyCode > 36 && keyboard.keyCode < 41) {
				keysDown[keyboard.keyCode] = true;
				keyboard.preventDefault();
			}

			if (keysDown[37]) x = -m; //left
			if (keysDown[38]) y = -m; //up
			if (keysDown[39]) x = m; //right
			if (keysDown[40]) y = m; //down

			move(x,y);
		}
	};


	document.getElementById('muteaudio').onclick = function() {
		bgVideo.muted = !bgVideo.muted;
		var muteaudio = document.getElementById('muteaudio');
		muteaudio.style.backgroundImage = 'url(img/audio' + (bgVideo.muted?'off':'on') + '.png)';
	};


	// setup the little connect bar functionality (should add a go button to indicte that there is a connect action)
	var serverConnectField = document.getElementById('palaceserver');
	serverConnectField.onfocus = function() {
		this.contentEditable = true;
		if (theRoom.address) this.innerText = theRoom.address.replace(':9998','');
		setTimeout(function(){this.setSelectionRange(0, this.value.length);},0);
	};
	serverConnectField.onblur = function() {
		this.innerText = theRoom.servername;
		this.contentEditable = false;
	};
	serverConnectField.onkeydown = function(event) {
		if (event.keyCode == 13) {
			gotourl(event.currentTarget.innerText);
			theRoom.servername = '';
			event.currentTarget.blur();
			return true;
		}
	};


	var toggleNav = function() {
		toggleNavListbox(this.id);
	};
	document.getElementById('users').onclick = toggleNav; // for loop a list maybe later
	document.getElementById('rooms').onclick = toggleNav;
	document.getElementById('servers').onclick = toggleNav;

	document.getElementById('navsearch').oninput = function() { // triggered navigation search filter
		switch (document.getElementById('navframe').dataset.ctrlname) {
			case 'users':
				loadUserList(userList);
				break;
			case 'rooms':
				loadRoomList(roomList);
				break;
			case 'servers':
				loadDirectoryList(directoryList);
				break;
		}
	};

	document.getElementById('navlistbox').onclick = function(event) {
		var lb = document.getElementById('navlistbox');
		var type = lb.parentNode.dataset.ctrlname;
		var t = event.target;
		if (t.nodeName != 'LI' && type != 'users') t = t.parentNode;

		if (t.dataset.userid) {
			enterWhisperMode(t.dataset.userid,t.innerText);
			toggleNavListbox(type);
		} else if (t.dataset.roomid) {
			gotoroom(t.dataset.roomid);
			toggleNavListbox(type);
		} else if (t.dataset.address) {
			gotourl(t.dataset.address);
			toggleNavListbox(type);
		}
	};


	document.getElementById('log').onmousedown = function(event) { // trigger for log resizing
		if (event.layerX-window.pageXOffset < 2) {
			event.preventDefault();
			window.addEventListener('mouseup',resizeChatLogEnd);
			var style = getComputedStyle(logField);
			var width = parseInt(style.getPropertyValue('width'));
			resizingChatLog = {x:event.x,w:width};
		}
	};

	document.getElementById('preferences').onclick = function() { // button to open/closoe log (should rename the id)
		toggleToolBarControl('prefs'); // toggle preferences
	};
	document.getElementById('chatlog').onclick = function() { // button to open/closoe log (should rename the id)
		toggleToolBarControl('log'); // toggle log
	};
	document.getElementById('propbag').onclick = function() { // button to open/close prop bag (should rename the id)
		toggleToolBarControl('props'); //toggle prop bag
		toggleToolBarControl('propcontrols'); // toggle prop bag controls
	};

	document.getElementById('newprops').onclick = function() { // hax (import image files as new props)
		var f = document.createElement('input');
		f.style.display = 'none';
		f.setAttribute('multiple', 'multiple');
		f.type = 'file';
		f.name = 'file';
		document.body.appendChild(f);
		f.onchange = function(event) {
			createNewProps(event.target.files);
		};
		f.click();
		document.body.removeChild(f);
	};
	document.getElementById('removeprops').onclick = function(){setprops([])}; // get naked button
	document.getElementById('editprop').onclick = function() { // edit selected bag prop
		// var tile = selectedBagProps[0];
		// 	if (!PropEdit) PropEdit = new PropEditor(tile);
		// 	PropEdit.loadProp(tile.dataset.pid);
		// 	if (PropEdit.editor.dataset.state == 0) {
		// 		//PropEdit.editor.style.left = propBag.offsetLeft+'px';
		// 		toggleToolBarControl(PropEdit.editor.id);
		// 		setTimeout(function(){
		// 			PropEdit.editor.style.opacity = '1';
		// 			PropEdit.editor.style.transform = PropEdit.trans;
		// 		},0);
		// 	}
	};


	// setup draw controls
	document.getElementById('drawsize').oninput = function() { // draw size change
		prefs.draw.size = this.value;
		updateDrawPreview();
	};
	document.getElementById('drawtype').onclick = function() { // toggle draw type
		prefs.draw.type = Number(!prefs.draw.type);
		setDrawType();
		updateDrawPreview();
	};
	var drawEraser = document.getElementById('drawerase');
	drawEraser.ondblclick = function() { //or clearing room of all draws
		palaceTCP.sendDrawClear(3);
	};
	drawEraser.onclick = function() { // for clearing the last draw
		palaceTCP.sendDrawClear(4);
	};
	document.getElementById('drawcolor').onclick = function(event) { // to change draw pen color
		openDrawColor(event,function(color) { // pop open color selector with callback
			prefs.draw.color = color;
			updateDrawPreview();
		});
	};
	document.getElementById('drawfill').onclick = function(event) { // to change draw fill color
		openDrawColor(event,function(color) { // pop open color selector with callback
			prefs.draw.fill = color;
			updateDrawPreview();
		});
	};
	document.getElementById('drawing').onclick = function() { // button for toggling drawing controls (should rename id)
		toggleToolBarControl('drawcontrols');
	};


	// setup color picker events
	document.getElementById('opacityslider').oninput = function() {
		colorSelectRGB();
	};
	document.getElementById('colorpicker').onmousedown = function(event) {
		colorSelectRGB(event);
	};
	document.getElementById('colorrainbow').onmousedown = function(event) {
		colorSelectRainbow(event);
	};

	// setup preferences
	document.getElementById('prefusername').onchange = function() { // set username
		palaceTCP.sendUserName(this.value);
		setGeneralPref('userName',this.value);
	};
	document.getElementById('prefhomepalace').onchange = function() {
		setGeneralPref('home',this.value);
	};
	document.getElementById('prefpropbagsize').oninput = function() { // change prop bag tile size :D
		setGeneralPref('propBagTileSize',this.value);
		refreshPropBagView(true);
	};
	document.getElementById('prefviewfitscale').onchange = function() {
		setGeneralPref('viewScales',this.checked);
		scale2Fit();
	};
	document.getElementById('prefviewscaleall').onchange = function() {
		setGeneralPref('viewScaleAll',this.checked);
		scale2Fit();
	};
	document.getElementById('prefdisablesounds').onchange = function() {
		setGeneralPref('disableSounds',this.checked);
	};



})();


genericSmiley.src = 'img/user.png';
genericSmiley.onload = function(){updateDrawPreview();};


function scale2Fit() {
	if (viewScaleTimer) {
		clearTimeout(viewScaleTimer);
		viewScaleTimer = null;
	}
	var style = getComputedStyle(document.getElementById('chatbox'));
	var chatBoxHeight = parseInt(style.getPropertyValue('height')) + 5;
	var logWidth = logField.offsetWidth;

	if (!prefs.general.viewScales && (prefs.general.viewScaleAll || (bgEnv.width > window.innerWidth-logWidth || bgEnv.height > window.innerHeight-45-chatBoxHeight))) {
		viewScaleTimer = setTimeout(function(){
			document.body.scrollTop = 0;
			document.body.scrollLeft = 0;
			document.body.style.overflow = 'hidden';
			var scaleW = ((window.innerWidth - logWidth) / bgEnv.width);
			var scaleH = ((window.innerHeight-45 - chatBoxHeight) / bgEnv.height);
			var scale = scaleW < scaleH?scaleW:scaleH;
			if (viewScale != scale) overLayer.style.transform = 'scale('+scale+') translateZ(0)';
			viewScale = scale;
		},50);
	} else {
		document.body.style.overflow = 'auto';
		overLayer.style.transform = '';
		viewScale = 1;
	}

}

function setBodyWidth() {
	var space = 0;
	if (logField.dataset.state == 1) space = logField.offsetWidth;
	if (propBag.dataset.state == 1) space = propBag.offsetWidth;
	document.body.style.width = bgEnv.width + space + 'px';
}



function enablePropButtons() {
	var saved = true;
	theUser.props.find(function(pid){if (propBagList.indexOf(pid) < 0) saved = false;});
	document.getElementById('saveprop').disabled = saved;
	document.getElementById('removeprops').disabled = (theUser.props.length == 0);
}

function refreshPropBagView(refresh) {
	var bagWidth = propBag.clientWidth;
	var tileSize = prefs.general.propBagTileSize;
	var visibleColumns = (bagWidth / tileSize).fastRound();
	if (visibleColumns < 1) visibleColumns = 1;
	var visibleRows = ((window.innerHeight - 45) / tileSize).fastRound(); // 45 is main toolbar height

	var propBagRetainer = document.getElementById('propbagretainer'); // adjust retainer size to set the scrollbar
	propBagRetainer.style.height = ((propBagList.length/visibleColumns).fastRound()*tileSize).fastRound() + 'px';

	var count = visibleRows * visibleColumns;
	var max = propBagList.length;
	var scroll = (propBag.scrollTop/tileSize).fastRound();

	var inView = {};
	scroll -= 2; // -2 for a little extra loaded up top
	if (scroll < 0) scroll = 0;
	for (var y = scroll; y < visibleRows+scroll+4; y++) { // +4 for a little extra loaded down below
		for (var x = 0; x < visibleColumns; x++) {
			var propIndex = y*visibleColumns+x;
			if (max > propIndex) inView[propBagList[propIndex]] = {x:x*tileSize,y:y*tileSize};
		}
	}

	var cachedTiles = {}; // prevent excessive database calls
	var children = propBag.children;
	for (var i = children.length - 1; i >= 0; i--) {
		var pid = children[i].dataset.pid;
		var preTile = inView[pid];
		var tile = children[i];
		if (tile != propBagRetainer && (refresh || !preTile || preTile.x != parseInt(tile.style.left) || preTile.y != parseInt(tile.style.top))) {
			cachedTiles[pid] = children[i];
			propBag.removeChild(children[i]);
		}
	}

	var alreadyInDom = function(id) {
		var children = propBag.children;
		for (var i = children.length - 1; i >= 0; i--) {
			if (id == Number(children[i].dataset.pid)) return children[i];
		}
	};

	for (var key in inView) {
		var e = inView[key];
		var pid = Number(key);
		var pc = alreadyInDom(pid);
		if (!pc) {
  			if (cachedTiles[key]) {
  				pc = cachedTiles[key];
  			} else {
  				pc = document.createElement('div');
				pc.dataset.pid = pid;
				var img = document.createElement('img');
				img.className = 'bagprop';
				getBagProp(pid,img);
				pc.appendChild(img);
  			}
  			pc.style.width = tileSize+'px';
			pc.style.height = tileSize+'px';
			pc.style.left = e.x + 'px';
			pc.style.top = e.y + 'px';
			propBag.appendChild(pc);
		}
		pc.className = selectedBagProps.indexOf(pid) > -1?'selectedbagprop':'';
	}
}



function resizeChatLogEnd(event) {
	resizingChatLog = null;
	window.removeEventListener('mouseup',resizeChatLogEnd);
}

function resizePropBagEnd(event) {
	resizingPropBag = null;
	window.removeEventListener('mouseup',resizePropBagEnd);
}


function upPropBag(event) {
	//lastBagPropsSelected.find(function(d){d.firstChild.draggable = true});
}

function getBagPropID(img) {
	return Number(img.parentNode.dataset.pid);
}

function wearSelectedProps() {
	if (selectedBagProps.length > 9) {
		//beep maybe
		return null;
	}
	if (selectedBagProps.length > 1) {
		setprops(selectedBagProps);
	} else if (selectedBagProps.length == 1) {
		if (theUser.props.indexOf(selectedBagProps[0]) > -1) {
			removeprop(selectedBagProps[0]);
		} else {
			donprop(selectedBagProps[0]);
		}
	}

// 	var childs = propBag.children;
// 	for (var i = childs.length - 1; i >= 0; i--) {
// 		var c = childs[i];
// 		if (selectedBagProps.indexOf(Number(c.dataset.pid)) > -1) {
// 			c.firstChild.style.filter = 'blur(2px)';
// 			setTimeout(function(){c.firstChild.style.filter = 'none';},150);
// 		}
// 	}

}
function setPropButtons() {
	var isSelected = (selectedBagProps.length > 0);
	document.getElementById('editprop').disabled = !isSelected;
	document.getElementById('deleteprops').disabled = !isSelected;
}






/*
function colorSelectHSL(event) {

	var s,l,sx,ly;

	s = event.layerX/2;
	sx = (((event.layerX/2)));
	ly = 100-(event.layerY/2);
	l = 50-(sx+ly)/2;


	var rgb = event.target.style.backgroundColor.getNbrs();
	var hsl = rgbToHsl(rgb[0],rgb[1],rgb[2]);
	hsl = 'hsl('+(hsl[0]*360)+','+s+'%,'+l+'%)';
	logmsg(hsl);

	document.getElementById('colorselector').style.backgroundColor = hsl;


}
*/

function dragRGB(event) {
	colorSelectRGB(event);
	/* var cselector = document.getElementById('colorselector'); */
	/* should calculate padding instead of hard coded numbers */
	/* setPickerCaret(event.x-cselector.offsetLeft-8,event.y-cselector.offsetTop-8); */
}

function setPickerCaret(x,y) {
	var caret = document.getElementById('pickercaret');
	if (y < 0) y = 0;
	if (y > 199) y = 199;
	if (x < 0) x = 0;
	if (x > 199) x = 199;
	caret.style.left = x-2+'px';
	caret.style.top = y-2+'px';
}

function setRainbowCaret(y) {
	var caret = document.getElementById('rainbowcaret');
	if (y < 0) y = 0;
	if (y > 199) y = 199;
	caret.style.top = y-1+'px';
}

function dragRGBEnd() {
	window.removeEventListener('mousemove',dragRGB);
	window.removeEventListener('mouseup',dragRGBEnd);
}

function colorSelectRGB(event,caret) {
	var pickerControl = document.getElementById('colorpicker'),
		color, x, y;

	if (event) {
		event.preventDefault();
		if (event.type == 'mousedown') {
			window.addEventListener('mousemove',dragRGB);
			window.addEventListener('mouseup',dragRGBEnd);
		}

		y = event.y-pickerControl.parentNode.offsetTop-pickerControl.parentNode.parentNode.offsetTop;
		x = event.x-pickerControl.parentNode.offsetLeft-pickerControl.parentNode.parentNode.offsetLeft;
		if (y < 0) y = 0;
		if (y > 199) y = 199;
		if (x < 0) x = 0;
		if (x > 199) x = 199;

		color = pickerControl.getContext('2d').getImageData(x, y, 1, 1).data;
		setPickerCaret(x,y);
	} else if (caret) {
		var o = getControlPrefs(currentColorControl.id);
		if (o) {
			x = Number(o.x);
			y = Number(o.y);
		} else {
			var style = window.getComputedStyle(document.getElementById('pickercaret'));
			x = Number(style.getPropertyValue('left').getNbrs()[0])+2;
			y = Number(style.getPropertyValue('top').getNbrs()[0])+2;

		}
		if (!Number.isFinite(x)) x = 199; // fix some bug that made it non-finite!
		if (!Number.isFinite(y)) y = 0;
		color = pickerControl.getContext('2d').getImageData(x, y, 1, 1).data;
	} else {
		var style = window.getComputedStyle(currentColorControl);
		color = style.getPropertyValue('background-color').getNbrs();
	}
	var opslider = document.getElementById('opacityslider');
	color = 'rgba('+color[0]+','+color[1]+','+color[2]+','+opslider.value*0.01+')';
	currentColorControl.style.backgroundColor = color;
	currentColorControl.doColorChange(color);
	if (x) setControlPrefs(currentColorControl.id,{x:x,y:y});
}

function dragRainbow(event) {
	colorSelectRainbow(event);
}

function dragRainbowEnd(event) {
	window.removeEventListener('mousemove',dragRainbow);
	window.removeEventListener('mouseup',dragRainbowEnd);
}

function colorSelectRainbow(event) {
	var hue,y,crainbow;

	event.preventDefault();
	if (event.type == 'mousedown') {
		window.addEventListener('mousemove',dragRainbow);
		window.addEventListener('mouseup',dragRainbowEnd);
	}
	crainbow = document.getElementById('colorrainbow').parentNode;
	y = event.y-crainbow.offsetTop-crainbow.parentNode.offsetTop;
	if (y < 0) y = 0;
	if (y > 200) y = 200;
	setRainbowCaret(y);
	hue = (100-(y/2))*0.01;
	setGeneralPref(currentColorControl.id,hue);
	fillColorPicker(hue);
	colorSelectRGB(null,true);
}



function fillColorPicker(hue) {
	var shCxt = document.getElementById('colorpicker').getContext('2d'),
		w = shCxt.canvas.width,
		h = shCxt.canvas.height;

	shCxt.clearRect(0,0,w,h);
	var whi = shCxt.createLinearGradient(0,0,w,0);
	whi.addColorStop(0,'white');
	whi.addColorStop(1,'rgba(255,255,255,0)');
	var bla = shCxt.createLinearGradient(0,h,0,0);
	bla.addColorStop(0,'black');
	bla.addColorStop(1,'rgba(0,0,0,0)');
	shCxt.fillStyle = 'hsl('+hue*360+',100%,50%)';
	shCxt.fillRect(0,0,w,h);
	shCxt.fillStyle = whi;
	shCxt.fillRect(0,0,w,h);
	shCxt.fillStyle = bla;
	shCxt.fillRect(0,0,w,h);
}

function setColorPicker(selectorsColor) {
	var rgb = selectorsColor.getNbrs();
	var o = getGeneralPref(currentColorControl.id);
	if (o) {
		hue = o;
	} else {
		hue = rgbToHsl(rgb[0],rgb[1],rgb[2])[0];
	}

	var value;
	if (rgb[3] != undefined) {
		value = Math.round(rgb[3]*100);
	} else {
		value = 100;
	}

	document.getElementById('opacityslider').value = value;
	setRainbowCaret(200-hue*200);
	fillColorPicker(hue);
	o = getControlPrefs(currentColorControl.id);
	if (o) setPickerCaret(o.x,o.y);
}


function openDrawColor(event,func) {

	var cp = event.currentTarget;

	if (currentColorControl == cp) {
		closeColorSelector(event.pageX-event.layerX,event.pageY-event.layerY);
	} else {
		var cselector = document.getElementById('colorselector');
		cp.doColorChange = func;
		currentColorControl = cp;
		var color = getComputedBgColor(cp);
		setColorPicker(color);
		cselector.style.backgroundColor = color;
		cselector.style.opacity = 1;
		var y = event.pageY-event.layerY;
		var x = event.pageX-event.layerX;
		cselector.style.top = y+'px';
		cselector.style.left = x+'px';
		toggleToolBarControl(cselector.id,true);

		setTimeout( function() { /* hack to get transition to still function after changing display property */
			cselector.firstElementChild.style.display = 'block';
			cselector.style.top = y+20+'px';
			cselector.style.left = x+'px';
			cselector.style.width = '224px';
			cselector.style.height = '220px';
			cselector.style.backgroundColor = 'RGBA(221,221,221,.95)';
		},0);
	}
}

function closeColorSelector(x,y,fade) {
	var cselector = document.getElementById('colorselector');
	cselector.firstElementChild.style.display = 'none';
	cselector.style.backgroundColor = getComputedBgColor(currentColorControl);
	if (fade !== undefined) cselector.style.opacity = 0;
	cselector.style.width = '0px';
	cselector.style.height = '0px';
	cselector.style.top = y+'px';
	cselector.style.left = x+'px';
	toggleToolBarControl(cselector.id);
	currentColorControl = null;
}

function getComputedBgColor(element) {
	return window.getComputedStyle(element).getPropertyValue('background-color');
}

function colorSelectOpacity(event) {
	colorSelectRGB(null);
}



function setDrawType() {
	var dt = document.getElementById('drawtype');
	switch(prefs.draw.type) {
		case 1:
			dt.style.backgroundImage = 'url(img/bucket.png)';
			break;
		default:
			dt.style.backgroundImage = 'url(img/pen.png)';
	}
}

function updateDrawPreview() {
	var drawCxt = document.getElementById('drawpreview').getContext("2d");

	var w = drawCxt.canvas.width;
	var h = drawCxt.canvas.height;
	var sw = genericSmiley.naturalWidth/2/2;
	var sh = genericSmiley.naturalHeight/2/2;

	drawCxt.canvas.onclick = function(){prefs.draw.front = !prefs.draw.front;updateDrawPreview();};

	drawCxt.clearRect(0,0,w,h);
	drawCxt.lineWidth = prefs.draw.size;
	drawCxt.lineJoin = 'round';
	drawCxt.lineCap = 'round';
	drawCxt.fillStyle = prefs.draw.fill;
	drawCxt.strokeStyle = prefs.draw.color;

	if (prefs.draw.front == true) drawCxt.drawImage(genericSmiley,0,0,42,42,w/2-sw,h/2-sh,21,21);

	if (prefs.draw.type == 0 || prefs.draw.type == 1) {
		drawCxt.beginPath();
		drawCxt.moveTo(12,h-12);
		drawCxt.lineTo(w/2,12);
		drawCxt.lineTo(w-12,h-12);

		if (prefs.draw.type == 1) {
			drawCxt.closePath();
			drawCxt.fill();
		}
		drawCxt.stroke();
	}

	if (prefs.draw.front == false) drawCxt.drawImage(genericSmiley,0,0,42,42,w/2-sw,h/2-sh,21,21);

}




function transitionalDisplayNone(event) {
	event.preventDefault();
	if (event.eventPhase == 2) {
		event.currentTarget.removeEventListener('transitionend',transitionalDisplayNone);
		event.currentTarget.style.display = 'none';
		if (event.currentTarget == logField) scale2Fit();
	}
}

function toggleToolBarControl(name,show) {
	var control = document.getElementById(name);
	control.removeEventListener('transitionend',transitionalDisplayNone);
	if (show === undefined) {
		if (control.dataset.state == 1) {
			if ('drawcontrols' == name && currentColorControl && (currentColorControl.id == 'drawcolor' || currentColorControl.id == 'drawfill'))
				closeColorSelector(event.x,event.y,true);
			control.addEventListener('transitionend', transitionalDisplayNone);
		}
	}
	control.dataset.state = (control.dataset.state != 1 || show?1:0);
	control.style.display = 'inline-block';
	if (name == 'log') scale2Fit();
	if (name == 'log' || name == 'props') setBodyWidth();
	if ((name == 'log' || name == 'props') && control.dataset.state == 1) logField.scrollTop = logField.scrollHeight - logField.clientHeight;
	if (name == 'props' && control.dataset.state == 1) refreshPropBagView();
}

function closeNavListbox() {
	document.getElementById('navsearch').value = '';
	var navframe = document.getElementById('navframe');
	navframe.style.display = 'none';
	navframe.className = 'navframe';
 	//toggleToolBarControl('navframe');
	navframe.dataset.ctrlname = '';
	clearListBox(document.getElementById('navlistbox'));
}

function clearListBox(listbox) {
	var e;
	while (e = listbox.lastChild) listbox.removeChild(e);
}

function toggleNavListbox(cname) {
	var navframe = document.getElementById('navframe');
	var listbox = document.getElementById('navlistbox');

	if (navframe.dataset.ctrlname == cname) {
		closeNavListbox();
	} else {
		navframe.dataset.ctrlname = cname;
		if (cname == 'users') {
			navframe.className = 'navframeusers'; //4 default
			palaceTCP.sendRoomListRequest();
			if (roomList && userList) {
				loadUserList(userList);
			} else {
				clearListBox(listbox);
			}
			palaceTCP.sendUserListRequest();
		} else if (cname == 'rooms') {
			navframe.className = 'navframerooms'; // 44
			if (roomList) {
				loadRoomList(roomList);
			} else {
				clearListBox(listbox);
			}
			palaceTCP.sendRoomListRequest();
		} else if (cname == 'servers') {
			navframe.className = 'navframeservers'; // 85
			if (directoryList) {
				loadDirectoryList(directoryList);
			} else {
				clearListBox(listbox);
			}
			requestDirectory();
		}
		navframe.style.display = 'block';
		//toggleToolBarControl('navframe',true);
	}
}

function requestDirectory() {
	httpGetAsync('http://pchat.org/webservice/directory/get/',loadDirectoryList);
}

function loadDirectoryList(directList) {

	directoryList = directList;
	if (typeof directList == 'string')
		directoryList = JSON.parse(directoryList);

	var listbox = document.getElementById('navlistbox'),
		navframe = document.getElementById('navframe'),
		scount = directoryList.directory.length,
		serverInfo, li, s, s2, cl;

	if (navframe.dataset.ctrlname == 'servers') {
		clearListBox(listbox);
		var word = document.getElementById('navsearch').value.toLowerCase();

		for (var i = 0; i < scount; i++) {
			serverInfo = directoryList.directory[i];
			if (word == '' || serverInfo.name.toLowerCase().indexOf(word) > -1) {
				li = document.createElement("li");
				li.dataset.address = serverInfo.address;

				li.className = 'sListItem';// '+serverInfo.language+' '+serverInfo.category.replace(/\s/g, '');
				li.title = serverInfo.description;
				s = document.createElement('div');
				s.className = 'listName';
				s.style.backgroundImage = 'url('+serverInfo.picture+')';
				s.appendChild(document.createTextNode(serverInfo.name));

				s2 = document.createElement('span');
				s2.className = 'listPop';
				s2.appendChild(document.createTextNode(serverInfo.population));

				li.appendChild(s);
				li.appendChild(s2);
				listbox.appendChild(li);
			}
		}
	}
}

function loadRoomList(rlist) {
	var listbox = document.getElementById('navlistbox'),
		navframe = document.getElementById('navframe'),
		rcount = rlist.length,
		li, s, s2, roomInfo;

	roomList = rlist;
	if (navframe.dataset.ctrlname == 'rooms') {
		clearListBox(listbox);
		var word = document.getElementById('navsearch').value.toLowerCase();

		for (var i = 0; i < rcount; i++) {
			roomInfo = rlist[i];
			if (word == '' || roomInfo.name.toLowerCase().indexOf(word) > -1) {
				li = document.createElement("li");
				li.dataset.roomid = roomInfo.id;
				var cl = li.classList;
				cl.add('rListItem');
				if (roomInfo.flags & 0x20) cl.add('hidden');
				if (roomInfo.flags & 8) cl.add('locked');
				if (roomInfo.flags & 2) cl.add('lockable');

				s = document.createElement('div');
				s.className = 'listName';
				s.appendChild(document.createTextNode(roomInfo.name));

				s2 = document.createElement('span');
				s2.className = 'listPop';
				s2.appendChild(document.createTextNode(roomInfo.population));

				li.appendChild(s);
				li.appendChild(s2);
				listbox.appendChild(li);
			}
		}
	}
}

function loadUserList(ulist) {
	var listbox = document.getElementById('navlistbox'),
		navframe = document.getElementById('navframe'),
		ucount = ulist.length,
		li, s, cl, userInfo, roomInfo, rname = '';

	userList = ulist;
	if (navframe.dataset.ctrlname == 'users') {
		clearListBox(listbox);
		var word = document.getElementById('navsearch').value.toLowerCase();

		for (var i = 0; i < ucount; i++) {
			userInfo = ulist[i];
			if (word == '' || userInfo.name.toLowerCase().indexOf(word) > -1) {
				li = document.createElement("li");

				cl = li.classList;
				cl.add('uListItem');

				if (userInfo.flags & 0x1000) cl.add('propgag');
				if (userInfo.flags & 0x0100) cl.add('pinned');
				if (userInfo.flags & 0x0080) cl.add('gagged');
				if (userInfo.flags & 2) cl.add('owner');
				if (userInfo.flags & 1) cl.add('operator');
				if (userInfo.userid == whisperUserID) cl.add('whisperingTo');

				s = document.createElement('div');
				s.className = 'listName';
				s.dataset.userid = userInfo.userid;
				s.appendChild(document.createTextNode(userInfo.name));

				s2 = document.createElement('div');
				cl = s2.classList;
				cl.add('roomName','rListItem');

				roomInfo = roomList.find(function(room){return userInfo.roomid == room.id;});

				if (roomInfo) {
					s2.dataset.roomid = userInfo.roomid; /* only if room is visible to the user */
					if (roomInfo.flags & 0x20) cl.add('hidden');
					if (roomInfo.flags & 8) cl.add('locked');
					if (roomInfo.flags & 2) cl.add('lockable');
					s2.appendChild(document.createTextNode(roomInfo.name));
				} else {
					cl.add('hidden','special');
				}

				li.appendChild(s);
				li.appendChild(s2);
				listbox.appendChild(li);
			}
		}
	}
}









// function closePropEditor() {
// 	PropEdit.editor.style.transform = 'scale(0,0)';
// 	PropEdit.editor.style.opacity = '0';
// 	toggleToolBarControl(PropEdit.editor.id);
// }
//
// function PropEditor(tile) {
// 	var id = tile.dataset.pid;
// 	var pedit = this;
// 	this.scale = 2;
// 	this.trans = 'none';
// 	this.editor = document.getElementById('propeditor');
// 	var pecanvas = document.getElementById('propeditorcanvas');
// 	this.canvasCtx = pecanvas.getContext('2d');
// 	this.canvasCtx.imageSmoothingEnabled = false;
//
// 	this.propCtx = document.createElement('canvas');
// 	this.propCtx = this.propCtx.getContext('2d');
//
//
// 	this.editor.addEventListener('mousedown',function(event) {
// 		if (event.target == pedit.editor) {
// 			var coords = pedit.editor.style.transform.getNbrs();
// 			var x = 0;
// 			var y = 0;
// 			if (coords) {
// 				x = coords[0];
// 				y = coords[1];
// 			}
// 			pedit.dragX = event.clientX - x;
// 			pedit.dragY = event.clientY - y;
// 			pedit.editor.style.transition = 'none';
// 			event.preventDefault();
// 		}
// 	});
// 	window.addEventListener('mousemove',function(event) {
// 		if (pedit.dragX != undefined) {
// 			pedit.trans = 'translate(' + (event.clientX - pedit.dragX) + 'px,' + (event.clientY - pedit.dragY) + 'px)';
// 			pedit.editor.style.transform = pedit.trans;
// 		}
// 	});
// 	window.addEventListener('mouseup',function(event) {
// 		delete pedit.dragX;
// 		delete pedit.dragY;
// 		pedit.editor.style.transition = 'opacity 0.2s,transform 0.2s';
// 	});
//
// 	this.canvasCtx.canvas.addEventListener('mousemove',function(event) {
// 		pedit.canvasCtx.canvas.style.cursor = 'zoom-' + (event.altKey?'out':'in');
// 	});
// 	this.canvasCtx.canvas.addEventListener('mousedown',function(event) {
// 		if (event.altKey || event.button == 2) {
// 			pedit.scale--;
// 		} else {
// 			pedit.scale++;
// 		}
// 		if (pedit.scale < 1) pedit.scale = 1;
// 		if (pedit.scale > 8) pedit.scale = 8;
// 		pecanvas.style.transform = 'scale('+pedit.scale+','+pedit.scale+')';
// 	});
// }
// PropEditor.prototype.loadProp = function(id) {
// // 	var pedit = this;
// // 	this.pid = id;
// // 	this.prp = propBagList[id];
// //
// // 	var img = document.createElement('img');
// // 	img.onload = function() {
// // 		pedit.propCtx.canvas.width = this.naturalWidth;
// // 		pedit.propCtx.canvas.height = this.naturalHeight;
// // 		pedit.propCtx.drawImage(this,0,0);
// // 		pedit.reDraw();
// // 	}
// // 	img.src = propsPath+id+'.png';
// };
// PropEditor.prototype.reDraw = function() {
// 	this.canvasCtx.clearRect(0,0,this.canvasCtx.canvas.width,this.canvasCtx.canvas.height);
// 	this.canvasCtx.drawImage(this.propCtx.canvas,this.prp.x+this.canvasCtx.canvas.width/2-22,this.prp.y+this.canvasCtx.canvas.height/2-22);
// };
