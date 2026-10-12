(function () {
    const DEG = Math.PI / 180;
    const W = 310, H = 180;
    const S = { cx: 110, cy: 112, r: 88, needle: 77 };
    const R = { cx: 235, cy: 90, r: 60, needle: 56 };
    const MIN_A = -110, MAX_A = 110;
    const FONT = 'Formula1, sans-serif';

    let canvas, ctx, bg, bgCtx;
    let scale = 1;
    let gear = 0;
    let curSpeed = MIN_A, tgtSpeed = MIN_A, curRpm = MIN_A, tgtRpm = MIN_A;
    let running = false, last = 0;

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const pt = (cx, cy, r, deg) => [cx + r * Math.sin(deg * DEG), cy - r * Math.cos(deg * DEG)];
    const arcAng = deg => (deg - 90) * DEG;
    const k = () => scale * (window.devicePixelRatio || 1);

    function outsideSpeedClip(c) {
        c.beginPath();
        c.rect(0, 0, W, H);
        c.arc(S.cx, S.cy, S.r, 0, Math.PI * 2, true);
        c.clip();
    }

    function zone(c, g, r, from, to, color, alpha, width) {
        c.beginPath();
        c.arc(g.cx, g.cy, r, arcAng(from), arcAng(to));
        c.lineCap = 'round';
        c.lineWidth = width;
        c.strokeStyle = color;
        c.globalAlpha = alpha;
        c.stroke();
        c.globalAlpha = 1;
    }

    function ticks(c, g, outer, inner, list) {
        list.forEach(t => {
            const a = pt(g.cx, g.cy, outer, t.deg);
            const b = pt(g.cx, g.cy, t.major ? inner : inner + 1.5, t.deg);
            c.beginPath();
            c.moveTo(a[0], a[1]);
            c.lineTo(b[0], b[1]);
            c.lineWidth = t.major ? 1.5 : 0.8;
            c.strokeStyle = t.major ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.3)';
            c.stroke();
        });
    }

    function labels(c, g, r, list) {
        c.font = 'bold 7px ' + FONT;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        list.forEach(l => {
            const p = pt(g.cx, g.cy, r, l.deg);
            c.fillStyle = l.color || 'rgba(255,255,255,.5)';
            c.fillText(l.text, p[0], p[1]);
        });
    }

    function outline(c, g) {
        c.beginPath();
        c.arc(g.cx, g.cy, g.r, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(0,0,0,.75)';
        c.lineWidth = 2.6;
        c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.35)';
        c.lineWidth = 1.6;
        c.stroke();
    }

    function drawStatic() {
        const c = bgCtx, f = k();
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, bg.width, bg.height);
        c.setTransform(f, 0, 0, f, 0, 0);

        c.fillStyle = 'rgba(0,0,0,.16)';
        c.beginPath();
        c.arc(S.cx, S.cy, S.r, 0, Math.PI * 2);
        c.fill();

        c.save();
        outsideSpeedClip(c);
        c.beginPath();
        c.arc(R.cx, R.cy, R.r, 0, Math.PI * 2);
        c.fill();
        outline(c, R);
        zone(c, R, 52.5, 70, 110, '#e74c3c', 0.8, 2.25);
        const rt = [], rl = [];
        for (let v = 0; v <= 11; v++) {
            rt.push({ deg: v * 20 + MIN_A, major: true });
            if (v > 2) rl.push({ deg: v * 20 + MIN_A, text: String(v), color: v >= 7 ? '#ff4757' : null });
        }
        ticks(c, R, 60, 54, rt);
        labels(c, R, 46, rl);
        c.font = 'bold 7.5px ' + FONT;
        c.fillStyle = 'rgba(255,255,255,.6)';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('RPM', R.cx, 123.75);
        c.font = '5px ' + FONT;
        c.fillStyle = 'rgba(255,255,255,.3)';
        c.fillText('x1000', R.cx, 132.75);
        c.restore();

        outline(c, S);
        zone(c, S, 80.7, -110, 10, '#2ecc71', 0.6, 2.9);
        zone(c, S, 80.7, 10, 50, '#f1c40f', 0.6, 2.9);
        zone(c, S, 80.7, 50, 110, '#e74c3c', 0.8, 2.9);
        const st = [], sl = [];
        for (let m = 0; m <= 200; m += 20) {
            st.push({ deg: m * 1.1 + MIN_A, major: m % 40 === 0 });
            sl.push({ deg: m * 1.1 + MIN_A, text: String(m) });
        }
        ticks(c, S, 88, 79.2, st);
        labels(c, S, 67, sl);
    }

    function needle(c, g, deg) {
        c.save();
        c.translate(g.cx, g.cy);
        c.rotate(deg * DEG);
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(0, -g.needle);
        c.strokeStyle = '#ff4757';
        c.lineWidth = g === S ? 2.6 : 2.1;
        c.lineCap = 'round';
        c.stroke();
        c.restore();
        const cap = g === S ? 7.3 : 7.5;
        c.beginPath();
        c.arc(g.cx, g.cy, cap, 0, Math.PI * 2);
        c.fillStyle = '#1e1e1e';
        c.fill();
        c.strokeStyle = 'rgba(255,255,255,.2)';
        c.lineWidth = 0.75;
        c.stroke();
        c.beginPath();
        c.arc(g.cx, g.cy, cap / 2, 0, Math.PI * 2);
        c.fillStyle = '#ff4757';
        c.fill();
    }

    function render() {
        if (!ctx) return;
        const f = k();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bg, 0, 0);
        ctx.setTransform(f, 0, 0, f, 0, 0);

        ctx.save();
        outsideSpeedClip(ctx);
        needle(ctx, R, curRpm);
        ctx.restore();

        ctx.save();
        ctx.font = '900 15px ' + FONT;
        ctx.fillStyle = '#ff6b35';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,.85)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetY = 1;
        ctx.fillText(gear === 0 ? 'N' : gear < 0 ? 'R' : String(gear), S.cx, 90);
        ctx.restore();

        needle(ctx, S, curSpeed);
    }

    function tick(now) {
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        const e = 1 - Math.exp(-7.5 * dt);
        let moving = false;
        const ds = tgtSpeed - curSpeed, dr = tgtRpm - curRpm;
        if (Math.abs(ds) > 0.15) { curSpeed += ds * e; moving = true; } else curSpeed = tgtSpeed;
        if (Math.abs(dr) > 0.15) { curRpm += dr * e; moving = true; } else curRpm = tgtRpm;
        render();
        if (moving) requestAnimationFrame(tick);
        else running = false;
    }

    function kick() {
        if (running) return;
        running = true;
        last = performance.now();
        requestAnimationFrame(tick);
    }

    function resize() {
        const f = k();
        canvas.width = bg.width = Math.round(W * f);
        canvas.height = bg.height = Math.round(H * f);
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        drawStatic();
        kick();
    }

    SAMC.gauge = {
        init(el, initialScale) {
            canvas = el;
            ctx = canvas.getContext('2d');
            bg = document.createElement('canvas');
            bgCtx = bg.getContext('2d');
            scale = initialScale || 1;
            resize();
        },
        setScale(s) { scale = s; if (canvas) resize(); },
        redraw() { if (canvas) { drawStatic(); kick(); } },
        setSpeedMph(mph) { tgtSpeed = clamp(mph, 0, 200) * 1.1 + MIN_A; kick(); },
        setRpm(r) { tgtRpm = clamp(r * 10 * 20 + MIN_A, MIN_A, MAX_A); kick(); },
        setGear(g) { gear = g; kick(); }
    };
})();
