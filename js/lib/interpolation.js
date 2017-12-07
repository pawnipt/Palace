

var ResampleLanczos = (function() {
	var CACHE;
	var CACHE_PRECISION = 1000;
	var FILTER_SIZE = 1;

	var kernels = {
		lanczos: function (size, x) {
			if (x >= size || x <= -size) return 0;
			if (x === 0) return 1;
			var xpi = x * Math.PI;
			return size * Math.sin(xpi) * Math.sin(xpi / size) / (xpi * xpi);
		},
		linear: function(size, x) { //-
			x = Math.abs(x);
			if (x <= 1) return (1 - x) * size;
			return 0;
		}
	};

	function createCache(kernel, cachePrecision, filterSize) {
		var cache = {};
		var max = filterSize * filterSize * cachePrecision;
		var iPrecision = 1.0 / cachePrecision;
		var value;
		for (var cacheKey = 0; cacheKey < max; cacheKey++) {
			value = kernel(filterSize, Math.sqrt(cacheKey * iPrecision));
			cache[cacheKey] = value < 0 ? 0 : value;
		}
		return cache;
	};

	return function(src, width, height, filterSize, kernel) {
		var sdata = src.data;
		var ddata = new Uint8ClampedArray(width*height*4);
		///
		var total, distanceY, value;
		var a, r, g, b;
		var i, color, cacheKey;
		///
		var x, x1, x1b, x1e;
		var y, y1, y1b, y1e, y2, y3;
		var y1et, x1et;
		///
		var values = [];
		var sx = width / src.width;
		var sy = height / src.height;
		var sw1 = src.width - 1;
		var sh1 = src.height - 1;
		var isx = 1.0 / sx;
		var isy = 1.0 / sy;
		var cw = 1.0 / width;
		var ch = 1.0 / height;
		var csx = Math.min(1, sx) * Math.min(1, sx);
		var csy = Math.min(1, sy) * Math.min(1, sy);
		var cx, cy;
		var sourcePixelX, sourcePixelY;
		var cache = CACHE = undefined;
		var cachePrecision = CACHE_PRECISION;
		var filterSize = filterSize || FILTER_SIZE;
		var kernel = kernels[kernel] || kernels.lanczos;
		if (!cache) CACHE = cache = createCache(kernel, cachePrecision, filterSize);
		y = height;

		while (y--) {
			sourcePixelY = (y + 0.5) * isy;
			y1b = sourcePixelY - filterSize;
			if (y1b < 0) y1b = 0;
			y1e = y1et = sourcePixelY + filterSize;
			if (y1e != y1et) y1e = y1et + 1;
			if (y1e > sh1) y1e = sh1;
			cy = y * ch - sourcePixelY;
			y3 = y * width;
			x = width;
			while (x--) {
				sourcePixelX = (x + 0.5) * isx;
				x1b = sourcePixelX - filterSize;
				if (x1b < 0) x1b = 0;
				x1e = x1et = sourcePixelX + filterSize;
				if (x1e != x1et) x1e = x1et + 1;
				if (x1e > sw1) x1e = sw1;
				cx = x * cw - sourcePixelX;
				///
				i = total = 0;
				for (y1 = y1b >> 0; y1 <= y1e; y1++) {
					distanceY = (y1 + cy) * (y1 + cy) * csy;
					for (x1 = x1b >> 0; x1 <= x1e; x1++) {
						total += values[i++] = cache[((x1 + cx) * (x1 + cx) * csx + distanceY) * cachePrecision >> 0] || 0;
					}
				}
				total = 1.0 / total;
				///
				i = a = r = g = b = 0;
				for (y1 = y1b >> 0; y1 <= y1e; y1++) {
					y2 = y1 * src.width;
					for (x1 = x1b >> 0; x1 <= x1e; x1++) {
						value = values[i++] * total;
						idx = ((y2 + x1) >> 0) * 4;
						r += sdata[idx] * value;
						g += sdata[idx + 1] * value;
						b += sdata[idx + 2] * value;
						a += sdata[idx + 3] * value;
					}
				}
				idx = ((x + y3) >> 0) * 4;
				ddata[idx] = r;
				ddata[idx + 1] = g;
				ddata[idx + 2] = b;
				ddata[idx + 3] = a;
			}
		}
		///

		return ddata;
	}
})();

/// NodeJS
if (typeof (module) !== "undefined" && module.exports) {
	module.exports = ResampleLanczos;
}
