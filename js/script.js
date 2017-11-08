function donprop(pid) {
	if (addSelfProp(pid)) {
		userPropChange();
		loadProps([pid],true);
	}
}

function removeprop(pid) {
	if (removeSelfProp(pid)) {
		userPropChange();
		loadProps(theUser.props,true);
	}
}

function localmsg(msg) {
	PalaceUser.userChat({chatstr:String(msg)});
}

function setprops(pids) {
	if (theUser && theUser.changeUserProps(pids,true)) userPropChange();
}

function gotoroom(id) {
	palaceTCP.sendRoomNav(id);
}

function setpos(x,y) {
	if (x < 22) x = 22;
	if (y < 22) y = 22;
	if (x > bgEnv.width-22) x = bgEnv.width-22;
	if (y > bgEnv.height-22) y = bgEnv.height-22;
	palaceTCP.sendUserLocation(x,y);
	PalaceUser.userMove(theUserID,x,y);
}

function move(x,y) {
	if (theUser) setpos(theUser.x+x,theUser.y+y);
}

function gotourl(url) {
	//window.status = 'setname '+getGeneralPref('userName'); ??
	var blah = url.trim().replace('palace://','').split(':'); //should use forgiving regex
	palaceTCP.retryRegistration = false;
	palaceTCP.connect(blah[0],blah[1]);
}

function datetime() {
	return Math.trunc(microseconds()/1000);
}

function ticks() {
	return Math.trunc(microseconds()/16.666666666666667);
}
