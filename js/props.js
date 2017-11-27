// @flow

var allProps = {},
    nbrProps = 0, // keep record of the number of props loaded into memory because counting allProps object properties is inefficient
    retryProps = [];


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
    				delete allProps[k];
    				nbrProps--;
    			}
    		}
    	}
    }

    get isComplete() {
    	return (this.img && this.img.complete && this.img.naturalWidth > 0);
    }

    requestPropImage(url) {
    	this.img = document.createElement('img');
    	this.img.onload = () => {
    		for (var i = 0; i < palace.theRoom.users.length; i++) {
    			var user = palace.theRoom.users[i];
    			if (user.props.indexOf(this.id) > -1 && (this.animated || this.head)) user.animator();
    		}
    		palace.theRoom.reDraw();
    	};
    	this.img.src = url;
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
    		this.requestPropImage(info.prop.img);
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
		var d = atob(getImageData(aProp.img).replace(/^data:image\/png;base64,/, ""));
		var l = d.length;
		var array = new Uint8Array(l);
        for (var i = 0; i < l; i++) {
            array[i] = d.charCodeAt(i);
        }
		var blob = new Blob([array], { type: 'application/octet-stream'});
		formData.append('prop', blob);
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
				retryProps.push(prop.id);
				aProp.rcounter++;
			} else {
				delete aProp.rcounter;
				aProp.setInfo(prop);
				aProp.requestPropImage(propsInfo.img_url + aProp.id);
			}
		}
	}

	if (retryProps.length > 0) {
		setTimeout(function() {
			loadProps(retryProps.dedup());
			retryProps = [];
		}, 3200);
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
			} else if (aProp.rcounter !== undefined && aProp.rcounter > 0 && aProp.rcounter < 9) {
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
