// @flow

var cacheProps = {},
    nbrProps = 0, // keep record of the number of props loaded into memory because counting cacheProps object properties is inefficient
    retryProps = {props:[],delay:2500},
    propBag = document.getElementById('props'),
    propBagRetainer = document.getElementById('propbagretainer'),
    selectedBagProps = [],
	dragBagProp = null,
    propBagDB;


const   PROP_HEAD = 2,
    	PROP_GHOST = 4,
    	PROP_RARE = 8,
    	PROP_ANIMATED = 16,
    	PROP_BOUNCE = 32,
    	PROP_PNG = 1024;


function refreshPropBagView(refresh) { // redo this entire thing
	var bagWidth = propBag.clientWidth,
		tileSize = prefs.general.propBagTileSize,
		visibleColumns = (bagWidth / tileSize).fastRound(),
		visibleRows = ((window.innerHeight - palace.containerOffsetTop) / tileSize).fastRound(), // 45 is main toolbar height
		count = visibleRows * visibleColumns,
		max = propBagList.length,
		scroll = (propBag.scrollTop/tileSize).fastRound(),
		toView = {};

	var cheight = ((propBagList.length/visibleColumns).fastRound()*tileSize).fastRound();
	if (Number(propBagRetainer.dataset.height) !== cheight) propBagRetainer.style.height = cheight + 'px';
	propBagRetainer.dataset.height = cheight;

	if (visibleColumns < 1) visibleColumns = 1;
	scroll -= 2; // -2 for a little extra loaded up top
	if (scroll < 0) scroll = 0;

	for (let y = scroll; y < visibleRows+scroll+4; y++) { // +4 for a little extra loaded down below
		for (let x = 0; x < visibleColumns; x++) {
			let propIndex = y*visibleColumns+x;
			if (max > propIndex) toView[propBagList[propIndex]] = {x:x*tileSize,y:y*tileSize};
		}
	}
	var keys = Object.keys(toView);

	var cachedTiles = {}; // prevent excessive database calls
	var children = propBag.children;

	for (let i = children.length - 1; i >= 0; i--) {
		var tile = children[i];
		var pid = tile.dataset.pid;
		var preTile = toView[pid];
		if (tile !== propBagRetainer && (refresh || !preTile || preTile.x !== Number(tile.dataset.left) || preTile.y !== Number(tile.dataset.top))) {
			cachedTiles[pid] = children[i];
			propBag.removeChild(children[i]);
		}
	}

	var alreadyInDom = function(id) {
		for (let i = children.length - 1; i >= 0; i--) {
			if (id === Number(children[i].dataset.pid)) {
				return children[i];
			}
		}
	};

	// free up transaction queue...
	// for (let i = 0, l = keys.length; i < l; i++) {
	// 	delete getTransactions[keys[i]];
	// }
	for (let i = 0, pids = Object.keys(getTransactions), l = keys.length; i < l; i++) {
        let id = pids[i];
        if (!toView[id]) {
            let trans = getTransactions[id];
            if (trans) {
                trans.trans.abort();
                delete getTransactions[id];
            }
        }
	}



	for (let i = 0, l = keys.length; i < l; i++) {
		let key = keys[i];
		let e = toView[key];
		let pid = Number(key);
		let pc = alreadyInDom(pid);
		let img;
		if (!pc) {
  			if (cachedTiles[key]) {
  				pc = cachedTiles[key];
  			} else {
  				pc = document.createElement('div');

				pc.dataset.pid = key;
				img = document.createElement('img');
				img.className = 'bagprop';
                let trans = getTransactions[key];
                if (trans) {
                    trans.img = img;
                } else {
                    getBagProp(pid,img);
                }
				pc.appendChild(img);
  			}
			if (Number(pc.dataset.size) !== tileSize) {
				pc.style.width = tileSize+'px';
				pc.style.height = tileSize+'px';
				pc.dataset.size = tileSize;
			}

			if (Number(pc.dataset.left) !== e.x || Number(pc.dataset.top) !== e.y) {
				pc.style.transform = 'translate('+e.x+'px,'+e.y+'px)';
				// pc.style.left = e.x + 'px';
				// pc.style.top = e.y + 'px';
				pc.dataset.left = e.x;
				pc.dataset.top = e.y;
			}

			propBag.appendChild(pc);
		}
		pc.className = selectedBagProps.indexOf(pid) > -1?'selectedbagprop':'';
	}
}

(function () { // setup propBag

    function getParent(target) { // adding function to element! lol
		if (target.constructor === HTMLDivElement || target.constructor === HTMLImageElement) {
			if (target.constructor === HTMLImageElement) return target.parentNode;
			return target;
		}
	}

	propBag.onscroll = function() {
		refreshPropBagView();
	};
	let lastDragOver;
	propBag.ondragover = function(event) {
        event.preventDefault();
		event.stopImmediatePropagation();
		if (dragBagProp) {
			if (lastDragOver) lastDragOver.style.borderRight = '';
			let target = getParent(event.target);
			if (target) {
                let pid = Number(target.dataset.pid);
				let fromIndex = propBagList.indexOf(dragBagProp.id);
				let toIndex = propBagList.indexOf(pid);
                if (fromIndex > toIndex) {
                    target.style.borderLeft = '2px dashed black';
                } else {
                    target.style.borderRight = '2px dashed black';
                }

				lastDragOver = target;
			}
			event.dataTransfer.effectAllowed = 'move';
			//event.dataTransfer.dropEffect = 'move';
		} else {
			this.style.boxShadow = '0px 0px 1px 10px LawnGreen inset';
		}


	};
	propBag.addEventListener("drop",function(event) {
		if (!dragBagProp) {
			this.style.boxShadow = '';
			var dt = event.dataTransfer;
			if (dt.items) {
				for (let i = 0; i < dt.items.length; i++) {
					let item = dt.items[i];
					if (item.kind == "file") {
						createNewProps([item.getAsFile()]);
						return;
					} else if (item.kind === 'string' && item.type === 'text/uri-list') {
						item.getAsString(function(str) {
							httpGetAsync(str,'blob',function(blob) {
								if (blob.type.match(/^image|video/)) {
									createNewProps([blob]);
								}
							});
						});
						return;
					}
				}
			} else if (dt.files && dt.files.length > 0) {
				createNewProps(dt.files);
			}
		} else {
			let target = getParent(event.target);
			if (target) {
				let pid = Number(target.dataset.pid);
				let fromIndex = propBagList.indexOf(dragBagProp.id);
				let toIndex = propBagList.indexOf(pid);
				if (toIndex > -1 && fromIndex > -1) {
					propBagList.splice(toIndex, 0, propBagList.splice(fromIndex, 1)[0]);
                    updatePropBagList();
					refreshPropBagView(true);
				}
			}
		}
	},true);
	propBag.ondragleave = function(event) {
		this.style.boxShadow = '';
		if (lastDragOver) {
			lastDragOver.style.borderRight = '';
            lastDragOver.style.borderLeft = '';
			lastDragOver = null;
		}
	};
	propBag.ondragend = function(event) {
		dragBagProp = null;
		if (lastDragOver) {
            lastDragOver.style.borderRight = '';
            lastDragOver.style.borderLeft = '';
			lastDragOver = null;
		}
	};
	propBag.ondragstart = function(event) {
        let rect = event.target.parentNode.getBoundingClientRect();
        let left = rect.left;
        let top = rect.top;
        //console.log(event.x - left)

		dragBagProp = {
            id:Number(event.target.parentNode.dataset.pid),
            x:event.x - left - 2 - event.target.offsetLeft,
            y:event.y - top - 2 - event.target.offsetTop,
            w:event.target.offsetWidth,
            h:event.target.offsetHeight
        };

		var img = event.target;
		var n = img.parentNode.className;
		img.parentNode.className = '';
		event.dataTransfer.setDragImage(img,dragBagProp.x,dragBagProp.y);
		setTimeout(function() {
			img.parentNode.className = n;
		},0);
	};

	propBag.ondblclick = function(event) {
		if (getParent(event.target).dataset.pid) wearSelectedProps();
	};
	propBag.onmousemove = function(event) {
		if (event.target === this && event.x-this.offsetLeft < 2) {
			this.style.cursor = 'col-resize';
		} else {
			this.style.cursor = 'auto';
		}
	};
	propBag.onmousedown = function(event) {
		var newTarget = getParent(event.target);
		if (event.target.constructor !== HTMLImageElement) {
			event.preventDefault();
		}
		if (newTarget && (newTarget.className == '' || event.shiftKey || platformCtrlKey(event))) {
			var newPid = Number(newTarget.dataset.pid);
			if (newPid != null) {

				var lastPid;
				if (!platformCtrlKey(event)) {
					if (event.shiftKey) lastPid = selectedBagProps[0];
					selectedBagProps = [];
				}

				if (platformCtrlKey(event)) {
					let already = selectedBagProps.indexOf(newPid);
					if (already > -1) {
						selectedBagProps.splice(already,1);
					} else {
						selectedBagProps.push(newPid);
					}
				} else if (!lastPid) {
					selectedBagProps = [newPid];
				} else {
					let lastIdx = propBagList.indexOf(lastPid);
					let newIdx = propBagList.indexOf(newPid);
					let max = Math.max(newIdx,lastIdx);
					let min = Math.min(newIdx,lastIdx);
					selectedBagProps = propBagList.slice(min,max+1);
					if (newIdx < lastIdx) {
						selectedBagProps.reverse();
					}
				}
				refreshPropBagView(true);
				setPropButtons();
			}
		} else if (event.x-this.offsetLeft < 2) {
			event.preventDefault();
			let initialX = event.pageX-window.scrollX;
			let initialW = this.offsetWidth;

			let mouseMovePropBag = (event) => {
				this.style.cursor = 'col-resize';
				event.stopImmediatePropagation();
				let w = initialX-event.x+initialW;
				this.style.width = w+'px';
				setGeneralPref('propBagWidth',w);
				refreshPropBagView();
				return false;
			};
			let mouseUpPropBag = function(event) {
				event.stopImmediatePropagation();
				window.removeEventListener('mouseup',mouseUpPropBag,true);
				window.removeEventListener('mousemove',mouseMovePropBag,true);
			};

			window.addEventListener('mouseup',mouseUpPropBag,true);
			window.addEventListener('mousemove',mouseMovePropBag,true);

		}
	};
})();




class PalaceProp {
    constructor(id,info) {
        this.id = id;
    	if (info) {
    		this.setInfo(info);
    	} else {
    		this.rcounter = 0;
    	}
    	nbrProps++;
    	if (nbrProps > palace.theRoom.nbrRoomProps+66) { // limit props stored in memory
    		for (var k in cacheProps) {
    			if (!palace.theRoom.propInUse(Number(k))) {
                    if (!cachedBagProps[k]) URL.revokeObjectURL(cacheProps[k].src);
    				delete cacheProps[k];
    				nbrProps--;
    			}
    		}
    	}
    }

    get isComplete() {
    	return (this.img && this.img.complete && this.img.naturalWidth > 0);
    }

    showProp() {

        for (let i = 0; i < palace.theRoom.users.length; i++) {
            let user = palace.theRoom.users[i];
            if (user.props.indexOf(this.id) > -1) {
                user.setDomProps(this.id);
            }
        }
        if (palace.theRoom.looseProps.find(function(lp) {return lp.id === this.id},this)) {
            palace.theRoom.reDraw();
        }
    }



    requestPropImage(url) {
    	this.img = document.createElement('img');
        this.img.onload = () => {
            this.showProp();
    	};
        httpGetAsync(url, 'blob', (blob) => {
        		this.img.src = URL.createObjectURL(blob);
                this.blob = blob;
        	}
        );

    }

    loadBlob(blob) {
        this.blob = blob;
        this.img = document.createElement('img');
        this.img.onload = () => {
            this.showProp();
    	};
        if (cachedBagProps[this.id]) { // if objectUrl was already created via the prop bag view
            this.img.src = cachedBagProps[this.id].url;
        } else {
            this.img.src = URL.createObjectURL(blob);
        }

    }

    setInfo(info) {
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
    		this.loadBlob(info.prop.blob);
    	}
    }

    decodePropFlags(flags) {
        if (typeof flags === 'string') {
            flags = parseInt(flags,16).swap16();
        }
    	this.head = Boolean(flags & PROP_HEAD);
    	this.ghost = Boolean(flags & PROP_GHOST);
    	this.animated = Boolean(flags & PROP_ANIMATED);
    	this.bounce = Boolean(flags & PROP_BOUNCE);
    }

    get encodePropFlags() {
    	var flag = PROP_PNG;
    	if (this.head) flag ^= PROP_HEAD;
    	if (this.ghost) flag ^= PROP_GHOST;
    	if (this.animated) flag ^= PROP_ANIMATED;
    	if (this.bounce) flag ^= PROP_BOUNCE;
    	return flag.swap16().toHex();
    }
}


function uploadPropInfo(aProp) {
    httpPostAsync(palace.mediaUrl + 'webservice/props/new/', 'json',
        JSON.stringify({
            props:[
                    {
                        format:aProp.blob.type.split('/')[1],
                        name:aProp.name,
                        size:{w:aProp.w,h:aProp.h},
                        offsets:{x:aProp.x,y:aProp.y},
                        flags:aProp.encodePropFlags,
                        id:aProp.id,
                        crc:0
                    }
                ]
        }),
        function(json) {
            if (json) {
                for (let i = 0; i < json.props.length; i++) {
                    let prop = json.props[i];
                    if (prop.restricted !== true) { // send logmsg about restriction and remove prop from user
                        uploadProp(json.upload_url,prop.id);
                    }
                }
            }
        },
        function(status) {
            logmsg('Prop upload request failed (HTTP ERROR): '+status);
        }
    );
}


function uploadProp(url,pid) {
	var aProp = cacheProps[pid];
	if (aProp.blob && aProp.blob.size > 0) {

        var formData = new FormData();
		formData.append('id', String(pid));
		formData.append('prop', aProp.blob);

		httpPostAsync(url,'json',formData,
            function(json) {
                if (json) {
                    if (json.success !== true) {
                        logmsg('Prop upload failed (server error), prop id: '+pid);
                        if (json.errormsg) logmsg(json.errormsg);
                    }
                } else {
                    logmsg('Prop upload failed (unexpected server response): '+response);
                }
            },
            function(status) { // handle error, maybe retry upload
                logmsg('Prop upload failed (HTTP ERROR): '+status);
            }
        );
	}
}




function loadProps(pids,fromSelf,callback) {
	if (pids && pids.length > 0) {
		var toLoad = {props:[]};
		for (let i = 0; i < pids.length; i++) {
			var pid = Number(pids[i]);
			var aProp = cacheProps[pid];
			if (!aProp) {
				if (propBagList.indexOf(pid) > -1) { // already have it in prop bag?
					cacheBagProp(pid,fromSelf,callback); // potentially upload..
				} else {
					cacheProps[pid] = new PalaceProp(pid);
					toLoad.props.push({id:pid});
				}
			} else if (aProp.rcounter !== undefined && aProp.rcounter > 0 && aProp.rcounter < 12) {
				toLoad.props.push({id:pid});
			} else if (callback) {
                callback();
			}
		}
		if (toLoad.props.length > 0) {
			httpPostAsync(palace.mediaUrl + 'webservice/props/get/', 'json', JSON.stringify(toLoad),
                function(json) { // need to handle possible http error and retry props (store array of requested)
                    if (json) {
                        for (let i = 0; i < json.props.length; i++) {
                            let prop = json.props[i];
                            let aProp = cacheProps[prop.id];
                            if (aProp && aProp.rcounter !== undefined) {
                                if (prop.success === false) {
                                    if (aProp.rcounter === 0) { // only request legacy prop once and only if normal prop request fails.
                                        palace.sendAssetQuery(prop.id);
                                    }
                                    retryProps.props.push(prop.id);
                                    aProp.rcounter++;
                                } else {
                                    delete aProp.rcounter;
                                    aProp.setInfo(prop);
                                    aProp.requestPropImage(json.img_url + aProp.id);
                                }
                            }
                        }

                        if (retryProps.props.length > 0) {
                            setTimeout(function() {
                                loadProps(dedup(retryProps.props));
                                retryProps.delay += 1000;
                                retryProps.props = [];
                            }, retryProps.delay);
                        } else {
                            retryProps.delay = 2500;
                        }
                    }
                },
                function(status) { // handle error, maybe retry upload
                    logmsg('Prop download failed (HTTP ERROR): '+status);
                }
            );
        }
	}
}





function initializePropBagDB() {
	var DBOpenRequest = indexedDB.open("propBag",8);

	DBOpenRequest.onerror = function(event) {
		logmsg('Error loading Prop Bag.');
	};

	DBOpenRequest.onsuccess = function(event) {
		// store the result of opening the database in the db variable.
		// This is used a lot below.
		propBagDB = DBOpenRequest.result;

		var store = propBagDB.transaction("props").objectStore("props");
		var get = store.get('propList');
		get.onsuccess = function() {
			if (get.result) {
				propBagList = get.result.list;
                if (propBag.dataset.state === '1') {
                    refreshPropBagView();
                }
			}
		};

		// var getAllKeysRequest = store.getAllKeys(); // purge props that aren't listed ()
		// getAllKeysRequest.onsuccess = function() {
		// 	if (propBagList.length > 0) {
		// 		let keys = getAllKeysRequest.result;
		// 		let notFound = [];
		// 		keys.forEach(function(key) {
		// 			if (propBagList.indexOf(key) === -1 && typeof key === 'number') {
		// 				notFound.push(key);
		// 			}
		// 		});
		// 		if (notFound.length > 0) {
		// 			logmsg('Purging '+notFound.length+' unlisted props.')
		// 			deletePropsFromDB(notFound);
		// 		}
		// 	}
		// }
	};

	DBOpenRequest.onupgradeneeded = function(event) {
        propBagDB = DBOpenRequest.result;

        if (event.oldVersion < 4) { // initialize db, for some reason i started at version 4, oh well!
    		let store = propBagDB.createObjectStore("props", {keyPath: "id"});
    		let nameIndex = store.createIndex("name", "name", { unique: false });
    		store.put({id: 'propList', list: propBagList});
        }

        if (event.oldVersion < 8) {
            var tx = DBOpenRequest.transaction;
            var store = tx.objectStore("props");

    		var request = store.get('propList');
    		request.onsuccess = function() {
    			let pids = request.result.list;
    			let doNext = function() {
                    let pid = pids.shift();
                    if (pid) {
                        let get = store.get(pid);
                        get.onerror = function() {
                            console.log(get.error);
                            tx.abort();
                        };
                        get.onsuccess = function(event) {
                            let item = get.result;
                            item.prop.blob = dataURItoBlob(item.prop.img);
                            //console.log(item)
                    		delete item.prop.img;
                            let put = store.put(item);
                            put.onerror = function() {
                                console.log(put.error);
                                tx.abort();
                            };
                            doNext();
                    	};
                    }
                };
                doNext();
    		};
            request.onerror = function() {
                console.log(request.error);
            };
            tx.oncomplete = function() {
                console.log('Success converting your prop bag');
            }
        }
	};
}
initializePropBagDB();

function dataURItoBlob(dataURI) { // required for prop bag upgrade
    var arr = dataURI.split(','), mime = arr[0].match(/:(.*?);/)[1];
    var ary = Uint8Array.from(atob(arr[1]), c => c.charCodeAt(0))
    return new Blob([ary], {type:mime});
}

function deletePropsFromDB(propIds) {
	var tx = propBagDB.transaction("props", "readwrite");
	var store = tx.objectStore("props");
	propIds.forEach(function(pid) {
		var index = propBagList.indexOf(pid);
		if (index > -1) {
			propBagList.splice(index,1);
		}
		store.delete(pid);
	});
	store.put({id: 'propList', list: propBagList});
}

function updatePropBagList() {
	var store = propBagDB.transaction("props", "readwrite").objectStore("props");
	store.put({id: 'propList', list: propBagList});
}

function addPropsToDB(props) {
	var tx = propBagDB.transaction("props", "readwrite");
	var store = tx.objectStore("props");

	tx.onerror = function() {
		console.log('Error adding prop to DB: '+tx.error);
	};
	tx.oncomplete = function() {
		refreshPropBagView();
	};

	props.forEach(function(prop) {
		if (propBagList.indexOf(prop.id) < 0 && prop.blob && prop.blob.size > 0) { //does prop exist in the bag already?

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
					blob: prop.blob
				}
			});

			propBagList.unshift(prop.id);
		}
	});

	store.put({id: 'propList', list: propBagList});
	return store;
}




function saveProp(pids,flush) {
    var props = [];
    pids.forEach(function(p) {
        var prop = cacheProps[p];
    	if (prop) {
            props.push(prop)
        }
    });
    addPropsToDB(props);
}

let getTransactions = {};
let cachedBagProps = {}
function getBagProp(id,img) {
    let data = cachedBagProps[id];
    if (!data) {
        //console.log('getting prop from database!')
    	var transaction = propBagDB.transaction("props","readonly");
    	getTransactions[id] = {trans:transaction,img:img};
    	var store = transaction.objectStore("props");
    	var get = store.get(id);
    	get.onsuccess = function(event) {
            let currentImg;
            if (getTransactions[id]) {
                currentImg = getTransactions[id].img;
                delete getTransactions[id];
            } else {
                currentImg = img;
            }
            if (cachedBagProps[id]) return;

            // img.onload = function() {
            //     URL.revokeObjectURL(this.src);
            // };
            let result = get.result;
            let prop = result.prop;
            if (prop.ghost) currentImg.className = 'bagprop ghost';
            currentImg.title = result.name+'\n'+formatBytes(prop.blob.size);//String(prop.size/1000000).match(/^\d+\.0*[1-9]{1}/) + 'mb';
    		currentImg.src = URL.createObjectURL(prop.blob);
            cachedBagProps[id] = {url:currentImg.src,ghost:prop.ghost,title:currentImg.title};
    	};
    	transaction.onabort = function(event) {

    		delete getTransactions[id];
    	};
    } else {
        img.title = data.title;
        if (data.ghost) img.className = 'bagprop ghost';
        img.src = data.url;
    }
}

function formatBytes(bytes,decimals) {
   if(bytes === 0) return '0 Bytes';
   var k = 1000,
       dm = decimals || 2,
       sizes = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
       i = Math.floor(Math.log(bytes) / Math.log(k));
   return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function cacheBagProp(id,toUpload,callback) {
	var store = propBagDB.transaction("props","readonly").objectStore("props");
	var get = store.get(id);
	get.onsuccess = function(event) {
		let aProp = new PalaceProp(id,get.result);
		cacheProps[id] = aProp;
		if (callback) callback();
		if (toUpload) {
			uploadPropInfo(aProp);
		}
	};
}




class GifDecoder {
	constructor(file,start,frame,end) {
		this.worker = new Worker('js/workers/gifextract.js');

		this.worker.addEventListener('message',(e) => {this.message(e)});
		this.worker.addEventListener('error',(e) => {this.error(e)});
		this.worker.postMessage(file);

		this.gifCanvas = document.createElement('canvas');
		this.gifctx = this.gifCanvas.getContext("2d");
		this.tempcanvas = document.createElement('canvas');
		this.tempctx = this.tempcanvas.getContext("2d");

		this.startCallBack = start;
		this.receivedFrameCallBack = frame;
		this.endedCallBack = end;
	}

	message(e) {
		if (e.data.start) {
			this.start(e.data.width,e.data.height,e.data.nbrFrames);
		} else if (e.data.frame) {
			this.processFrame(e.data.frame);
		}
        if (e.data.finished) {
			this.end();
		}
	}

	start(w,h,nbrFrames) {
		this.gifCanvas.width = w;
		this.gifCanvas.height = h;
        // if function returns true abort was requested
		if (this.startCallBack(w,h,nbrFrames)) {
            this.worker.terminate();
        }
	}

	processFrame(frame) {
		if(!this.imgData || frame.width !== this.imgData.width || frame.height !== this.imgData.height){
			this.tempcanvas.width = frame.width;
			this.tempcanvas.height = frame.height;
			this.imgData = this.tempctx.createImageData(this.tempcanvas.width, this.tempcanvas.height);
		}


		this.imgData.data.set(frame.patch);
		this.tempctx.putImageData(this.imgData,0,0);

		let restorer;
		if (frame.disposalType === 3) {
			restorer = this.gifctx.getImageData(0, 0, this.gifCanvas.width, this.gifCanvas.height);
		}

		this.gifctx.drawImage(this.tempcanvas, frame.left, frame.top);

		this.receivedFrameCallBack(this.gifCanvas,frame.transparent,frame.delay);

		if (frame.disposalType === 2) {
			this.gifctx.clearRect(0, 0, this.gifCanvas.width, this.gifCanvas.height);
		} else if (restorer) {
			this.gifctx.putImageData(restorer,0,0);
		}
        delete frame.patch;
	}

    end(e) {
        this.endedCallBack(e);
    }

	error(e) {
		console.log('Gif Decoder errored!');
		console.log(e);
        this.worker.terminate();
		this.end(e);
	}
}



class ImageDown {
	constructor(maxSize,options) {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');

        this.options = options;
        if (!this.options) this.options = {};
        if (!this.ctx.imageSmoothingQuality) { // if no suck option then we will do our own interpolation for high quality image reizing!
            this.worker = new Worker('js/workers/resizeimage.js');
            this.worker.addEventListener('message', (e) => {
                this.receivedMessage(e);
            });
        }
        this.maxSize = maxSize;
		this.callbacks = [];

	}

    set exportAsCanvas(value) {
        this.options.canvas = value;
    }

    set alphaTrim(alpha) {
        this.options.alphaTrim = alpha;
    }

    receivedMessage(e) {
        let response = e.data;
        if (response.pixels) {
            this.setCanvasSize(response.width, response.height);
            response = this.createImageData(response.pixels, response.width,response.height);
            if (this.options.canvas) {
                this.ctx.putImageData(response,0,0);
                response = this.canvas;
            }
            let cb = this.callbacks.shift();
            cb(response);
        } else {
            this.finished();
        }
    }

    createImageData(data,w,h) {
        var imgData = this.ctx.createImageData(w,h);
        imgData.data.set(data);
        return imgData;
    }

    finish(callback) {
        if (this.worker) {
            this.finished = callback;
            this.worker.postMessage(0);
        } else {
            callback();
        }
    }

    resize(src,callback) {
        this.setNewSize(src.width,src.height);
        if (this.worker) {
            this.lanczos(src,callback);
        } else {
            this.native(src,callback);
        }
    }

    setCanvasSize(w,h) {
        var changed = false;
        if (w !== this.canvas.width) {
            this.canvas.width = w;
            changed = true;
        }
        if (h !== this.canvas.height) {
            this.canvas.height = h;
            changed = true;
        }
        return changed;
    }

    lanczos(src,callback) {
        var imgData;

        if (src instanceof HTMLVideoElement) {
            this.setCanvasSize(src.width, src.height);
            this.ctx.drawImage(src,0,0);
            imgData = this.ctx.getImageData(0,0,src.width,src.height);
        } else if (src instanceof HTMLImageElement) {
            if (!this.setCanvasSize(src.width, src.height)) {
                this.ctx.clearRect(0,0,this.width,this.height);
            }
            this.ctx.drawImage(src,0,0);
            imgData = this.ctx.getImageData(0,0,src.width,src.height);
        } else if (src instanceof HTMLCanvasElement) {
            let ctx = src.getContext('2d');
            imgData = ctx.getImageData(0,0,src.width,src.height);
        }



        this.callbacks.push(callback);

        this.worker.postMessage(
            {
				src:imgData,
				width:this.width,
				height:this.height
			},
            [imgData.data.buffer]
        );
    }

	native(src,callback) {
        if (!this.setCanvasSize(this.width, this.height)) {
            this.ctx.clearRect(0,0,this.width,this.height);
        }
        this.ctx.imageSmoothingQuality = 'high';
		this.ctx.drawImage(src,0,0,src.width,src.height,0,0,this.width,this.height);
        if (this.options.canvas) {
            callback(this.canvas);
        } else {
            callback(this.imageData);
        }
	}

    destroy() {
        if (this.worker) {
            this.worker.terminate();
        }
    }

	get imageData() {
		return this.ctx.getImageData(0,0,this.canvas.width,this.canvas.height);
	}

	setNewSize(w,h) {
		if (w > this.maxSize) {
			h = h * (this.maxSize / w);
			w = this.maxSize;
		}
		if (h > this.maxSize) {
			w = w * (this.maxSize / h);
			h = this.maxSize;
		}
		this.width = Math.round(w);
        this.height = Math.round(h);
	}
}

function videoToPng(file,resizer,endedCallBack) {
	let vid = document.createElement('video'),
		sampleInterval = Math.round(1000 / 20),
		frameCount = 0,
		frames = [],
        delays = [];

	vid.defaultMuted = true;

	vid.onloadedmetadata = function() {
        if (this.videoHeight === 0) {
            URL.revokeObjectURL(vid.src);
            vid.src = ''; // abort, no video track
            endedCallBack();
            return;
        }
        resizer.setNewSize(this.videoWidth, this.videoHeight);
		vid.width = this.videoWidth;
		vid.height = this.videoHeight;

	};
	vid.onended = function() {
		resizer.finish(function() {
            encodeAPNG(frames,resizer.width,resizer.height,delays,endedCallBack);
            URL.revokeObjectURL(vid.src);
            this.src = '';
        });
	};
	let doFrame = function() {
		this.oncanplaythrough = null;
		this.onerror = null;
		if (this.currentTime >= this.duration) {
			this.onseeked = null;
		}
		if (frameCount >= 300) {
			vid.onended();
			return;
		}
        resizer.resize(this,
            function(data) { // video, dont-clear buffer canvas, async receive!
                frames.push(data.data.buffer);
                delays.push(sampleInterval);
            }
        );
		this.currentTime = this.currentTime + sampleInterval / 1000;
        frameCount++
		//console.log(Math.round(this.currentTime/this.duration*100) + '% frame:'+(frameCount++));
	};
	vid.oncanplaythrough = doFrame;
	vid.onseeked = doFrame;

	vid.onerror = function() {

        console.log('error with video');
    	resizer.destroy();
		endedCallBack();
	};

	vid.src = URL.createObjectURL(file);
}

function encodeAPNG(frames,w,h,delays,callback) {
    var pngWork = new Worker('js/workers/apng-worker.js');
    pngWork.addEventListener('message', function(e) {
        var blob = new Blob([e.data.buffer],{type:'image/apng'});
        callback(blob,w,h);
    });
    pngWork.addEventListener('error', function(e) {
        this.terminate();
    });
    pngWork.postMessage({frames:frames,width:w,height:h,delays:delays},frames);
}

function gifToPng(file,resizer,endedCallBack) {

	let frames = [],
        delays = [];

	let decoder = new GifDecoder(file,
		function(w,h,nbrFrames) { // start
            if (nbrFrames <= 1) {
                // if gif has only one frame then import as a normal 32bit image
                processImage(file,resizer,endedCallBack);
                return true; // aborts GifDecoder
            }
            resizer.setNewSize(w,h);

		},
		function(image,transparent,delay) { // recieved frame
            resizer.resize(image,function(data) {
                frames.push(data.data.buffer);
                delays.push(delay);
            });
		},
		function(err) { // finished (err should be undefined)
			if (err) {
				endedCallBack();
			} else {
                resizer.finish(function() {
                    encodeAPNG(frames,resizer.width,resizer.height,delays,endedCallBack);
                });
			}
		}
	);

}


function createNewProps(list,finishedCallback) {
	for (var i = 0, files = new Array(list.length); i < list.length; i++) {
		files[i] = list[i]; // moving the list to an actual array so pop works , lol
	}
	var button = document.getElementById('newprops');
	button.className += ' loadingbutton';

    let resizer = new ImageDown(220);

    let port = function(blob,w,h) {
        if (blob) {
            addPropsToDB([createNewProp(blob,w,h)]);
        }
        importFile();

    };

	let importFile = function() {
		if (files.length > 0) {
			let file = files.pop();

			if (file.type == 'image/gif') {
				gifToPng(file,resizer,port); // change so if not animated, processed as regular image
			} else if (file.type.match(/^video\/.*/)){
				videoToPng(file,resizer,port);
			} else {
                processImage(file,resizer,port);
			}
		} else {
            resizer.finish(function() {
                button.className = 'tbcontrol tbbutton';
                resizer.destroy();
                if (finishedCallback) {
                    finishedCallback();
                }
            });
        }
	};
	importFile();
}


function processImage(file,resizer,endedCallBack) {
    let img = document.createElement('img');

    img.onload = function() {
        resizer.resize(this,function(data) {
            endedCallBack(
                new Blob([UPNG.encode([data.data.buffer], resizer.width, resizer.height)],{type:'image/png'}),
                resizer.width,
                resizer.height
            );
        });
        URL.revokeObjectURL(this.src);
    };

    img.onerror = function() {
        endedCallBack();
    };

    img.src = URL.createObjectURL(file);
}


function createNewProp(blob,w,h) {
	let id = 0;

	do {
		id = Math.round(Math.random()*2147483647);
		if (id % 2) id = -id;
	} while (propBagList.indexOf(id) > -1);

	let prop = {
		id:id,
		name:'Palace Prop',
		w:w,
		h:h,
		x:(-Math.trunc(w/2))+22,
		y:(-Math.trunc(h/2))+22,
		head:true,
		ghost:false,
		animated:false,
		bounce:false,
		blob:blob
	};

	return prop;
}

document.onpaste = function(e) {
    var items = e.clipboardData.items;
    for (var i = 0; i < items.length; i++) {
        if (/^image/i.test(items[i].type)) {
            let file = items[i].getAsFile();
            file.type = items[i].type;
            createNewProps([file]);
            return;
        }
    }
}
