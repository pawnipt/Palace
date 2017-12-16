self.importScripts('../lib/pako.min.js');
self.importScripts('../lib/UPNG.js');

self.addEventListener('message', function(e) {

    var ab = UPNG.encode(e.data.frames, e.data.width, e.data.height, 256, e.data.delays);

    self.postMessage({buffer:ab,width:e.data.width,height:e.data.height},[ab]);
    close();
});
