(function () {
    const W = 310, H = 180;
    const C = {
        white: '#f4f6f8',
        amber: '#ffc400',
        red: '#ff3d4a',
        green: '#2be08f',
        off: 'rgba(255,255,255,.08)',
        dim: 'rgba(255,255,255,.45)',
        line: 'rgba(255,255,255,.14)'
    };
    const RPM = { x: 8, y: 10, w: 294, h: 9, count: 22, max: 11 };
    const SPD = { x: 70, y: 138, w: 232, h: 8, count: 40, max: 200 };
    const GEAR = { x: 8, y: 44, w: 56, h: 76 };

    let canvas, ctx, scale = 1, dpr = 1, gear = 0;
    let speed = 0, targetSpeed = 0, rpm = 0, targetRpm = 0;
    let animating = false, lastFrame = 0;

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const font = (size, weight = '700') => `${weight} ${size}px Formula1, sans-serif`;

    function chamfer(c, x, y, w, h, k) {
        c.beginPath();
        c.moveTo(x + k, y);
        c.lineTo(x + w, y);
        c.lineTo(x + w, y + h - k);
        c.lineTo(x + w - k, y + h);
        c.lineTo(x, y + h);
        c.lineTo(x, y + k);
        c.closePath();
    }

    function segments(c, g, frac, colorAt) {
        const pitch = g.w / g.count;
        const lit = Math.round(clamp(frac, 0, 1) * g.count);
        for (let i = 0; i < g.count; i++) {
            c.fillStyle = i < lit ? colorAt(i / g.count) : C.off;
            c.fillRect(g.x + i * pitch, g.y, pitch - 1.6, g.h);
        }
    }

    function drawPanel(c) {
        chamfer(c, 0, 0, W, H, 12);
        c.fillStyle = 'rgba(6,8,11,.5)';
        c.fill();
        c.fillStyle = C.amber;
        c.fillRect(0, 0, 36, 2);
    }

    function drawRpm(c) {
        segments(c, RPM, rpm / RPM.max, t => t >= 0.82 ? C.red : t >= 0.64 ? C.amber : C.white);
        c.font = font(6.5);
        c.textAlign = 'center';
        c.textBaseline = 'top';
        for (let v = 2; v <= 10; v += 2) {
            c.fillStyle = v >= 8 ? C.red : C.dim;
            c.fillText(String(v), RPM.x + (v / RPM.max) * RPM.w, RPM.y + RPM.h + 4);
        }
    }

    function drawGear(c) {
        chamfer(c, GEAR.x, GEAR.y, GEAR.w, GEAR.h, 8);
        c.fillStyle = 'rgba(255,255,255,.04)';
        c.fill();
        c.strokeStyle = C.line;
        c.lineWidth = 1;
        c.stroke();
        const cx = GEAR.x + GEAR.w / 2;
        c.font = font(44, '800');
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillStyle = gear < 0 ? C.red : gear === 0 ? C.amber : C.white;
        c.fillText(gear === 0 ? 'N' : gear < 0 ? 'R' : String(gear), cx, GEAR.y + GEAR.h * 0.42);
        c.font = font(6, '700');
        c.fillStyle = C.dim;
        c.fillText('GEAR', cx, GEAR.y + GEAR.h - 10);
    }

    function drawSpeed(c) {
        segments(c, SPD, speed / SPD.max, t => t >= 0.8 ? C.red : t >= 0.5 ? C.amber : C.green);
        c.font = font(6);
        c.textAlign = 'center';
        c.textBaseline = 'top';
        for (let v = 0; v <= 200; v += 50) {
            c.fillStyle = C.dim;
            c.fillText(String(v), SPD.x + (v / SPD.max) * SPD.w, SPD.y + SPD.h + 4);
        }
    }

    function render() {
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        drawPanel(ctx);
        drawRpm(ctx);
        drawGear(ctx);
        drawSpeed(ctx);
    }

    function frame(now) {
        const dt = Math.min((now - lastFrame) / 1000, 0.1);
        lastFrame = now;
        const ease = 1 - Math.exp(-8 * dt);
        speed += (targetSpeed - speed) * ease;
        rpm += (targetRpm - rpm) * ease;
        const moving = Math.abs(targetSpeed - speed) > 0.1 || Math.abs(targetRpm - rpm) > 0.01;
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
        setSpeedMph(value) { targetSpeed = clamp(value, 0, SPD.max); kick(); },
        setRpm(value) { targetRpm = clamp(value * 10, 0, RPM.max); kick(); },
        setGear(value) { gear = value; kick(); }
    };
})();
