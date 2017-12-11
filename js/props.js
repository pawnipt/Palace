// @flow

var allProps = {},
    nbrProps = 0, // keep record of the number of props loaded into memory because counting allProps object properties is inefficient
    retryProps = {props:[],delay:2500},
    propBagDB;


const   PROP_HEAD = 2,
    	PROP_GHOST = 4,
    	PROP_RARE = 8,
    	PROP_ANIMATED = 16,
    	PROP_BOUNCE = 32,
    	PROP_PNG = 1024;



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
    		for (var k in allProps) {
    			if (!palace.theRoom.propInUse(parseInt(k))) {
                    URL.revokeObjectURL(allProps[k].src);
    				delete allProps[k];
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
        this.img.src = URL.createObjectURL(blob);
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
		formData.append('prop', aProp.blob);

		httpPostAsync(
            url,
            function(response) {
                try {
                    let json = JSON.parse(response);
                    if (json.success !== true) {
                        logmsg('Prop upload failed (server error), prop id: '+pid);
                    }
                }
                catch(err) {
                    logmsg('Prop upload failed (unexpected server response): '+response);
                }
            },function(status,response) { // handle error, maybe retry upload
                logmsg('Prop upload failed (HTTP ERROR): '+status+'\n\n'+response);
            },
            formData
        );
	} else {
		logmsg('Prop '+pid+' failed to upload: image data not available');
	}
}


function downloadPropInfoCallBack(response) { // need to handle possible http error and retry props (store array of requested)
	var propsInfo = JSON.parse(response);

	for (var i = 0; i < propsInfo.props.length; i++) {
		var prop = propsInfo.props[i];
		var aProp = allProps[prop.id];
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
				aProp.requestPropImage(propsInfo.img_url + aProp.id);
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
			} else if (aProp.rcounter !== undefined && aProp.rcounter > 0 && aProp.rcounter < 12) {
				toLoad.props.push({id:pid});
			} else if (callback) {
                callback();
			}
		}
		if (toLoad.props.length > 0) {
			httpPostAsync(
                palace.mediaUrl + 'webservice/props/get/',
                downloadPropInfoCallBack,
                function(status,response) { // handle error, maybe retry upload
                    logmsg('Prop download failed (HTTP ERROR): '+status+'\n\n'+response);
                },
                JSON.stringify(toLoad)
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
		var request = store.get('propList');
		request.onsuccess = function() {
			if (request.result) {
				propBagList = request.result.list;
				//refreshPropBagView();
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
        var prop = allProps[p];
    	if (prop) {
            props.push(prop)
        }
    });
    addPropsToDB(props);
}

let getTransactions = {};
function getBagProp(id,img) {
	var transaction = propBagDB.transaction("props","readonly");
	getTransactions[id] = transaction;
	var store = transaction.objectStore("props");
	var result = store.get(id);
	result.onsuccess = function(event) {
		delete getTransactions[id];
		if (result.result.prop.ghost) img.className = 'bagprop ghost';
        img.onload = function() {
            URL.revokeObjectURL(this.src);
        };
        let prop = result.result.prop.blob;
        img.title = String(prop.size/1000000).match(/^\d+\.0*[1-9]{1}/) + 'mb';
		img.src = URL.createObjectURL(prop);
	};
	transaction.onabort = function(event) {

		delete getTransactions[id];
	};
}

function cacheBagProp(id,toUpload,callback) {
	var store = propBagDB.transaction("props","readonly").objectStore("props");
	var get = store.get(id);
	get.onsuccess = function(event) {
		var aProp = new PalaceProp(id,get.result);
		allProps[id] = aProp;
		if (callback) callback();
		if (toUpload) {
			var p = {
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
            };
			httpPostAsync(
				palace.mediaUrl + 'webservice/props/new/',
				propUploadCallBack,
				function(status,response) {
					logmsg('Prop upload request failed (HTTP ERROR): '+status+'\n\n'+response);
				},
				JSON.stringify(p)
			);
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
        // if function returns true then abort
		if (this.startCallBack(w,h,nbrFrames)) {
            console.log('test abort')
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
		this.end(e);
	}
}



class ImageDown {
	constructor(maxSize,options) {
        this.options = options;
        if (!this.options) this.options = {};
        if (!this.options.noWorker) {
            this.worker = new Worker('js/workers/resizeimage.js');
            this.worker.addEventListener('message', (e) => {
                this.receivedMessage(e);
            });
        }
        this.maxSize = maxSize;
		this.callbacks = [];
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
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
            if (this.options.alphaTrim) {
                this.trimAlpha(response.pixels,this.options.alphaTrim);
            }
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
        if (this.options.filter) {
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
				height:this.height,
                options:this.options
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
            let imgData = this.ctx.getImageData(0,0,this.width,this.height);
            if (this.options.alphaTrim) {
                this.trimAlpha(imgData.data,this.options.alphaTrim);
            }
            callback(imgData);
        }
	}

    trimAlpha(pixels,alpha) {
        for (let i = 3, len = pixels.length; i < len; i += 4) {
            if (pixels[i] < alpha) {
                pixels[i] = 0; // drop semi transparent pixels
            }
        }
    }

    destroy() {
        if (this.worker) {
            this.worker.terminate();
        }
    }

	get result() {
		return this.canvas;
	}

	dataUrl(mime) {
		return this.canvas.toDataURL(mime);
	}

	get imageData() {
		return this.ctx.getImageData(this.canvas.width,this.canvas.height);
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

function processVideo(file,dither,resizer,endedCallBack) {
	let vid = document.createElement('video'),
		sampleInterval = Math.round(1000 / 20),
		frameCount = 0,
		gifEncoder;

	vid.defaultMuted = true;

	vid.onloadedmetadata = function() {
        if (this.videoHeight === 0) {
            vid.src = ''; // abort, no video track
            endedCallBack();
            return;
        }
        resizer.setNewSize(this.videoWidth, this.videoHeight);
		vid.width = this.videoWidth;
		vid.height = this.videoHeight;
		gifEncoder = new GIF({
			workers: 3,
			quality: 5,
			width:resizer.width,
			height:resizer.height,
			workerScript: 'js/workers/gif.worker.js',
			dither: dither,
			globalPalette: false
		});
		gifEncoder.on('finished', function(blob) {
			endedCallBack(blob,gifEncoder.options.width,gifEncoder.options.height);
		});
	};
	vid.onended = function() {
		this.src = ''
		resizer.finish(function() {
			gifEncoder.render();
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
                gifEncoder.addFrame(data,{delay:sampleInterval});
            }
        );
		this.currentTime = this.currentTime + sampleInterval / 1000;
        frameCount++
		//console.log(Math.round(this.currentTime/this.duration*100) + '% frame:'+(frameCount++));
	};
	vid.oncanplaythrough = doFrame;
	vid.onseeked = doFrame;

	vid.onerror = function() {
		if (gifEncoder) {
            gifEncoder.abort();
        }
        console.log('error with video');
    	resizer.destroy();
		endedCallBack();
	};

	vid.src = file.path;
}

function processGif(file,dither,resizer,endedCallBack) {

	let gifEncoder;

	let decoder = new GifDecoder(file,
		function(w,h,nbrFrames) { // start
            if (nbrFrames === 1) {
                // if gif has only one frame then import as a normal 32bit image
                resizer.alphaTrim = false;
                resizer.exportAsCanvas = true;
                processImage(file,resizer,endedCallBack);
                return true; // aborts GifDecoder
            }
            resizer.setNewSize(w,h);
			gifEncoder = new GIF({
				workers: 3,
				quality: 5,
				width:resizer.width,
				height:resizer.height,
				workerScript: 'js/workers/gif.worker.js',
				dither: dither, //FloydSteinberg-serpentine
				globalPalette: false
		 	});

		 	gifEncoder.on('finished', function(blob) {
				endedCallBack(blob,gifEncoder.options.width,gifEncoder.options.height);
			});
		},
		function(image,transparent,delay) { // recieved frame
            resizer.resize(image,function(data) {
                gifEncoder.setOption('transparent',transparent);
    			gifEncoder.addFrame(data, {delay:delay});
            });
		},
		function(err) { // finished (err should be undefined)
			if (err) {
				endedCallBack();
				gifEncoder.abort();
    			gifEncoder.frames = [];
			} else {
                resizer.finish(function() {
                    gifEncoder.render();
                });
			}
		}
	);

}


function createNewProps(list) {
	for (var i = 0, files = new Array(list.length); i < list.length; i++) {
		files[i] = list[i]; // moving the list to an actual array so pop works , lol
	}
	var button = document.getElementById('newprops');
	button.className += ' loadingbutton';



    let resizer = new ImageDown(220); // use {filter:'lanczos'} for firefox later
    let dither = false;//'FloydSteinberg'; //FloydSteinberg-serpentine

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
                resizer.alphaTrim = 85;
                resizer.exportAsCanvas = false;
				processGif(file,dither,resizer,port); // change so if not animated, processed as regular image
			} else if (file.type.match(/^video\/.*/)){
                resizer.exportAsCanvas = false;
				processVideo(file,dither,resizer,port);
			} else {
                resizer.exportAsCanvas = true;
                processImage(file,resizer,port);
			}
		} else {
            resizer.finish(function() {
                button.className = 'tbcontrol tbbutton';
                resizer.destroy();
            });
        }
	};
	importFile();


}


function processImage(file,resizer,endedCallBack) {
    let img = document.createElement('img');

    img.onload = function() {
        resizer.resize(this,function(canvas) {
            canvas.toBlob(function(blob) {
                endedCallBack(blob,canvas.width,canvas.height);
            });
        });
    };

    img.onerror = function() {
        endedCallBack();
    };

    img.src = file.path;
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

document.onpaste = function(e){
	var loadImage = function (file,type) {
		var reader = new FileReader();
		reader.onload = function(e){
			createNewProps([{path:e.target.result,type:type}]);
		};
		reader.readAsDataURL(file);
	};
    var items = e.clipboardData.items;
    for (var i = 0; i < items.length; i++) {
        if (/^image/i.test(items[i].type)) {
            loadImage(items[i].getAsFile(),items[i].type);
            return;
        }
    }
}
