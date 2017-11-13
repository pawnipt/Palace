function donprop(pid) {
	if (palace.addSelfProp(pid)) {
		palace.selfPropChange();
		loadProps([pid],true);
	}
}

function removeprop(pid) {
	if (palace.removeSelfProp(pid)) {
		palace.selfPropChange();
		loadProps(palace.theUser.props,true);
	}
}

function localmsg(msg) {
	PalaceUser.userChat({chatstr:String(msg)});
}

function setprops(pids) {
	if (palace.theUser && palace.theUser.changeUserProps(pids,true)) palace.selfPropChange();
}

function gotoroom(id) {
	palace.sendRoomNav(id);
}

function setpos(x,y) {
	if (x < 22) x = 22;
	if (y < 22) y = 22;
	if (x > bgEnv.width-22) x = bgEnv.width-22;
	if (y > bgEnv.height-22) y = bgEnv.height-22;
	palace.sendUserLocation(x,y);
	palace.theRoom.userMove(palace.theUserID,x,y);
}

function move(x,y) {
	if (palace.theUser) setpos(palace.theUser.x+x,palace.theUser.y+y);
}

function gotourl(url) {
	//window.status = 'setname '+getGeneralPref('userName'); ??
	var blah = url.trim().replace('palace://','').split(':'); //should use forgiving regex
	palace.retryRegistration = false;
	palace.connect(blah[0],blah[1]);
}

function datetime() {
	return Math.trunc(microseconds()/1000);
}

function ticks() {
	return Math.trunc(microseconds()/16.666666666666667);
}
