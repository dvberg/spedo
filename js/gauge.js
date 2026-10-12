(function () {
    const DEG = Math.PI / 180;
    const W = 310, H = 180, MIN = -110, MAX = 110;
    const S = { cx: 110, cy: 112, r: 88, arc: 80.7, needle: 77 };
    const R = { cx: 235, cy: 90, r: 60, arc: 52.5, needle: 56 };
    let canvas, ctx, scale = 1, gear = 0, dpr = 1;
    let speed = MIN, targetSpeed = MIN, rpm = MIN, targetRpm = MIN;
    let animating = false, lastFrame = 0;

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const angle = deg => (deg - 90) * DEG;
    const point = (g, radius, deg) => [g.cx + radius * Math.sin(deg * DEG), g.cy - radius * Math.cos(deg * DEG)];
    const font = (size, weight = '400') => `${weight} ${size}px Formula1, sans-serif`;

    function line(c, a, b, width, color) {
        c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]);
        c.lineWidth = width; c.strokeStyle = color; c.stroke();
    }

    function arc(c, g, from, to, color, width, alpha = 1) {
        c.beginPath(); c.arc(g.cx, g.cy, g.arc, angle(from), angle(to));
        c.lineCap = 'round'; c.lineWidth = width; c.globalAlpha = alpha;
        c.strokeStyle = color; c.stroke(); c.globalAlpha = 1;
    }

    function ticks(c, g, values, inner) {
        values.forEach(({ deg, major }) => {
            const outer = point(g, g.r, deg);
            const inside = point(g, major ? inner : inner + 1.5, deg);
            line(c, outer, inside, major ? 1.5 : .75, major ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.32)');
        });
    }

    function labels(c, g, radius, items) {
        c.font = font(7, '700'); c.textAlign = 'center'; c.textBaseline = 'middle';
        items.forEach(item => {
            const p = point(g, radius, item.deg);
            c.fillStyle = item.color || 'rgba(255,255,255,.58)';
            c.fillText(item.text, p[0], p[1]);
        });
    }

    function dialFace(c, g) {
        const face = c.createRadialGradient(g.cx - 12, g.cy - 15, 8, g.cx, g.cy, g.r);
        face.addColorStop(0, 'rgba(38,43,51,.92)');
        face.addColorStop(1, 'rgba(4,6,9,.92)');
        c.beginPath(); c.arc(g.cx, g.cy, g.r, 0, Math.PI * 2); c.fillStyle = face; c.fill();
        c.beginPath(); c.arc(g.cx, g.cy, g.r, 0, Math.PI * 2);
        c.lineWidth = 2.6; c.strokeStyle = 'rgba(0,0,0,.85)'; c.stroke();
        c.lineWidth = 1.2; c.strokeStyle = 'rgba(255,255,255,.3)'; c.stroke();
    }

    function drawStatic() {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        dialFace(ctx, S); dialFace(ctx, R);

        arc(ctx, S, MIN, 10, '#5fd38d', 3, .9);
        arc(ctx, S, 10, 50, '#e8b84a', 3, .9);
        arc(ctx, S, 50, MAX, '#e5484d', 3, .9);
        const speedTicks = [], speedLabels = [];
        for (let value = 0; value <= 200; value += 20) {
            const deg = value * 1.1 + MIN;
            speedTicks.push({ deg, major: value % 40 === 0 });
            speedLabels.push({ deg, text: String(value) });
        }
        ticks(ctx, S, speedTicks, 79.2); labels(ctx, S, 67, speedLabels);

        arc(ctx, R, 55, MAX, '#e5484d', 2.5, .9);
        const rpmTicks = [], rpmLabels = [];
        for (let value = 0; value <= 11; value++) {
            rpmTicks.push({ deg: value * 20 + MIN, major: true });
            if (value > 2) rpmLabels.push({ deg: value * 20 + MIN, text: String(value), color: value >= 7 ? '#e5484d' : null });
        }
        ticks(ctx, R, rpmTicks, 54); labels(ctx, R, 46, rpmLabels);
        ctx.font = font(7.5, '700'); ctx.fillStyle = 'rgba(255,255,255,.62)'; ctx.textAlign = 'center';
        ctx.fillText('RPM', R.cx, 123.75);
        ctx.font = font(5); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillText('x1000', R.cx, 132.75);
    }

    function needle(c, g, value, color) {
        c.save(); c.translate(g.cx, g.cy); c.rotate(value * DEG);
        c.beginPath(); c.moveTo(0, 2); c.lineTo(0, -g.needle);
        c.lineWidth = g === S ? 2.8 : 2.2; c.lineCap = 'round'; c.strokeStyle = color; c.shadowColor = color; c.shadowBlur = 7; c.stroke(); c.restore();
        c.shadowBlur = 0; c.beginPath(); c.arc(g.cx, g.cy, g === S ? 7.5 : 7, 0, Math.PI * 2);
        c.fillStyle = '#0c1117'; c.fill(); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; c.stroke();
        c.beginPath(); c.arc(g.cx, g.cy, 3.6, 0, Math.PI * 2); c.fillStyle = color; c.fill();
    }

    function render() {
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); drawStatic();
        needle(ctx, R, rpm, '#e5484d');
        ctx.font = font(15, '700'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffb020';
        ctx.shadowColor = 'rgba(0,0,0,.9)'; ctx.shadowBlur = 4;
        ctx.fillText(gear === 0 ? 'N' : gear < 0 ? 'R' : String(gear), S.cx, 90); ctx.shadowBlur = 0;
        const speedColor = speed > 45 ? '#e5484d' : speed > -5 ? '#e8b84a' : '#5fd38d';
        needle(ctx, S, speed, speedColor);
    }

    function frame(now) {
        const dt = Math.min((now - lastFrame) / 1000, .1); lastFrame = now;
        const ease = 1 - Math.exp(-8 * dt);
        speed += (targetSpeed - speed) * ease; rpm += (targetRpm - rpm) * ease;
        const moving = Math.abs(targetSpeed - speed) > .1 || Math.abs(targetRpm - rpm) > .1;
        render();
        if (moving) requestAnimationFrame(frame); else animating = false;
    }

    function kick() { if (!animating) { animating = true; lastFrame = performance.now(); requestAnimationFrame(frame); } }
    function resize() {
        dpr = (window.devicePixelRatio || 1) * scale;
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
        render(); kick();
    }

    SAMC.gauge = {
        init(el, initialScale) { canvas = el; ctx = canvas.getContext('2d'); scale = initialScale || 1; resize(); },
        setScale(value) { scale = value; if (canvas) resize(); },
        redraw() { if (canvas) { resize(); } },
        setSpeedMph(value) { targetSpeed = clamp(value, 0, 200) * 1.1 + MIN; kick(); },
        setRpm(value) { targetRpm = clamp(value * 10 * 20 + MIN, MIN, MAX); kick(); },
        setGear(value) { gear = value; kick(); }
    };
})();
