
var SHADERS = (function() {
    var RAD = 5;
    var SIZE = 2*RAD + 1;
    function sampleGen() {
        var res = '  float kern['+(SIZE*SIZE)+'];\n';

        var i = 0;
        for (var y = -RAD; y <= RAD; y++) {
            for (var x = -RAD; x <= RAD; x++) {
                res += "  kern["+i+"] = texture2D(uState, vPosition + uPixelSize * "+
                    "vec2(" + x.toFixed(1) + "," + y.toFixed(1) + ")).r;\n";
                i++;
            }
        }
        return res;

    }
    function convGen() {
        function clamp(x) {
            return x < 0 ? 0 : x > 1 ? 1 : x;
        }
        function min(a, b) {
            return a < b ? a : b;
        }
        function makeKernel(rad, a, b) {
            var kernel = new Array(SIZE * SIZE);
            var i = 0, sum = 0;
            for (var y = -rad; y <= rad; y++) {
                for (var x = -rad; x <= rad; x++) {
                    var dist = Math.sqrt(x*x + y*y);
                    sum += kernel[i++] = clamp(0.5 * min(dist - a, b - dist));
                }
            }
            for (i = 0; i < kernel.length; i++) {
                kernel[i] /= sum;
            }
            return kernel;
        }


        var sep = 0.4;
        var kernel1 = makeKernel(RAD, -2, sep * RAD);
        var kernel2 = makeKernel(RAD, sep * RAD, RAD + 0.5);

        var res = '';
        function genConvolution(acc, data, kernel) {
            res += '  float ' + acc + ' = 0.0;\n';
            var chech = 0;
            for (var i = 0; i < kernel.length; i++) {
                chech += kernel[i];
                if (kernel[i] > 0) {
                    res += '  ' + acc + ' += ' + kernel[i] + ' * ' + data + '[' + i + '];\n';
                }
            }
            if (Math.abs(chech-1) > 0.00001) throw "arrgh";
        }

        genConvolution('iInner', 'kern', kernel1);
        genConvolution('iOuter', 'kern', kernel2);
        return res;
    }

    return {
        vComp: [
            "precision highp float;",
            "",
            "attribute vec2 aPosition;",
            "varying vec2 vPosition;",
            "",
            "void main() {",
            "  vPosition = aPosition;",
            "  gl_Position = vec4(",
            "    aPosition.x * 2.0 - 1.0,",
            "    aPosition.y * 2.0 - 1.0,",
            "    0.0, 1.0);",
            "}"
        ].join('\n'),
        generator: convGen,
        fIter: [
            "precision mediump float;",
            "",
            "varying vec2 vPosition;",
            "uniform sampler2D uState;",
            "uniform vec2 uPixelSize;",
            "uniform vec4 uCoeff;",
            "uniform vec4 uCoeff2;",
            "uniform float uDt;",
            "float velocity(float neig, float self, float center) {",
            "  neig *= 8.0;",
            "  return  (self- center) * uCoeff2.x + mix(",
            "    min((neig - uCoeff.x) , (uCoeff.y - neig)),",
            "    min((neig - uCoeff.z) , (uCoeff.w - neig)), self);",
            "}",
            "void main() {",
            "  float center = texture2D(uState, vPosition).r;",
            sampleGen(),
            convGen(),
            "  ",
            "  float n = clamp(center + uDt * velocity(iOuter, iInner, center), 0.0, 1.0);",
            "  gl_FragColor = vec4(n, n, n, 1.0);",
            "}"
        ].join('\n'),

        fIden: [
            "precision mediump float;",
            "",
            "varying vec2 vPosition;",
            "uniform sampler2D uTexture;",
            "void main() {",
            "  float s = texture2D(uTexture, vPosition).r;",
            "  gl_FragColor = vec4(s * 2.0 - 1.3, s * 2.0, s * 2.0 - 0.6, 1.0);",
            "}"
        ].join('\n')

    };
})();
