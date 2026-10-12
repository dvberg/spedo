(function () {
    const cfg = SAMC.config;
    const MS_TO_MPH = 2.236936;

    const state = {
        speed: 0, rpm: 0, fuel: 1, health: 1, gear: 0, engine: false,
        headlights: 0, leftIndicator: false, rightIndicator: false,
        seatbelt: false, odometer: 0
    };
    const layout = { scale: 1, left: null, top: null };
    const el = {};
    let bgStage = -2, bgToken = 0;

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
    const ratio = (v, d) => {
        const n = Number(v);
        if (!Number.isFinite(n)) return d;
        return n > 1 ? clamp(n, 0, 100) / 100 : clamp(n, 0, 1);
    };
    const bool = v => {
        if (typeof v === 'string') {
            const s = v.trim().toLowerCase();
            if (['false', '0', 'off', 'no', 'disabled', ''].includes(s)) return false;
            return true;
        }
        return Boolean(v);
    };

    function normalize(p) {
        const out = {};
        if (p.speed !== undefined) {
            let s = num(p.speed, 0);
            const unit = String(p.speedUnit || p.unit || '').toLowerCase();
            if (['km/h', 'kmh', 'kph'].includes(unit)) s /= 3.6;
            else if (unit === 'mph') s /= MS_TO_MPH;
            out.speed = Math.max(0, s);
        }
        if (p.rpm !== undefined) out.rpm = clamp(num(p.rpm, 0), 0, 1.1);
        if (p.fuel !== undefined) out.fuel = ratio(p.fuel, state.fuel);
        if (p.health !== undefined) out.health = ratio(p.health, state.health);
        if (p.gear !== undefined) out.gear = Math.trunc(num(p.gear, 0));
        if (p.engine !== undefined) out.engine = bool(p.engine);
        if (p.headlights !== undefined) out.headlights = typeof p.headlights === 'boolean' ? (p.headlights ? 1 : 0) : num(p.headlights, 0);
        const left = p.leftIndicator !== undefined ? p.leftIndicator : p.left;
        const right = p.rightIndicator !== undefined ? p.rightIndicator : p.right;
        const belt = p.seatbelt !== undefined ? p.seatbelt : p.seatbeltFastened;
        if (left !== undefined) out.leftIndicator = bool(left);
        if (right !== undefined) out.rightIndicator = bool(right);
        if (belt !== undefined) out.seatbelt = bool(belt);
        if (p.odometer !== undefined) out.odometer = Math.max(0, num(p.odometer, 0));
        return out;
    }

    function bgFor(mph) {
        const i = cfg.bgStages.findIndex(s => mph <= s.max);
        return i === -1 ? cfg.bgStages.length - 1 : i;
    }

    function updateBackground(mph) {
        const idx = bgFor(mph);
        if (idx === bgStage) return;
        bgStage = idx;
        const token = ++bgToken;
        const layers = [el.bgSpeed, el.bgRpm];
        layers.forEach(l => l.classList.remove('active'));
        setTimeout(() => {
            if (token !== bgToken) return;
            const url = 'url("' + cfg.bgStages[idx].img + '")';
            layers.forEach(l => { l.style.backgroundImage = url; l.classList.add('active'); });
        }, 120);
    }

    function setBar(bar, value) {
        bar.fill.style.width = (value * 100) + '%';
        bar.text.textContent = Math.round(value * 100) + '%';
    }

    function render() {
        const mph = Math.round(state.speed * MS_TO_MPH);
        el.speed.textContent = mph;
        el.odo.textContent = state.odometer.toFixed(1) + ' mi';
        SAMC.gauge.setSpeedMph(mph);
        SAMC.gauge.setRpm(state.rpm);
        SAMC.gauge.setGear(state.gear);
        updateBackground(mph);
        setBar(el.fuel, state.fuel);
        setBar(el.health, state.health);
        el.engine.classList.toggle('on', state.engine);
        el.lights.classList.toggle('on', state.headlights > 0);
        el.left.classList.toggle('on', state.leftIndicator);
        el.left.classList.toggle('blink', state.leftIndicator);
        el.right.classList.toggle('on', state.rightIndicator);
        el.right.classList.toggle('blink', state.rightIndicator);
        el.belt.classList.toggle('on', !state.seatbelt);
        el.belt.classList.toggle('blink', !state.seatbelt);
    }

    function setState(patch, relay) {
        const changed = {};
        let any = false;
        Object.keys(patch).forEach(key => {
            if (state[key] !== patch[key]) {
                state[key] = patch[key];
                changed[key] = patch[key];
                any = true;
            }
        });
        if (!any) return;
        render();
        if (relay && SAMC.sync) SAMC.sync.relay(changed);
    }

    function saveLayout() {
        try { localStorage.setItem(cfg.storage.layout, JSON.stringify(layout)); } catch (_) {}
    }

    function loadLayout() {
        try {
            const s = JSON.parse(localStorage.getItem(cfg.storage.layout));
            if (s) {
                layout.scale = clamp(num(s.scale, 1), cfg.scale.min, cfg.scale.max);
                if (Number.isFinite(s.left) && Number.isFinite(s.top)) { layout.left = s.left; layout.top = s.top; }
            }
        } catch (_) {}
    }

    function applyLayout() {
        const r = el.root;
        if (layout.left !== null) {
            r.style.left = layout.left + 'px';
            r.style.top = layout.top + 'px';
            r.style.right = r.style.bottom = 'auto';
        } else {
            r.style.left = r.style.top = '';
            r.style.right = r.style.bottom = '';
        }
        r.style.transform = 'scale(' + layout.scale + ')';
    }

    function setScale(s) {
        layout.scale = Math.round(clamp(s, cfg.scale.min, cfg.scale.max) * 10) / 10;
        applyLayout();
        SAMC.gauge.setScale(layout.scale);
        saveLayout();
    }

    function resetLayout() {
        layout.scale = 1;
        layout.left = layout.top = null;
        applyLayout();
        SAMC.gauge.setScale(1);
        try { localStorage.removeItem(cfg.storage.layout); } catch (_) {}
    }

    function setupDrag() {
        let drag = null;
        el.root.addEventListener('pointerdown', e => {
            if (e.target.closest('.no-drag, button, input')) return;
            drag = { x: e.clientX, y: e.clientY, l: el.root.offsetLeft, t: el.root.offsetTop };
            el.root.setPointerCapture(e.pointerId);
            e.preventDefault();
        });
        el.root.addEventListener('pointermove', e => {
            if (!drag) return;
            layout.left = drag.l + e.clientX - drag.x;
            layout.top = drag.t + e.clientY - drag.y;
            applyLayout();
        });
        const end = () => { if (drag) { drag = null; saveLayout(); } };
        el.root.addEventListener('pointerup', end);
        el.root.addEventListener('lostpointercapture', end);
    }

    function bar(id) {
        return { fill: document.getElementById(id + '-fill'), text: document.getElementById(id + '-text') };
    }

    const API = {
        init() {
            const $ = id => document.getElementById(id);
            el.root = $('speedometer');
            el.speed = $('speed-display');
            el.odo = $('odometer');
            el.bgSpeed = $('bg-speed');
            el.bgRpm = $('bg-rpm');
            el.fuel = bar('fuel');
            el.health = bar('health');
            el.engine = $('ind-engine');
            el.lights = $('ind-lights');
            el.left = $('ind-left');
            el.right = $('ind-right');
            el.belt = $('ind-belt');
            el.pill = $('sync-pill');
            el.pillText = $('sync-pill-text');

            loadLayout();
            applyLayout();
            SAMC.gauge.init($('gauge'), layout.scale);
            setupDrag();

            $('btn-scale-up').addEventListener('click', () => setScale(layout.scale + cfg.scale.step));
            $('btn-scale-down').addEventListener('click', () => setScale(layout.scale - cfg.scale.step));
            $('btn-reset').addEventListener('click', resetLayout);
            render();
        },

        apply(data) {
            if (!data || typeof data !== 'object') return;
            const p = data.data && typeof data.data === 'object' ? data.data : data;
            if (p.visible !== undefined) API.setVisible(p.visible !== false);
            setState(normalize(p), true);
        },

        setState,
        getState: () => Object.assign({}, state),
        reset() { setState(normalize({ speed: 0, rpm: 0, fuel: 1, health: 1, gear: 0, engine: false, headlights: 0, left: false, right: false, seatbelt: false, odometer: 0 }), false); },
        setVisible(v) { el.root.classList.toggle('hide', !v); },
        setSyncHidden(hidden, text) {
            el.root.classList.toggle('sync-hidden', hidden);
            el.pill.classList.toggle('hide', !hidden);
            if (text) el.pillText.textContent = text;
        }
    };

    SAMC.hud = API;
})();
