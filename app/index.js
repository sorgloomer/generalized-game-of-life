

function main() {
    var canvas, gl;
    var W = 256, H = 256;
    var buffers;
    var vbSquare;
    var shaders = {};

    function NBuffer(n, cb) {
        var _this = this, buffers = [];
        for (var i = 0; i < n; i++) {
            buffers.push(cb(i));
        }

        this.n = n;
        this.buffers = buffers;
        this.index = 0;
        this.swap = swap;
        this.delta = delta;
        this.prev = prev;
        this.current = current;

        function swap() {
            _this.index = ((_this.index + 1) % _this.n) | 0;
            return current();
        }

        function current() { return _this.buffers[_this.index]; }
        function prev() { return delta(1); }
        function delta(i) { return _this.buffers[mod(_this.index - i, _this.n)];  }
        function mod(x, m) { return (((x % m) + m) % m); }
    }

    function createTexture() {
        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
            W, H, 0);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return texture;
    }

    function makeDataTex() {
        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        return texture;
    }

    function randomInt(max) {
        return Math.floor(Math.random() * (max - 0.00001));
    }

    function createRandomTexture() {
        var bitmap = new Uint8Array(W * H * 4);
        var i;
        for (i = 0; i < bitmap.length; ++i) {
            var x = (Math.floor(i / 4) % W) - W/2;
            var y = Math.floor(i / 4 / W) - H/2;
            bitmap[i] = x*x+y*y*0.2 > W * W * 0.05 ? randomInt(256) : 0;
        }
        var texture = makeDataTex();
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
            W, H, 0, gl.RGBA,
            gl.UNSIGNED_BYTE, bitmap);
        return texture;
    }

    function tex_to_framebuffer(tex) {
        var fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        return fb;
    }

    function compileShader(type, content) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, content);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw { name: 'ShaderError', code: 'CompileShader', message: gl.getShaderInfoLog(shader) };
        }
        return shader;
    }

    function Shader(p, v, f) {
        this.program = p;
        this.idVertex = v;
        this.idFragment = f;
        this.srcFragment = null;
        this.srcVertex = null;
        this.loc = {};
    }


    function matches(str, regex, cb) {
        var m;
        while ((m = regex.exec(str)) !== null) {
            cb(m);
        }
    }

    function makeShader(fShaderStr, vShaderStr, opt_attrs, opt_unis) {

        opt_attrs = parse(opt_attrs, /(?:^|[^_a-zA-Z0-9])attribute\s.*\s([_a-zA-Z0-9]+)\s*;/g);
        opt_unis = parse(opt_unis, /(?:^|[^_a-zA-Z0-9])uniform\s.*\s([_a-zA-Z0-9]+)\s*;/g);

        function parse(oldv, regex) {
            if (!oldv) {
                oldv = new Set();
                matches(fShaderStr + vShaderStr, regex, function(m) {
                    oldv.add(m[1]);
                });
            }
            return oldv;
        }

        var fragmentShader = compileShader(gl.FRAGMENT_SHADER, fShaderStr);
        var vertexShader = compileShader(gl.VERTEX_SHADER, vShaderStr);

        var shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);

        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            var infoLog = gl.getProgramInfoLog(shaderProgram);
            throw { name: 'ShaderError', code: 'InitializeShader', message: infoLog };
        } else {
            var shader = new Shader(shaderProgram, vertexShader, fragmentShader);
            shader.srcVertex = vShaderStr;
            shader.srcFragment = fShaderStr;

            opt_attrs.forEach(function(attr) {
                shader.loc[attr] = gl.getAttribLocation(shaderProgram, attr);
            });
            opt_unis.forEach(function(uni) {
                shader.loc[uni] = gl.getUniformLocation(shaderProgram, uni);
            });
            return shader;
        }
    }

    function drawSquare(shader) {
        gl.bindBuffer(gl.ARRAY_BUFFER, vbSquare);
        gl.enableVertexAttribArray(shader.loc.aPosition);
        gl.vertexAttribPointer(shader.loc.aPosition, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function iterate() {
        var back = buffers.current();
        var front = buffers.swap();

        gl.bindFramebuffer(gl.FRAMEBUFFER, front.fb);

        gl.useProgram(shaders.iter.program);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, back.tex);
        gl.uniform1i(shaders.iter.loc.uState, 0);

        gl.uniform2f(shaders.iter.loc.uPixelSize, 1/W, 1/H);

        var dt = 0.001 * document.getElementById('i-dt').value;
        var p0 = 0.01 * document.getElementById('i-p0').value;
        var p1 = 0.01 * document.getElementById('i-p1').value;
        var p2 = 0.01 * document.getElementById('i-p2').value;
        var p3 = 0.01 * document.getElementById('i-p3').value;
        var p4 = 0.01 * document.getElementById('i-p4').value;
        gl.uniform1f(shaders.iter.loc.uDt, dt);
        gl.uniform4f(shaders.iter.loc.uCoeff, p1, p2, p3, p4);
        gl.uniform4f(shaders.iter.loc.uCoeff2, p0, 0, 0, 0);

        drawSquare(shaders.iter);
    }
    function render() {
        var front = buffers.current();

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        gl.useProgram(shaders.draw.program);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, front.tex);
        gl.uniform1i(shaders.draw.loc.uTexture, 0);

        drawSquare(shaders.draw);
    }

    function process() {
        for (var i = 0; i < 3; i++) {
            iterate();
        }
    }
    function frame() {
        process();
        render();
    }

    function init() {
        canvas = document.getElementById("main-canvas");
        gl = canvas.getContext("webgl", { antialias: false, alpha: true });
        gl.disable(gl.DEPTH_TEST);

        buffers = new NBuffer(2, function() {
            var tex = createRandomTexture();
            var fb = tex_to_framebuffer(tex);
            return { tex: tex, fb: fb };
        });

        shaders.iter = makeShader(SHADERS.fIter, SHADERS.vComp);
        shaders.draw = makeShader(SHADERS.fIden, SHADERS.vComp);
        vbSquare = createSquareBuffer();

        scheduleFrame();
    }


    function createSquareBuffer() {
        var vbSquare = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbSquare);

        var vertices = new Float32Array([0, 0, 0, 1, 1, 0, 1, 1]);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        return vbSquare;
    }

    function frameAndSchedule() {
        frame();
        scheduleFrame();
    }
    function scheduleFrame() {
        window.requestAnimationFrame(frameAndSchedule);
    }


    setTimeout(init, 0);
}

main();
