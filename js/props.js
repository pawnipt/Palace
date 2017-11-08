var allProps = {},
    nbrProps = 0, // keep record of the number of props loaded into memory because counting allProps object properties is inefficient
    retryProps = [];

var mCanvas = document.createElement('canvas'); /* offscreen buffer for pixel detection */
mCanvas.width = 220;
mCanvas.height = 220;
var mCtx = mCanvas.getContext('2d');
function mouseOverProp(aProp,x,y,px,py) { // maybe store props as canvas instead...
	mCtx.clearRect(0,0,mCanvas.width,mCanvas.height);
	mCtx.drawImage(aProp.img,0,0,aProp.w,aProp.h);
	return (mCtx.getImageData((x-px),(y-py),1,1).data[3] > 0);
}


class PalaceProp {
    constructor(id,info) {
        this.id = id;
    	if (info) {
    		this.setInfo(info);
    	} else {
    		this.rcounter = 0;
    	}
    	nbrProps++;
    	if (nbrProps > nbrRoomProps()+66) { // limit props stored in memory
    		for (var k in allProps) {
    			if (!propInUse(parseInt(k))) {
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
    	var p = this;
    	this.img = document.createElement('img');
    	this.img.onload = function(){
    		for (var i = 0; i < theRoom.users.length; i++) {
    			var user = theRoom.users[i];
    			if (user.props.indexOf(p.id) > -1 && (p.animated || p.head)) user.animator();
    		}
    		reDraw();
    		p = null;
    		this.onload = null;
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
    	var i = parseInt(flags,16).swap16();
    	this.head = Boolean(i & propConsts.head);
    	this.ghost = Boolean(i & propConsts.ghost);
    	this.animated = Boolean(i & propConsts.animated);
    	this.bounce = Boolean(i & propConsts.bounce);
    }

    get encodePropFlags() {
    	var flag = propConsts.png;
    	if (this.head) flag ^= propConsts.head;
    	if (this.ghost) flag ^= propConsts.ghost;
    	if (this.animated) flag ^= propConsts.animated;
    	if (this.bounce) flag ^= propConsts.bounce;
    	return flag.swap16().toHex();
    }
}






function nbrRoomProps() {
	var count = 0;
	for (var i = 0; i < theRoom.users.length; i++)
		count += theRoom.users[i].props.length;
	count += theRoom.looseProps.length;
	return count;
}

function propInUse(id) {
	for (var i = 0; i < theRoom.users.length; i++)
		for (var j = 0; j < theRoom.users[i].props.length; j++)
			if (theRoom.users[i].props[j] == id) return true;
	for (var o = 0; o < theRoom.looseProps.length; o++)
			if (theRoom.looseProps[o].id == id) return true;
	return false;
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
        for (var i = 0; i < l; i++) array[i] = d.charCodeAt(i);
		var blob = new Blob([array], { type: 'application/octet-stream'});
		formData.append('prop', blob);
		httpPostAsync(url,propImageUploadCallBack,formData);
	} else {
		localmsg('Prop '+pid+' failed to upload: image data not available');
	}
}


function propImageUploadCallBack(response) { // add error handling!
	/* logmsg('response: '+response); */
}

function downloadPropInfoCallBack(response) { // need to handle possible http error and retry props (store array of requested)
	var propsInfo = JSON.parse(response);

	for (var i = 0; i < propsInfo.props.length; i++) {
		var prop = propsInfo.props[i];
		var aProp = allProps[prop.id];
		if (aProp) {
			if (prop.success === false) {
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

function clearFailedProps() {
	// loop allProps and clear props that haven't loaded; when the user logs onto a new server

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
			} else {
				if (callback) callback();
			}
		}
		if (toLoad.props.length > 0)
			httpPostAsync(mediaUrl + 'webservice/props/get/',downloadPropInfoCallBack,JSON.stringify(toLoad));
	}
}
