self.importScripts('../lib/interpolation.js');


self.addEventListener('message', function(e) {

    if (typeof e.data !== 'object') {
        self.postMessage(e.data); // relay the message
        return;
    }

    //let options = e.data.options;

    let pixels = ResampleLanczos(e.data.src,e.data.width,e.data.height,2); // slightly sharper than 3


    self.postMessage({pixels:pixels,width:e.data.width,height:e.data.height},[pixels.buffer]);

});
