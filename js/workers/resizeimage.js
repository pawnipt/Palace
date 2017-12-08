self.importScripts('../lib/interpolation.js');


self.addEventListener('message', function(e) {

    if (typeof e.data !== 'object') {
        self.postMessage(e.data); // relay the message
        return;
    }

    let pixels;
    let options = e.data.options;
    switch(options.filter) {
        case'linear':
            pixels = ResampleLanczos(e.data.src,e.data.width,e.data.height,3,options.filter);
            break;
        case'lanczos':
            pixels = ResampleLanczos(e.data.src,e.data.width,e.data.height,3);
            break;
    }


    if (options.trimAlpha) {
        let alpha = options.trimAlpha;
		for (let i = 3, len = pixels.length; i < len; i += 4) {
			if (pixels[i] < alpha) {
				pixels[i] = 0; // drop semi transparent pixels
			}
		}
    }

    self.postMessage({pixels:pixels,width:e.data.width,height:e.data.height},[pixels.buffer]);

});
