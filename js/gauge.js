(function () {
    const DEG = Math.PI / 180;
    const W = 310, H = 180, MIN = -110, MAX = 110;
    const S = { cx: 110, cy: 112, r: 84 };
    const R = { cx: 235, cy: 90, r: 56 };
    const C = {
        white: '#f4f6f8',
        amber: '#ffc400',
        red: '#ff3d4a',
        track: 'rgba(255,255,255,.1)',
        tick: 'rgba(255,255,255,.4)',
        tickMajor: 'rgba(255,255,255,.8)',
        face: 'rgba(5,7,10,.55)'
    };
    const SPEED_ZONES = [22, 66];
    const RPM_ZONES = [50, 70];

    let canvas, ctx, scale = 1, gear = 0, dpr = 1;
    let speed = MIN, targetSpeed = MIN, rpm = MIN, targetRpm = MIN;
    let animating = false, lastFrame = 0;

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const angle = deg => (deg - 90) * DEG;
    const point = (g, radius, deg) => [g.cx + radius * Math.sin(deg * DEG), g.cy - radius * Math.cos(deg * DEG)];
    const font = (size, weight = '700') => `${weight} ${size}px Formula1, sans-serif`;

    function arc(c, g, from, to, color, width) {
        if (to <= from) return;
        c.beginPath();
        c.arc(g.cx, g.cy, g.r, angle(from), angle(to));
        c.lineWidth = width;
        c.strokeStyle = color;
        c.stroke();
    }

    function tick(c, g, deg, r1, r2, color, width) {
        const a = point(g, r1, deg), b = point(g, r2, deg);
        c.beginPath();
        c.moveTo(a[0], a[1]);
        c.lineTo(b[0], b[1]);
        c.lineWidth = width;
        c.strokeStyle = color;
        c.stroke();
    }

    function label(c, g, radius, deg, text, size, color) {
        const p = point(g, radius, deg);
        c.font = font(size);
        c.fillStyle = color;
        c.fillText(text, p[0], p[1]);
    }

    function face(c, g, radius) {
        c.beginPath();
        c.arc(g.cx, g.cy, radius, 0, Math.PI * 2);
        c.fillStyle = C.face;
        c.fill();
    }

    function progress(c, g, value, width, zones) {
        const [z1, z2] = zones;
        const v = Math.min(value, MAX);
        arc(c, g, MIN, Math.min(v, z1), C.white, width);
        arc(c, g, z1, Math.min(v, z2), C.amber, width);
        arc(c, g, z2, v, C.red, width);
    }

    function marker(c, g, deg, color, inner, outer) {
        c.save();
        c.shadowColor = color;
        c.shadowBlur = 8;
        tick(c, g, deg, inner, outer, color, 2.5);
        c.restore();
    }

    function drawSpeed(c) {
        face(c, S, S.r + 12);
        arc(c, S, MIN, MAX, C.track, 6);
        c.save();
        c.shadowColor = 'rgba(255,196,0,.5)';
        c.shadowBlur = 6;
        progress(c, S, speed, 6, SPEED_ZONES);
        c.restore();
        for (let v = 0; v <= 200; v += 10) {
            const deg = v * 1.1 + MIN;
            const major = v % 20 === 0;
            tick(c, S, deg, S.r - 8, S.r - (major ? 14 : 11), major ? C.tickMajor : C.tick, major ? 1.6 : 1);
        }
        c.font = font(7);
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        for (let v = 0; v <= 200; v += 20) {
            label(c, S, S.r - 24, v * 1.1 + MIN, String(v), 7, C.white);
        }
        marker(c, S, speed, C.white, S.r - 10, S.r + 2);
    }

    function drawRpm(c) {
        face(c, R, R.r + 10);
        arc(c, R, MIN, MAX, C.track, 4);
        progress(c, R, rpm, 4, RPM_ZONES);
        for (let v = 0; v <= 11; v++) {
            tick(c, R, v * 20 + MIN, R.r - 6, R.r - (v % 2 ? 9 : 10), C.tick, 1);
        }
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        for (let v = 2; v <= 11; v += 2) {
            label(c, R, R.r - 19, v * 20 + MIN, String(v), 6.5, v >= 9 ? C.red : 'rgba(255,255,255,.55)');
        }
        marker(c, R, rpm, C.white, R.r - 8, R.r + 1);
    }

    function drawGear(c) {
        const text = gear === 0 ? 'N' : gear < 0 ? 'R' : String(gear);
        c.save();
        c.translate(S.cx, S.cy - 16);
        c.transform(1, 0, -0.2, 1, 0, 0);
        c.font = font(26, '800');
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillStyle = C.white;
        c.shadowColor = 'rgba(0,0,0,.6)';
        c.shadowBlur = 4;
        c.fillText(text, 0, 0);
        c.restore();
    }

    function render() {
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        drawRpm(ctx);
        drawSpeed(ctx);
        drawGear(ctx);
    }

    function frame(now) {
        const dt = Math.min((now - lastFrame) / 1000, 0.1);
        lastFrame = now;
        const ease = 1 - Math.exp(-8 * dt);
        speed += (targetSpeed - speed) * ease;
        rpm += (targetRpm - rpm) * ease;
        const moving = Math.abs(targetSpeed - speed) > 0.1 || Math.abs(targetRpm - rpm) > 0.1;
        render();
        if (moving) requestAnimationFrame(frame);
        else animating = false;
    }

    function kick() {
        if (animating) return;
        animating = true;
        lastFrame = performance.now();
        requestAnimationFrame(frame);
    }

    function resize() {
        dpr = (window.devicePixelRatio || 1) * scale;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        render();
        kick();
    }

    SAMC.gauge = {
        init(el, initialScale) {
            canvas = el;
            ctx = canvas.getContext('2d');
            scale = initialScale || 1;
            resize();
        },
        setScale(value) { scale = value; if (canvas) resize(); },
        redraw() { if (canvas) resize(); },
        setSpeedMph(value) { targetSpeed = clamp(value, 0, 200) * 1.1 + MIN; kick(); },
        setRpm(value) { targetRpm = clamp(value * 10 * 20 + MIN, MIN, MAX); kick(); },
        setGear(value) { gear = value; kick(); }
    };
})();
