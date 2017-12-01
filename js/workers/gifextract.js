self.importScripts('../includes/gifuct.js');


self.addEventListener('message', function(e) {
	if (e.data) {
		var reader = new FileReader();
		reader.onload = function(event) {
			var gif = new GIF(event.target.result);

            self.postMessage({width:gif.raw.lsd.width,height:gif.raw.lsd.height});

            var indexes = [];
            for (let i = 0; i < gif.raw.frames.length; i++) {
                if (gif.raw.frames[i].image) indexes.push(i);
            }

            var lastIndex = gif.raw.frames.length-1;
            indexes.forEach(function(i) {
                var frame = gif.decompressFrame(i, true);
                self.postMessage({frame:frame,finished:(lastIndex === i)},[frame.patch.buffer]);
            });

		};
		reader.onerror = function(err) {
			console.log(err);
			self.postMessage(err);
		};
		reader.readAsArrayBuffer(e.data);
	}

});
