// @flow

var logField = document.getElementById('log'),
	directoryList = null,
	viewScale = 1,
	viewScaleTimer = null,
	keysDown = [];

if (window.require) {
	//import {SpellCheckHandler, ContextMenuListener, ContextMenuBuilder} from 'electron-spellchecker';
	const electronSpellchecker = require('electron-spellchecker');
	const SpellCheckHandler = electronSpellchecker.SpellCheckHandler;
	const ContextMenuListener = electronSpellchecker.ContextMenuListener;
	const ContextMenuBuilder = electronSpellchecker.ContextMenuBuilder;
	window.spellCheckHandler = new SpellCheckHandler();
	window.spellCheckHandler.attachToInput();
	window.spellCheckHandler.switchLanguage(navigator.language); // Start off as "US English, America" ...maybe use navigator.language
	let contextMenuBuilder = new ContextMenuBuilder(window.spellCheckHandler,null,true);
	// Add context menu listener
	let contextMenuListener = new ContextMenuListener((info) => {
		contextMenuBuilder.showPopupMenu(info);
	});
}




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
			//item.onfocus=function(){this.blur()};
		}
	}



	var preventFileDrop = function(event) {
		event.preventDefault();
		event.dataTransfer.effectAllowed = 'none';
		event.dataTransfer.dropEffect = 'none';
	};
	window.addEventListener("dragover",preventFileDrop);
	window.addEventListener("drop",preventFileDrop);


	document.getElementById('submitauthenticate').onclick = function() {
		palace.sendAuthenticate(document.getElementById('authusername').value,
								document.getElementById('authpassword').value);
		toggleZoomPanel('authenticate');
	};


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
							palace.sendOperatorRequest(chatCmd[2]);
							break;
						case 'clean':
							palace.sendDrawClear(3);
							palace.sendPropDelete(-1);
							break;
						default:
							break;
					}
				} else if (chat.charAt(0) == '/') {
					eval(chat.substring(1));
				} else if (palace.theRoom) {
					while (chat.length > 0) {
						var seg = chat.slice(0,250);
						chat = chat.slice(250,chat.length);
						if (palace.theRoom.whisperUserID) {
							palace.sendWhisper(seg,palace.theRoom.whisperUserID);
						} else {
							palace.sendXtlk(seg);
						}
					}

				}
				event.target.value = '';
			}
		}
	};


	document.getElementById('deleteprops').onclick = function() {
		deletePropsFromDB(selectedBagProps);
		selectedBagProps = [];
		refreshPropBagView(true);
		setPropButtons();
		enablePropButtons();
	};
	document.getElementById('saveprop').onclick = function() {
		var pids = [];
		for (var i = palace.theUser.props.length; --i >= 0;) {
			pids.push(palace.theUser.props[i]);
		}
		saveProp(pids);
		this.disabled = true;
	};


	document.body.onresize = function(event) {
		if (logField.dataset.state == 1) logField.scrollTop = logField.scrollHeight - logField.clientHeight;
		if (propBag.dataset.state == 1) refreshPropBagView();
		scale2Fit();
	};

	window.addEventListener('keypress',function(keyboard) {
		if (document.activeElement.type !== 'text' && document.activeElement.contentEditable != 'true' && !keyboard.metaKey && !keyboard.ctrlKey) {
			document.getElementById('chatbox').focus();
		}
	},false);

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

			if (palace) palace.move(x,y);
		}
	};

	window.addEventListener('keyup', function(e) {
		if (palace && palace.theRoom && palace.theRoom.hideUserNames && !platformCtrlKey(e) && !e.altKey) {
			palace.theRoom.hideUserNames = false;
			palace.theRoom.toggleUserNames(true);
		}
	},true);
	window.addEventListener('keydown', function(e) {
		if (platformCtrlKey(e)) {
			if (e.altKey && palace && palace.theRoom && !palace.theRoom.hideUserNames) {
				palace.theRoom.hideUserNames = true;
				palace.theRoom.toggleUserNames(false);
			}
			switch (e.key) {
				case 'd':
					document.getElementById('servers').click();
					break;
				case 'g':
					document.getElementById('rooms').click();
					break;
				case 'f':
					document.getElementById('users').click();
					break;
			}
		}
	}, true);

	document.getElementById('authenticate').onkeydown = function(event) {
		if (event.keyCode === 13) {
			document.getElementById('submitauthenticate').click();
		}
	}

	document.getElementById('muteaudio').onclick = function() {
		palace.videobg.muted = !palace.videobg.muted;
		let muteaudio = document.getElementById('muteaudio');
		muteaudio.style.backgroundImage = 'url(img/audio' + (palace.videobg.muted?'off':'on') + '.png)';
	};


	// setup the little connect bar functionality (should add a go button to indicte that there is a connect action)
	let serverConnectField = document.getElementById('palaceserver');
	serverConnectField.onfocus = function() {
		this.contentEditable = true;
		this.innerText = (palace.ip + ':' + palace.port).replace(':9998','');

		let selection = window.getSelection();
		let range = document.createRange();
		range.selectNodeContents(this);
		selection.removeAllRanges();
		selection.addRange(range);
	};
	serverConnectField.onmousedown = function(event) {
		if (document.activeElement !== this) {
			this.focus();
			event.preventDefault();
		}
	};
	serverConnectField.onblur = function() {
		this.innerText = palace.servername;
		this.contentEditable = false;
		if (document.selection) {
	        document.selection.empty();
	    } else if (window.getSelection) {
	        window.getSelection().removeAllRanges();
	    }
	};
	serverConnectField.onkeydown = function(event) {
		if (event.keyCode == 13) {
			palace.goto(event.currentTarget.innerText);
			palace.servername = '';
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
				loadUserList(palace.userList);
				break;
			case 'rooms':
				loadRoomList(palace.roomList);
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
			palace.theRoom.enterWhisperMode(Number(t.dataset.userid),t.innerText);
			toggleNavListbox(type);
		} else if (t.dataset.roomid) {
			palace.gotoroom(Number(t.dataset.roomid));
			toggleNavListbox(type);
		} else if (t.dataset.address) {
			palace.goto(t.dataset.address);
			toggleNavListbox(type);
		}
	};

	logField.onmousemove = function(event) {
		if (event.target === this && event.x-this.offsetLeft < 2) {
			this.style.cursor = 'col-resize';
		} else {
			this.style.cursor = 'auto';
		}
	};
	logField.onmousedown = function(event) { // trigger for log resizing
		if (event.target === this && event.x-this.offsetLeft < 2) {
			event.preventDefault();
			var initialX = event.pageX-window.scrollX;
			var initialW = this.offsetWidth;

			let mouseMoveLog = (event) => {

				this.style.cursor = 'col-resize';

				logField.style.pointerEvents = 'none';
				event.stopImmediatePropagation();

				var w = initialX-event.x+initialW;

				chatLogScrollLock(() => {
					this.style.width = w+'px';
				});

				setBodyWidth();
				setGeneralPref('chatLogWidth',w);
				scale2Fit();
			};
			let mouseUpLog = function(event) {
				event.preventDefault();
				logField.style.pointerEvents = '';
				window.removeEventListener('mouseup',mouseUpLog,true);
				window.removeEventListener('mousemove',mouseMoveLog,true);
			};
			window.addEventListener('mouseup',mouseUpLog,true);
			window.addEventListener('mousemove',mouseMoveLog,true);
		}
	};

	document.getElementById('preferences').onclick = function() { // button to open/closoe log (should rename the id)
		toggleZoomPanel('prefs'); // toggle preferences
	};
	document.getElementById('chatlog').onclick = function() { // button to open/closoe log (should rename the id)
		toggleToolBarControl('log'); // toggle log
	};
	document.getElementById('propbag').onclick = function() { // button to open/close prop bag (should rename the id)
		toggleToolBarControl('props'); //toggle prop bag
		toggleToolBarControl('propcontrols'); // toggle prop bag controls
		// firstLoop: for (let url in propBlobUrls) {
		// 	propBag.childred
		// 	for (var i = propBag.children.length - 1; i >= 0; i--) {
		// 		var tile = propBag.children[i];
		// 		if (tile.firstChild && tile.dataset.pid === url) {
		// 			continue firstLoop;
		// 		}
		// 	}
		// 	URL.revokeObjectURL(propBlobUrls[url]);
		// 	delete propBlobUrls[url];
		// }

	};
	document.getElementById('fileprops').onchange = function(event) {
		createNewProps(event.target.files);
		this.value = null;
	};
	document.getElementById('removeprops').onclick = function(){palace.setprops([])}; // get naked button
	// document.getElementById('editprop').onclick = function() {
    //
	// };


	// setup draw controls
	document.getElementById('drawsize').oninput = function() { // draw size change
		prefs.draw.size = this.value;
		updateDrawPreview();
	};
	document.getElementById('drawtype').onclick = function() { // toggle draw type
		prefs.draw.type++;
		if (prefs.draw.type > 2) {
			prefs.draw.type = 0;
		}
		setDrawType();
		updateDrawPreview();
	};
	var drawEraser = document.getElementById('drawundo');
	drawEraser.ondblclick = function() { //or clearing room of all draws
		palace.sendDrawClear(3);
	};
	drawEraser.onclick = function() { // for clearing the last draw
		palace.sendDrawClear(4);
	};
	document.getElementById('drawcolor').onchange = function(event) { // to change draw pen color
		let opacity = 1;//getNbrs(prefs.draw.color)[3];
		prefs.draw.color = hexToRGBA(this.value,opacity);
		this.style.backgroundColor = prefs.draw.color;
		updateDrawPreview();
	};
	document.getElementById('drawfill').onchange = function(event) { // to change draw fill color
		let opacity = 1;//getNbrs(prefs.draw.fill)[3];
		prefs.draw.fill = hexToRGBA(this.value,opacity);
		this.style.backgroundColor = prefs.draw.fill;
		updateDrawPreview();
	};
	document.getElementById('drawing').onclick = function() { // button for toggling drawing controls (should rename id)
		toggleToolBarControl('drawcontrols');
	};

	// setup preferences
	document.getElementById('prefusername').onchange = function() { // set username
		palace.sendUserName(this.value);
		setGeneralPref('userName',this.value);
	};
	document.getElementById('prefhomepalace').onchange = function() {
		setGeneralPref('home',this.value);
	};
	document.getElementById('prefencoding').onchange = function() {
		try {
			palace.setEncoder(this.value);
			setGeneralPref('encoding',this.value);
		} catch (error) {
			logerror(error);
			this.value = getGeneralPref('encoding');
		}
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
	document.getElementById('prefautoplayvideos').onchange = function() {
		setGeneralPref('autoplayvideos',this.checked);
	};



})();

function platformCtrlKey(keyboardEvent) {
	var mac = (/^Mac/.test(navigator.platform));
	return (!mac && keyboardEvent.ctrlKey) || (mac && keyboardEvent.metaKey);
}

function updateDrawPreview() {
	var drawCxt = document.getElementById('drawpreview').getContext("2d");

	var genericSmiley = smileys[5+',0'];

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




	if (prefs.draw.front === true) {
		drawCxt.globalCompositeOperation = 'source-over';
		drawCxt.filter = 'grayscale(100%)';
		drawCxt.drawImage(genericSmiley,0,0,42,42,w/2-sw,h/2-sh,21,21);
		drawCxt.filter = 'none';
	}

	if (prefs.draw.type === 2) {
		drawCxt.globalCompositeOperation = 'destination-out';
	} else {
		drawCxt.globalCompositeOperation = 'source-over';
	}

	if (prefs.draw.type < 3) {
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

	if (prefs.draw.front == false) {
		drawCxt.globalCompositeOperation = 'source-over';
		drawCxt.filter = 'grayscale(100%)';
		drawCxt.drawImage(genericSmiley,0,0,42,42,w/2-sw,h/2-sh,21,21);
		drawCxt.filter = 'none';
	}

}


function setDrawType() {
	let dt = document.getElementById('drawtype');
	switch(prefs.draw.type) {
		case 1:
			dt.style.backgroundImage = 'url(img/bucket.png)';
			break;
		case 2:
			dt.style.backgroundImage = 'url(img/eraser.png)';
			break;
		default:
			dt.style.backgroundImage = 'url(img/pen.png)';
	}
}

function updateDrawPreview() {
	var drawCxt = document.getElementById('drawpreview').getContext("2d");

	var genericSmiley = smileys[5+',0'];

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




	if (prefs.draw.front === true) {
		drawCxt.globalCompositeOperation = 'source-over';
		drawCxt.filter = 'grayscale(100%)';
		drawCxt.drawImage(genericSmiley,0,0,42,42,w/2-sw,h/2-sh,21,21);
		drawCxt.filter = 'none';
	}

	if (prefs.draw.type === 2) {
		drawCxt.globalCompositeOperation = 'destination-out';
	} else {
		drawCxt.globalCompositeOperation = 'source-over';
	}

	if (prefs.draw.type < 3) {
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

	if (prefs.draw.front == false) {
		drawCxt.globalCompositeOperation = 'source-over';
		drawCxt.filter = 'grayscale(100%)';
		drawCxt.drawImage(genericSmiley,0,0,42,42,w/2-sw,h/2-sh,21,21);
		drawCxt.filter = 'none';
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
	chatLogScrollLock(() => {
		if (logField.children.length > 400)
			while (logField.children.length > 300) // limit log for performance reasons
				logField.removeChild(logField.firstChild);
		logField.appendChild(logspan);
	});
}

function logspecial(name) {
	var logspan = document.createElement('div');
 	logspan.className = 'logmsg special '+name;
	logAppend(logspan);
}


function makeHyperLinks(str,parent) { /* fix this, oddly; numbers fail! */
	const linkSearch = /(\bhttps?:\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/i;

	var parts = str.split(linkSearch);
	var l = parts.length;
	var s = document.createElement('span');
	if (l > 1) {
		for (var i = 0; i < l; i++) {
			let link = parts[i];
			if (link.length > 0) {
				let txt = document.createTextNode(link);
				if (linkSearch.test(link)) {
					let a = document.createElement('a');
					a.tabIndex = -1;
					a.onfocus=function(){this.blur()};
					a.addEventListener('click', function (e) {
						e.preventDefault();
						require('electron').shell.openExternal(this.href);
					});
					a.appendChild(txt);
					a.href = link;
					s.appendChild(a);

					let youTube = matchYoutubeUrl(link);
					if (youTube) {
						createYoutubePlayer({id:youTube,anchor:a,container:s,parent:parent});
					} else {
						let faceBook = matchFacebookUrl(link);
						if (faceBook) {
							createFacebookPlayer({id:faceBook,anchor:a,container:s,parent:parent});
						} else {
							let vimeo = matchVimeoUrl(link);
							if (vimeo) {
								createVimeoPlayer({id:vimeo,anchor:a,container:s,parent:parent});
							}
						}
					}

				} else {
					s.appendChild(txt);
				}
			}
		}
	} else {
		s.textContent = str;
	}
	return s;
};


function matchYoutubeUrl(url) {
	let m = url.match(/^(?:https?:\/\/)?(?:m\.|www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?$/);
	if (m) {
        return m[1];
    }
}
function createYoutubePlayer(info) {
	httpGetAsync('https://www.googleapis.com/youtube/v3/videos?part=snippet&key=AIzaSyAHk4QfatpeEcQg-CPDrTqi9ozoJ55w5GE&id='+info.id,
		'json',
		function(yt) {
			if (yt && yt.items && yt.items.length > 0) {
				info.icon = yt.items[0].snippet.thumbnails.high.url;
				info.title = yt.items[0].snippet.title;
				 // direct youtube embeds in the app doesn't play restricted embeds, so I used pchat.org
				createChatVideoPlayer('youtube',info,'http://pchat.org/api/youtube/?id='+info.id);
			} // else display error probably...
		}
	);
}

function matchFacebookUrl(url) {
	let m = url.match(/^https:\/\/www\.facebook\.com\/(.*?)\/videos\/(.*\/)?([0-9]+)/);
	if (m) {
        return m;
    }
}
function createFacebookPlayer(info) {
	let source = 'https://www.facebook.com/plugins/video.php?href=';
	httpGetAsync('https://graph.facebook.com/'+info.id[3]+'?fields=title,format,picture,embeddable,permalink_url,description&access_token=872564939584635|cc4b23aa93ddd3413884ab3e9875dd73',
		'json',
		function(fb) {
			if (fb && fb.embeddable) {
				let HQformat = fb.format[Math.floor((fb.format.length-1)/2)];
				info.ratio = ((HQformat.height / HQformat.width) * 100);
				info.icon = HQformat.picture || fb.picture;
				info.title = fb.title || fb.description || '';
				source = source + encodeURIComponent('https://www.facebook.com/'+fb.permalink_url)+'&autoplay=true&mute=0';
				createChatVideoPlayer('facebook',info,source);
			}
		},'',function (error) {
			info.icon = ''; //generic facebook icon perhaps
			info.title = 'Not facebook supported';
			source = source + encodeURIComponent('https://www.facebook.com/'+info.id[1]+'/videos/'+info.id[3]+'/')+'&autoplay=true&mute=0';
			createChatVideoPlayer('facebook',info,source);
		}
	);
}

function matchVimeoUrl(url) {
	let m = url.match(/^https:\/\/vimeo.com(.*)\/([0-9]+)/);
	if (m) {
        return m[2];
    }
}
function createVimeoPlayer(info) {
	httpGetAsync('https://api.vimeo.com/videos/'+info.id+'?access_token=3842fc48186684845f76f44e607ae85a',
		'json',
		function(vm) {
			if (vm && vm.privacy.embed === 'public') {
				info.icon = vm.pictures.sizes[Math.floor((vm.pictures.sizes.length-1)/2)].link;
				info.title = vm.name;
				info.ratio = ((vm.height / vm.width) * 100);
				createChatVideoPlayer('vimeo',info,'https://player.vimeo.com/video/'+info.id+'?autoplay=1&title=1');
			}
		}
	);
}


function closeAllLogVideos() {
	let closeButtons = document.getElementsByClassName('closechatvideo');
	for (let i = 0; i < closeButtons.length; i++) {
		closeButtons[i].click();
	}
}

function createChatVideoPlayer(type,info,source) {
	let pb = document.createElement('div');
	pb.onclick = function() {
		closeAllLogVideos();
		let frame = document.createElement('iframe');
		let closeyt = document.createElement('div');
		closeyt.className = 'closechatvideo';
		closeyt.onclick = function(event) {
			chatLogScrollLock(() => {
				info.parent.style.position = 'static';
				info.parent.style.zIndex = '';
				info.container.className = '';
				info.container.replaceChild(pb,frame);
				info.container.insertBefore(info.anchor,pb);
				info.container.removeChild(this);
			});
		};
		frame.setAttribute('allowFullScreen', '');
		frame.setAttribute('scrolling', 'no');
		frame.setAttribute('allow', 'autoplay');
		frame.tabIndex = -1;
		frame.frameBorder = '0';
		frame.className = 'chatvideoiframe';
		frame.width = '100%';
		frame.height = '100%';

		frame.onload = function() { // find useful info from the iframe if possible.
			let vid = this.contentWindow.document.getElementsByTagName('video');
			if (vid && vid.length > 0) {
				vid = vid[0];
				chatLogScrollLock(() => {
					let ratio = ((vid.height / vid.width) * 100);
					info.container.style.paddingBottom = ratio+'%';
					pb.style.paddingBottom = ratio+'%';
				});
			}
		};

		frame.src = source;
		chatLogScrollLock(() => {
			info.container.className = 'chatvideocontainer';
			info.container.replaceChild(frame,this);
			info.container.removeChild(info.anchor);
			info.container.appendChild(closeyt);
			info.parent.style.top = '-'+(info.parent.firstChild.nextSibling.offsetHeight+2)+'px';
			info.parent.style.position = 'sticky';
			info.parent.style.zIndex = '100';
			info.parent.style.top = -(info.containerOffsetTop+2)+'px';
		});
	};

	let title = document.createElement('div');
	title.className = 'chatvideotitle';
	title.innerText = info.title;
	pb.appendChild(title);
	pb.className = 'chatvideocontainer';
	pb.style.backgroundImage = 'url(img/'+type+'-play.svg), url('+info.icon+')';

	chatLogScrollLock(() => {
		if (info.ratio) {
			info.container.style.paddingBottom = info.ratio+'%';
			pb.style.paddingBottom = info.ratio+'%';
		}
		info.container.appendChild(pb);
	});
	if (prefs.general.autoplayvideos) {
		pb.click();
	}
}

function chatLogScrollLock(callback) { // keeps the chat log scrolled down if the user hasn't scrolled up
	let scrollLock = Math.abs((logField.scrollHeight - logField.clientHeight) - logField.scrollTop.fastRound()) < 2;
	if (callback) callback();
	if (scrollLock) logField.scrollTop = logField.scrollHeight - logField.clientHeight;
}


// add more elements perhaps.
function setUserInterfaceAvailability(disable) {
	document.getElementById('users').disabled = disable;
	document.getElementById('rooms').disabled = disable;
}

function scale2Fit() {
	if (viewScaleTimer) {
		clearTimeout(viewScaleTimer);
		viewScaleTimer = null;
	}
	var chatBox = document.getElementById('chatbox');
	var chatBoxHeight = palace.chatBoxHeight;
	var logWidth = logField.offsetWidth;

	if (!prefs.general.viewScales && (prefs.general.viewScaleAll || (palace.roomWidth > window.innerWidth-logWidth || palace.roomHeight > window.innerHeight-palace.containerOffsetTop-chatBoxHeight))) {
		viewScaleTimer = setTimeout(function(){
			document.body.scrollTop = 0;
			document.body.scrollLeft = 0;
			document.body.style.overflow = 'hidden';
			var scaleW = ((window.innerWidth - logWidth) / palace.roomWidth);
			var scaleH = ((window.innerHeight- palace.containerOffsetTop - chatBoxHeight) / palace.roomHeight);
			var scale = scaleW < scaleH?scaleW:scaleH;
			if (viewScale != scale) palace.container.style.transform = 'scale('+scale+') translateZ(0)';
			viewScale = scale;
			chatBox.style.width = (palace.roomWidth*scale)+'px';
		},50);
	} else {
		document.body.style.overflow = 'auto';
		palace.container.style.transform = '';
		viewScale = 1;
		chatBox.style.width = palace.roomWidth +'px';
	}

}

function setBodyWidth() {
	var space = 0;
	if (logField.dataset.state == 1) space = logField.offsetWidth;
	document.body.style.width = palace.roomWidth + space + 'px';
}



function enablePropButtons() {
	var saved = true;
	if (palace.theUser) {
		palace.theUser.props.find(function(pid){if (propBagList.indexOf(pid) < 0) saved = false;});
		document.getElementById('saveprop').disabled = saved;
		document.getElementById('removeprops').disabled = (palace.theUser.props.length == 0);
	}
}



function wearSelectedProps() {
	if (selectedBagProps.length > 9) {
		//beep maybe
		return null;
	}
	if (selectedBagProps.length > 1) {
		palace.setprops(selectedBagProps);
	} else if (selectedBagProps.length == 1) {
		if (palace.theUser.props.indexOf(selectedBagProps[0]) > -1) {
			palace.removeprop(selectedBagProps[0]);
		} else {
			palace.donprop(selectedBagProps[0]);
		}
	}
}
function setPropButtons() {
	var isSelected = (selectedBagProps.length > 0);
	document.getElementById('editprop').disabled = !isSelected;
	document.getElementById('deleteprops').disabled = !isSelected;
}




function zoomPanelClose(event) {
	event.preventDefault();
	event.currentTarget.removeEventListener('animationend',zoomPanelClose);
	if (event.currentTarget.dataset.state == 0) event.currentTarget.style.display = 'none';
}

function toggleZoomPanel(name,override) {
	var control = document.getElementById(name);
	control.removeEventListener('animationend',zoomPanelClose);
	if (control.dataset.state == 1) {
		control.addEventListener('animationend',zoomPanelClose);
	}
	if (override != undefined) {
		control.dataset.state = override;
	} else {
		control.dataset.state = (control.dataset.state === '1'?0:1);
	}

	if (control.dataset.state == 1) control.style.display = 'inline-block';
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
	if (show === undefined && control.dataset.state == 1) {
		control.addEventListener('transitionend', transitionalDisplayNone);
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
			palace.sendRoomListRequest();
			if (palace.roomList && palace.userList) {
				loadUserList(palace.userList);
			} else {
				clearListBox(listbox);
			}
			palace.sendUserListRequest();
		} else if (cname == 'rooms') {
			navframe.className = 'navframerooms'; // 44
			if (palace.roomList) {
				loadRoomList(palace.roomList);
			} else {
				clearListBox(listbox);
			}
			palace.sendRoomListRequest();
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
	httpGetAsync('http://pchat.org/webservice/directory/get/','json',loadDirectoryList);
}

function loadDirectoryList(list) {
	directoryList = list;
	if (!directoryList) return;

	let listbox = document.getElementById('navlistbox'),
		navframe = document.getElementById('navframe'),
		scount = directoryList.directory.length,
		serverList, li, s, s2, cl, popCount = 0, pop;

	if (navframe.dataset.ctrlname === 'servers') {
		clearListBox(listbox);
		let word = document.getElementById('navsearch').value.toLowerCase();

		for (let i = 0; i < scount; i++) {
			serverList = directoryList.directory[i];
			if (word === '' || serverList.name.toLowerCase().indexOf(word) > -1) {
				li = document.createElement("li");
				li.dataset.address = serverList.address;

				li.className = 'sListItem';// '+serverList.language+' '+serverList.category.replace(/\s/g, '');
				li.title = serverList.description;
				s = document.createElement('div');
				s.className = 'listName';
				s.style.backgroundImage = 'url(http://pchat.org/portal/?url='+serverList.picture+')';
				s.appendChild(document.createTextNode(serverList.name));

				s2 = document.createElement('span');
				s2.className = 'listPop';
				s2.appendChild(document.createTextNode(serverList.population));

				pop = Number(serverList.population)
				popCount += isNaN(pop)?0:pop;

				li.appendChild(s);
				li.appendChild(s2);
				listbox.appendChild(li);
			}
		}
		document.getElementById('servers').title = "Users Online: " + popCount;
	}
}

function loadRoomList(rlist) {
	var listbox = document.getElementById('navlistbox'),
		navframe = document.getElementById('navframe'),
		rcount = rlist.length,
		li, s, s2, roomInfo;

	palace.roomList = rlist;
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

	palace.userList = ulist;
	if (navframe.dataset.ctrlname == 'users') {
		clearListBox(listbox);
		let word = document.getElementById('navsearch').value.toLowerCase();
		let redSmile = smileys[5+',0'];
		let blueSmile = smileys[5+',10'];
		let yellowSmile = smileys[5+',3'];

		for (var i = 0; i < ucount; i++) {
			userInfo = ulist[i];
			if (word == '' || userInfo.name.toLowerCase().indexOf(word) > -1) {
				li = document.createElement("li");

				cl = li.classList;
				cl.add('uListItem');

				let isOwner = Boolean(userInfo.flags & 2);
				let isOperator = Boolean(userInfo.flags & 1);

				if (userInfo.flags & 0x1000) cl.add('propgag');
				if (userInfo.flags & 0x0100) cl.add('pinned');
				if (userInfo.flags & 0x0080) cl.add('gagged');
				if (isOwner) cl.add('owner');
				if (isOperator) cl.add('operator');
				if (userInfo.userid == palace.theRoom.whisperUserID) cl.add('whisperingTo');

				if (isOwner) {
					li.style.backgroundImage = 'url('+redSmile.src+')'; // not sure if using data url is most efficient...
				} else if (isOperator) {
					li.style.backgroundImage = 'url('+blueSmile.src+')';
				} else {
					li.style.backgroundImage = 'url('+yellowSmile.src+')';
				}

				s = document.createElement('div');
				s.className = 'listName';
				s.dataset.userid = userInfo.userid;
				s.appendChild(document.createTextNode(userInfo.name));

				s2 = document.createElement('div');
				cl = s2.classList;
				cl.add('roomName','rListItem');

				roomInfo = palace.roomList.find(function(room){return userInfo.roomid == room.id;});

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
