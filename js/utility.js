const shell = require('electron').shell;

function getHsl(color,lightness) {
	return 'hsl('+(22.5*color)+',50%,'+lightness+'%)';
}
Buffer.prototype.pString = function(offset) {
	return windows1252.decode(this.toString('binary',offset+1,offset+1+this.readUInt8(offset)));
};	
Buffer.prototype.cString = function(offset) {
	return windows1252.decode(this.toString('binary',offset,this.indexOf(0,offset)));
};
Array.prototype.dedup = function() {
	return this.filter(
				function(e,i,a) {
					return a.indexOf(e) == i;
				}
			);
};
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}
function getRandomIntInclusive(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive 
}
String.prototype.getNbrs = function() {
	return this.match(/([.0-9]+)/g);
};
function microseconds() {
	var d = new Date();
    return d.getTime();
}
function hslToRgb(h, s, l) {
	var r, g, b;

	if(s == 0){
		r = g = b = l; // achromatic
	}else{
		var hue2rgb = function hue2rgb(p, q, t){
			if(t < 0) t += 1;
			if(t > 1) t -= 1;
			if(t < 1/6) return p + (q - p) * 6 * t;
			if(t < 1/2) return q;
			if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
			return p;
		}

		var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		var p = 2 * l - q;
		r = hue2rgb(p, q, h + 1/3);
		g = hue2rgb(p, q, h);
		b = hue2rgb(p, q, h - 1/3);
	}

	/* return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]; */
	return [r * 255, g * 255, b * 255];
}
function rgbToHsl(r, g, b){
	r /= 255, g /= 255, b /= 255;
	var max = Math.max(r, g, b), min = Math.min(r, g, b);
	var h, s, l = (max + min) / 2;

	if(max == min){
		h = s = 0; // achromatic
	}else{
		var d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch(max){
			case r: h = (g - b) / d + (g < b ? 6 : 0); break;
			case g: h = (b - r) / d + 2; break;
			case b: h = (r - g) / d + 4; break;
		}
		h /= 6;
	}

	return [h, s, l];
}
Number.prototype.swap16 = function() {
    return ((this & 0xFF) << 8) | ((this >> 8) & 0xFF);
};
Number.prototype.toHex = function() {
	var hex = this.toString(16);
    if (hex.length % 2) return "0" + hex;
	return hex;
};
Number.prototype.fastRound = function() {
	return (0.5 + this) | 0;
};
function toHex(str) {
	var hex = '';
	for(var i=0;i<str.length;i++) {
		var s = str.charCodeAt(i).toString(16);
		if (s.length < 1) localmsg('length wrong '+s.length);
		if (s.length % 2) s = "0" + s;
		
		hex += ''+s;
	}
	return hex;
}
function makeHyperLinks(str) { /* fix this, oddly; numbers fail! */
	var parts = str.split(linkSearch);
	var l = parts.length;
	var s = document.createElement('span');
	if (l > 1) {
		for (var i = 0; i < l; i++) {
			var part = parts[i];
			if (part.length > 0) {
				var txt = document.createTextNode(part);
				if (linkSearch.test(part)) {
					var a = document.createElement('a');
					a.tabIndex = -1;
					a.onfocus=function(){this.blur()};
					a.addEventListener('click', function (e) {
						e.preventDefault();
						shell.openExternal(this.href);
					});
					a.appendChild(txt);
					a.href = part;
					s.appendChild(a);
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
function roundRect(ctx, x, y, width, height, radius, fill, stroke) { /* optimize me please */
	if (typeof stroke == 'undefined') {
		stroke = true;
	}
	if (typeof radius === 'undefined') {
		radius = 5;
	}
	if (typeof radius === 'number') {
		radius = {tl: radius, tr: radius, br: radius, bl: radius};
	} else {
		var defaultRadius = {tl: 0, tr: 0, br: 0, bl: 0};
		for (var side in defaultRadius) {
			radius[side] = radius[side] || defaultRadius[side];
		}
	}
	ctx.beginPath();
	ctx.moveTo(x + radius.tl, y);
	ctx.lineTo(x + width - radius.tr, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
	ctx.lineTo(x + width, y + height - radius.br);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
	ctx.lineTo(x + radius.bl, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
	ctx.lineTo(x, y + radius.tl);
	ctx.quadraticCurveTo(x, y, x + radius.tl, y);
	ctx.closePath();
	if (fill) {
		ctx.fill();
	}
	if (stroke) {
		ctx.stroke();
	}
}
function rectsOverlap(x1,y1,w1,h1,x2,y2,w2,h2) {
	return (x1>=x2+w2 || x1+w1<=x2 || y1>=y2+h2 || y1+h1<=y2)==false;
}
function rectsOverlapObj(r1,r2) {
	return (r1.x>=r2.x+r2.w || r1.x+r1.w<=r2.x || r1.y>=r2.y+r2.h || r1.y+r1.h<=r2.y)==false;
}
function calculateAspectRatioFit(srcWidth, srcHeight, maxWidth, maxHeight) {
	var ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
	return {w:srcWidth*ratio, h:srcHeight*ratio};
}
function calculateAspectRatio(w,h,newSize) {
	if (w > newSize) {
		h=h*(newSize/w);
		w=newSize;
	}
	if (h > newSize) {
		w=w*(newSize/h);
		h=newSize;
	}
	return {w:w,h:h};
}
function httpPostAsync(theUrl, callback, postContent) {
	var xmlHttp = new XMLHttpRequest();
	xmlHttp.onload = function() {
		if (xmlHttp.status == 200) callback(xmlHttp.responseText);
	}
	xmlHttp.open("POST", theUrl, true);
	xmlHttp.send(postContent);
}

function httpGetAsync(theUrl, callback, rtype) {
	var xmlHttp = new XMLHttpRequest();
	if (rtype) xmlHttp.responseType = rtype;
	xmlHttp.onload = function() {
		if (xmlHttp.status == 200) callback(xmlHttp.responseText);
	}
	xmlHttp.open("GET", theUrl, true);
	xmlHttp.send();
}
function getImageData(img) {
	if (img.length > 0) return img;
	if (/^data/.test(img.src)) return img.src; // if img is already a data url pass it along!
    var canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d").drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
}

function getTextHeight(font) {
	var div = document.createElement("div");
	div.textContent = '/y]T|\\';
	div.style.position = 'absolute';
	div.style.top  = '-9999px';
	div.style.left = '-9999px';
	div.style.font = font;
	document.body.appendChild(div);
	var h = div.offsetHeight;
	document.body.removeChild(div);
	return h;
}
function parseURL(url) {
	var parser = document.createElement('a');
	parser.href = url; //"http://example.com:3000/pathname/?search=test#hash";
/* 
	parser.protocol; // => "http:"
	parser.host;     // => "example.com:3000"
	parser.hostname; // => "example.com"
	parser.port;     // => "3000"
	parser.pathname; // => "/pathname/"
	parser.hash;     // => "#hash"
	parser.search;   // => "?search=test"
	parser.origin;   // => "http://example.com:3000"
 */
	return parser;
}
function max(a, b) { return a ^ ((a ^ b) & -(a < b)); }
function min(a, b) { return b ^ ((a ^ b) & -(a < b)); }