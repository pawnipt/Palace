self.importScripts('../lib/gifuct.js');

self.addEventListener('message', function(e) {
	if (e.data) {
		var reader = new FileReader();
		reader.onload = function(event) {
			let gif = new GIF(event.target.result);
			//var color = gif.raw.gct[gif.raw.lsd.backgroundColorIndex];

            self.postMessage(
				{
					start:true,
					width:gif.raw.lsd.width,
					height:gif.raw.lsd.height
				//	background: {r:color[0],g:color[1],b:color[2]}
				}
			);

            var indexes = [];
            for (let i = 0; i < gif.raw.frames.length; i++) {
                if (gif.raw.frames[i].image) indexes.push(i);
            }

            var lastIndex = indexes[indexes.length-1];
            indexes.forEach(function(i) {
                let frame = gif.decompressFrame(i);
				let finished = (lastIndex === i);
                self.postMessage({frame:frame,finished:finished},[frame.patch.buffer]);
				if (finished) {
					close();
				}
            });
		};
		reader.onerror = function(err) {
			console.log(err);
			self.postMessage(err);
		};
		reader.readAsArrayBuffer(e.data);
	}

});
