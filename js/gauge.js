(function () {
    const RPM_SEGS = 24;
    const RPM_MAX = 11;
    const SPEED_MAX = 200;
    const $ = id => document.getElementById(id);
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

    let rpmBar, gearEl, speedFill;
    let segs = [];
    let speed = 0, targetSpeed = 0, rpm = 0, targetRpm = 0, gear = 0;
    let litCount = -1, animating = false, last = 0;

    function build() {
        rpmBar.replaceChildren();
        segs = [];
        for (let i = 0; i < RPM_SEGS; i++) {
            const s = document.createElement('i');
            s.className = 'seg';
            rpmBar.appendChild(s);
            segs.push(s);
        }
        litCount = -1;
    }

    function paintRpm() {
        const lit = Math.round(rpm / RPM_MAX * RPM_SEGS);
        if (lit === litCount) return;
        litCount = lit;
        segs.forEach((s, i) => {
            const at = (i + 1) / RPM_SEGS * RPM_MAX;
            let cls = 'seg';
            if (i < lit) cls += at >= 8.5 ? ' on hot' : at >= 7 ? ' on warn' : ' on';
            s.className = cls;
        });
    }

    function paintSpeed() {
        speedFill.style.width = (clamp(speed / SPEED_MAX, 0, 1) * 100) + '%';
    }

    function paintGear() {
        gearEl.textContent = gear === 0 ? 'N' : gear < 0 ? 'R' : String(gear);
        gearEl.style.color = gear < 0 ? 'var(--red)' : gear === 0 ? 'var(--amber)' : '';
    }

    function paint() {
        paintRpm();
        paintSpeed();
    }

    function frame(now) {
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        const k = 1 - Math.exp(-9 * dt);
        speed += (targetSpeed - speed) * k;
        rpm += (targetRpm - rpm) * k;
        const moving = Math.abs(targetSpeed - speed) > 0.05 || Math.abs(targetRpm - rpm) > 0.01;
        if (!moving) { speed = targetSpeed; rpm = targetRpm; }
        paint();
        if (moving) requestAnimationFrame(frame);
        else animating = false;
    }

    function kick() {
        if (animating || !rpmBar) return;
        animating = true;
        last = performance.now();
        requestAnimationFrame(frame);
    }

    SAMC.gauge = {
        init() {
            rpmBar = $('rpm-bar');
            gearEl = $('gear-display');
            speedFill = $('speed-fill');
            build();
            paintGear();
            paint();
        },
        redraw() { if (rpmBar) { litCount = -1; paint(); } },
        setSpeedMph(value) { targetSpeed = clamp(value, 0, SPEED_MAX); kick(); },
        setRpm(value) { targetRpm = clamp(value * 10, 0, RPM_MAX); kick(); },
        setGear(value) {
            if (!gearEl || gear === value) return;
            gear = value;
            paintGear();
        }
    };
})();
