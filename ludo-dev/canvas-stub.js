// A recording stand-in for CanvasRenderingContext2D.
// Every drawing call is counted; the few methods with return values that the
// renderer actually consumes (gradients, measureText) hand back usable objects
// so the draw code runs to completion instead of throwing on undefined.
module.exports = function makeCanvasStub(w, h) {
    const calls = {};
    const gradient = { addColorStop() {} };
    const bump = k => { calls[k] = (calls[k] || 0) + 1; };

    const ctx = new Proxy({}, {
        get: (_, k) => {
            if (k === 'canvas') return { width: w, height: h };
            if (k === 'createLinearGradient' || k === 'createRadialGradient') {
                return () => { bump(k); return gradient; };
            }
            if (k === 'createPattern') return () => { bump(k); return gradient; };
            if (k === 'measureText') {
                return s => { bump(k); return { width: String(s).length * 6.2 }; };
            }
            if (k === 'getImageData') {
                return () => { bump(k); return { data: new Uint8ClampedArray(4) }; };
            }
            return () => bump(k);
        },
        set: (_, k) => { bump('set:' + k); return true; },
    });

    return { ctx, calls };
};
