self.importScripts('../includes/gifuct.js');


self.addEventListener('message', function(e) {
	if (e.data) {
		let reader = new FileReader();
		reader.onload = function(event) {
			var gif = new GIF(event.target.result);
			self.postMessage({width:gif.raw.lsd.width,height:gif.raw.lsd.height,frames:gif.decompressFrames()});

		};
		reader.onerror = function(err) {
			console.log(err);
			self.postMessage(err);
		};
		reader.readAsArrayBuffer(e.data);
	}

});
