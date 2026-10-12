window.SAMC = window.SAMC || {};

SAMC.config = {
    storage: {
        layout: 'spedo_settings',
        syncCode: 'spedo_sync_code',
        playlist: 'samc_music_audio_playlist_v2'
    },
    peerPrefix: 'samc-spedo-',
    relayMs: 16,
    scale: { min: 0.5, max: 2, step: 0.1 },
    peer: {
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'turn:openrelay.metered.ca:80', username: 'openrelay', credential: 'openrelay' },
                { urls: 'turn:openrelay.metered.ca:443', username: 'openrelay', credential: 'openrelay' },
                { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelay', credential: 'openrelay' }
            ]
        }
    }
};


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


(function () {
    const cfg = SAMC.config;
    const MS_TO_MPH = 2.236936;

    const state = {
        speed: 0, rpm: 0, fuel: 1, health: 1, gear: 0, engine: false,
        headlights: 0, leftIndicator: false, rightIndicator: false,
        seatbelt: false, odometer: 0
    };
    const layout = { scale: 1, left: null, top: null };
    const SPEED_MODES = [
        { factor: 3.6, unit: 'KMH' },
        { factor: MS_TO_MPH, unit: 'MPH' },
        { factor: 1.943844, unit: 'KN' }
    ];
    let speedMode = 1;
    const el = {};

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

    function setBar(bar, value) {
        bar.fill.style.width = (value * 100) + '%';
        bar.fill.classList.toggle('warn', value < 0.4 && value >= 0.2);
        bar.fill.classList.toggle('low', value < 0.2);
        bar.text.textContent = Math.round(value * 100) + '%';
    }

    function render() {
        const mph = Math.round(state.speed * MS_TO_MPH);
        const mode = SPEED_MODES[speedMode];
        el.speed.textContent = Math.round(state.speed * mode.factor);
        el.unit.textContent = mode.unit;
        el.odo.textContent = state.odometer.toFixed(1) + ' mi';
        SAMC.gauge.setSpeedMph(mph);
        SAMC.gauge.setRpm(state.rpm);
        SAMC.gauge.setGear(state.gear);
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
        saveLayout();
    }

    function resetLayout() {
        layout.scale = 1;
        layout.left = layout.top = null;
        applyLayout();
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
            el.unit = document.querySelector('.readout .unit');
            el.odo = $('odometer');
            el.fuel = bar('fuel');
            el.health = bar('health');
            el.engine = $('indicator-engine');
            el.lights = $('indicator-headlights');
            el.left = $('indicator-left');
            el.right = $('indicator-right');
            el.belt = $('indicator-seatbelt');
            el.pill = $('sync-active-pill');
            el.pillText = $('sync-active-text');

            loadLayout();
            applyLayout();
            SAMC.gauge.init();
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
        setSpeedMode(mode) {
            speedMode = clamp(Math.trunc(num(mode, 1)), 0, SPEED_MODES.length - 1);
            render();
        },
        setSyncHidden(hidden, text) {
            el.root.classList.toggle('sync-hidden', hidden);
            el.pill.classList.toggle('hide', !hidden);
            if (text) el.pillText.textContent = text;
        }
    };

    SAMC.hud = API;
})();


(function () {
    const cfg = SAMC.config;
    const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const CODE_RE = /^[A-Z0-9]{6}$/;
    const $ = id => document.getElementById(id);

    let peer = null, link = null, role = null, clients = [];
    let code = '', pending = {}, timer = null;

    const genCode = () => Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');

    function status(kind, text) {
        $('sync-status-dot').className = 'status-dot ' + kind;
        $('sync-status-text').textContent = text;
    }

    function buttons() {
        $('btn-host-connect').classList.toggle('hide', role === 'host');
        $('btn-host-disconnect').classList.toggle('hide', role !== 'host');
        $('btn-sync-connect').classList.toggle('hide', role === 'client');
        $('btn-sync-disconnect').classList.toggle('hide', role !== 'client');
    }

    function showTab(tab) {
        $('sync-role-host').classList.toggle('active', tab === 'host');
        $('sync-role-client').classList.toggle('active', tab === 'client');
        $('sync-host-panel').classList.toggle('hide', tab !== 'host');
        $('sync-client-panel').classList.toggle('hide', tab !== 'client');
    }

    function teardown() {
        const p = peer, l = link, c = clients;
        peer = link = null;
        role = null;
        clients = [];
        pending = {};
        clearTimeout(timer);
        timer = null;
        if (l) try { l.close(); } catch (_) {}
        c.forEach(x => { try { x.close(); } catch (_) {} });
        if (p) try { p.destroy(); } catch (_) {}
    }

    function stop(message) {
        const wasClient = role === 'client';
        teardown();
        if (wasClient) SAMC.hud.reset();
        SAMC.hud.setSyncHidden(false);
        status('disconnected', message || 'Disconnected');
        buttons();
    }

    function fail(err) {
        const type = err && err.type;
        if (role === 'host' && type === 'unavailable-id') {
            code = genCode();
            $('sync-host-code').textContent = code;
            stop('Code taken, try again');
        } else if (type === 'peer-unavailable') {
            stop('Host not found');
        } else {
            stop('P2P error: ' + (type || 'failed'));
        }
    }

    function refreshHost() {
        const n = clients.length;
        SAMC.hud.setSyncHidden(n > 0, 'Syncing HUD (' + code + ')');
        status('connected', n ? 'Host - ' + n + ' client' + (n > 1 ? 's' : '') : 'Host ready (P2P)');
    }

    function addClient(conn) {
        conn.on('open', () => {
            if (role !== 'host') return conn.close();
            clients.push(conn);
            conn.send(JSON.stringify({ type: 'telemetry', data: SAMC.hud.getState() }));
            refreshHost();
        });
        conn.on('close', () => {
            clients = clients.filter(c => c !== conn);
            if (role === 'host') refreshHost();
        });
    }

    function startHost() {
        teardown();
        role = 'host';
        status('connecting', 'Connecting P2P...');
        buttons();
        try { peer = new Peer(cfg.peerPrefix + code.toLowerCase(), cfg.peer); }
        catch (e) { return fail(e); }
        peer.on('open', () => {
            if (role !== 'host') return;
            refreshHost();
            setTimeout(() => $('sync-panel').classList.add('hide'), 800);
        });
        peer.on('connection', addClient);
        peer.on('error', fail);
    }

    function startClient(joinCode) {
        teardown();
        role = 'client';
        status('connecting', 'Connecting P2P...');
        buttons();
        try { peer = new Peer(cfg.peer); }
        catch (e) { return fail(e); }
        peer.on('error', fail);
        peer.on('open', () => {
            if (role !== 'client') return;
            link = peer.connect(cfg.peerPrefix + joinCode.toLowerCase(), { reliable: true });
            link.on('open', () => {
                status('connected', 'Client connected (P2P)');
                try { localStorage.setItem(cfg.storage.syncCode, joinCode); } catch (_) {}
                setTimeout(() => $('sync-panel').classList.add('hide'), 800);
            });
            link.on('data', raw => {
                try {
                    const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    if (msg && msg.type === 'telemetry' && msg.data) SAMC.hud.setState(msg.data, false);
                } catch (e) { console.error('[sync] bad data', e); }
            });
            link.on('close', () => { if (role === 'client') stop('Host disconnected'); });
        });
    }

    function flush() {
        timer = null;
        if (role !== 'host') return;
        const msg = JSON.stringify({ type: 'telemetry', data: pending });
        pending = {};
        clients.forEach(c => { if (c.open) c.send(msg); });
    }

    function init() {
        code = genCode();
        $('sync-host-code').textContent = code;
        try { $('sync-client-code-input').value = localStorage.getItem(cfg.storage.syncCode) || ''; } catch (_) {}

        const panel = $('sync-panel');
        $('btn-sync').addEventListener('click', e => { e.stopPropagation(); panel.classList.toggle('hide'); });
        $('btn-sync-close').addEventListener('click', () => panel.classList.add('hide'));
        $('sync-role-host').addEventListener('click', () => showTab('host'));
        $('sync-role-client').addEventListener('click', () => showTab('client'));
        $('btn-host-connect').addEventListener('click', startHost);
        $('btn-host-disconnect').addEventListener('click', () => stop());
        $('btn-sync-disconnect').addEventListener('click', () => stop());
        $('btn-restore-hud').addEventListener('click', () => stop());
        $('btn-sync-connect').addEventListener('click', () => {
            const v = $('sync-client-code-input').value.trim().toUpperCase();
            if (!CODE_RE.test(v)) return status('disconnected', 'Enter a 6-character code');
            startClient(v);
        });

        buttons();
        const q = new URLSearchParams(location.search);
        const mode = (q.get('mode') || q.get('role') || '').toLowerCase();
        const qCode = (q.get('code') || '').toUpperCase();
        if (mode === 'host' || mode === 'client') {
            showTab(mode);
            if (mode === 'host' && CODE_RE.test(qCode)) { code = qCode; $('sync-host-code').textContent = code; }
            if (mode === 'client') $('sync-client-code-input').value = qCode;
            if (mode === 'host') setTimeout(startHost, 100);
            else if (CODE_RE.test(qCode)) setTimeout(() => startClient(qCode), 100);
        }
    }

    SAMC.sync = {
        init,
        relay(patch) {
            if (role !== 'host' || !clients.length) return;
            Object.assign(pending, patch);
            if (!timer) timer = setTimeout(flush, cfg.relayMs);
        }
    };
})();


(function () {
    const KEY = SAMC.config.storage.playlist;
    const $ = id => document.getElementById(id);
    const YT_ERR = {
        2: 'Link video tidak valid',
        5: 'Video tidak bisa diputar di pemutar ini',
        100: 'Video tidak ditemukan atau privat',
        101: 'Pemilik video melarang pemutaran di luar YouTube',
        150: 'Pemilik video melarang pemutaran di luar YouTube'
    };

    let audio, tracks = [], index = -1, active = null, ytCurrent = null;
    let repeat = false, shuffle = false, seeking = false;
    let volume = 0.8, muted = false;
    let ytPlayer = null, ytPromise = null, ytReadyFlag = false;

    const fmt = s => {
        const n = Math.floor(Number(s));
        return Number.isFinite(n) && n >= 0 ? Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0') : '0:00';
    };

    function titleFrom(url, n) {
        try {
            let name = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
            try { name = decodeURIComponent(name); } catch (_) {}
            name = name.replace(/\.(mp3|ogg|oga|wav|m4a|aac|opus|flac|webm)$/i, '').replace(/[._]+/g, ' ').trim();
            if (name && !/^[a-f0-9]{18,}$/i.test(name)) return name.slice(0, 80);
        } catch (_) {}
        return 'Audio ' + n;
    }

    function parse(input, n = 0) {
        let u;
        try { u = new URL(String(input || '').trim()); } catch (_) { return { error: 'URL tidak valid' }; }
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return { error: 'Gunakan link http(s)' };
        const h = u.hostname.toLowerCase().replace(/^(www|m)\./, '');

        if (h === 'youtu.be' || /(^|\.)youtube(-nocookie)?\.com$/.test(h)) {
            let id = null;
            if (h === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
            else if (u.pathname === '/watch') id = u.searchParams.get('v');
            else {
                const m = u.pathname.match(/^\/(embed|shorts|live)\/([^/?#]+)/);
                if (m) id = m[2];
            }
            if (!/^[\w-]{11}$/.test(id || '')) return { error: 'Link YouTube tidak dikenali' };
            return { track: { type: 'yt', id, url: 'https://www.youtube.com/watch?v=' + id, title: 'YouTube ' + id } };
        }

        let url = u.href;
        if (h === 'dropbox.com') {
            u.searchParams.set('dl', '1');
            url = u.href;
        }
        const drive = u.pathname.match(/^\/file\/d\/([^/]+)/);
        if (h === 'drive.google.com' && drive) url = 'https://drive.google.com/uc?export=download&id=' + drive[1];

        return { track: { type: 'audio', url, title: titleFrom(url, n) } };
    }

    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(tracks)); } catch (_) {} };

    function load() {
        try {
            const raw = JSON.parse(localStorage.getItem(KEY));
            tracks = (Array.isArray(raw) ? raw : []).map((t, i) => {
                const r = parse(t && (t.url || t.id), i + 1);
                return r.track ? Object.assign(r.track, { title: String(t.title || r.track.title).slice(0, 100) }) : null;
            }).filter(Boolean);
        } catch (_) { tracks = []; }
    }

    const note = msg => { $('music-track-subtitle').textContent = msg; };
    const label = t => (t.type === 'yt' ? 'YouTube' : 'Direct audio');

    function renderList() {
        const list = $('music-playlist');
        list.replaceChildren();
        if (!tracks.length) {
            const e = document.createElement('div');
            e.className = 'music-empty';
            e.textContent = 'Belum ada lagu. Tekan ＋ untuk tempel link audio atau YouTube.';
            list.appendChild(e);
            return;
        }
        tracks.forEach((t, i) => {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'music-track-row' + (i === index ? ' active' : '');
            row.title = t.url;
            const name = document.createElement('strong');
            name.textContent = t.title;
            const num = document.createElement('span');
            num.className = 'music-track-index';
            num.textContent = String(i + 1).padStart(2, '0');
            row.append(name, num);
            row.addEventListener('click', () => play(i));
            list.appendChild(row);
        });
    }

    function meta() {
        const t = tracks[index];
        $('music-track-title').textContent = t ? t.title : 'Belum ada lagu';
        note(t ? label(t) : 'Tempel link audio');
        renderList();
    }

    const ICON = {
        play: '<svg viewBox="0 0 16 16"><path d="M4 2.5v11l9-5.5z"/></svg>',
        pause: '<svg viewBox="0 0 16 16"><path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z"/></svg>',
        vol: '<svg viewBox="0 0 16 16"><path d="M2 6h3l4-3v10l-4-3H2z"/><path d="M11 5.5a3.5 3.5 0 010 5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
        mute: '<svg viewBox="0 0 16 16"><path d="M2 6h3l4-3v10l-4-3H2z"/><path d="M11 6l3.5 4M14.5 6L11 10" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>'
    };

    const audioEng = {
        play: () => audio.play(),
        pause: () => audio.pause(),
        playing: () => !audio.paused && !audio.ended,
        seek: s => { audio.currentTime = s; },
        time: () => audio.currentTime || 0,
        length: () => audio.duration,
        stop() { audio.pause(); audio.removeAttribute('src'); audio.load(); }
    };

    const ytEng = {
        play() { if (ytReadyFlag) ytPlayer.playVideo(); },
        pause() { if (ytReadyFlag) ytPlayer.pauseVideo(); },
        playing: () => ytReadyFlag && ytPlayer.getPlayerState() === 1,
        seek(s) { if (ytReadyFlag) ytPlayer.seekTo(s, true); },
        time: () => (ytReadyFlag ? ytPlayer.getCurrentTime() : 0),
        length: () => (ytReadyFlag ? ytPlayer.getDuration() : NaN),
        stop() { if (ytReadyFlag) ytPlayer.stopVideo(); }
    };

    const eng = () => (active === 'yt' ? ytEng : audioEng);
    const loaded = () => (active === 'yt' ? !!ytCurrent : !!audio.getAttribute('src'));

    function applyVolume() {
        audio.volume = volume;
        if (ytReadyFlag) ytPlayer.setVolume(Math.round(volume * 100));
    }

    function applyMute() {
        audio.muted = muted;
        if (ytReadyFlag) (muted ? ytPlayer.mute() : ytPlayer.unMute());
    }

    function muteIcon() {
        return muted || volume === 0 ? ICON.mute : ICON.vol;
    }

    function playBtn() {
        $('btn-music-play').innerHTML = eng().playing() ? ICON.pause : ICON.play;
    }

    function progress() {
        const e = eng(), d = e.length(), ok = Number.isFinite(d) && d > 0;
        $('music-current-time').textContent = fmt(e.time());
        $('music-duration').textContent = ok ? fmt(d) : '--:--';
        const bar = $('music-progress');
        bar.disabled = !ok;
        if (!seeking) bar.value = ok ? Math.round(e.time() / d * 1000) : 0;
    }

    function syncYTTitle() {
        const t = tracks[index];
        if (!t || t.type !== 'yt' || !ytReadyFlag) return;
        const d = ytPlayer.getVideoData();
        if (d && d.video_id === t.id && d.title && t.title !== d.title) {
            t.title = d.title;
            save();
            meta();
        }
    }

    function onYTState(e) {
        const s = e.data;
        if (s === 1) syncYTTitle();
        if (s === 0 && active === 'yt') return next(true);
        playBtn();
        progress();
    }

    function ensureYT() {
        if (ytPromise) return ytPromise;
        ytPromise = new Promise((resolve, reject) => {
            const create = () => {
                ytPlayer = new YT.Player('yt-player', {
                    height: '1',
                    width: '1',
                    playerVars: { controls: 0, playsinline: 1, rel: 0 },
                    events: {
                        onReady: () => { ytReadyFlag = true; applyVolume(); applyMute(); resolve(); },
                        onStateChange: onYTState,
                        onError: e => note(YT_ERR[e.data] || 'Video YouTube tidak dapat diputar')
                    }
                });
            };
            if (window.YT && YT.Player) return create();
            const prev = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => { if (prev) prev(); create(); };
            const s = document.createElement('script');
            s.src = 'https://www.youtube.com/iframe_api';
            s.onerror = () => { ytPromise = null; reject(new Error('iframe_api')); };
            document.head.appendChild(s);
        });
        return ytPromise;
    }

    function play(i) {
        if (i < 0 || i >= tracks.length) return;
        index = i;
        const t = tracks[i];
        if (t.type === 'yt') {
            if (audio.getAttribute('src')) audioEng.stop();
            active = 'yt';
            ytCurrent = t.id;
            meta();
            note('Memuat YouTube…');
            ensureYT()
                .then(() => { ytPlayer.loadVideoById(t.id); note('YouTube'); })
                .catch(() => note('YouTube gagal dimuat, cek koneksi'));
        } else {
            if (ytReadyFlag) ytEng.stop();
            active = 'audio';
            ytCurrent = null;
            meta();
            note('Memuat audio…');
            audio.src = t.url;
            audio.play().then(() => note('Direct audio')).catch(() => note('Tekan ▶ atau periksa URL'));
        }
        playBtn();
        progress();
    }

    function add(input) {
        const r = parse(input, tracks.length + 1);
        if (r.error) { note(r.error); return false; }
        let i = tracks.findIndex(t => t.url === r.track.url);
        if (i === -1) { tracks.push(r.track); i = tracks.length - 1; save(); }
        play(i);
        return true;
    }

    function next(auto) {
        if (!tracks.length) return;
        if (auto && repeat && index >= 0) { eng().seek(0); eng().play(); return; }
        let n;
        if (shuffle && tracks.length > 1) { do { n = Math.floor(Math.random() * tracks.length); } while (n === index); }
        else { n = index + 1; if (n >= tracks.length) { if (!auto) return; n = 0; } }
        play(n);
    }

    function prev() {
        if (!tracks.length) return;
        if (eng().time() > 3) { eng().seek(0); return; }
        play(index <= 0 ? tracks.length - 1 : index - 1);
    }

    function init() {
        audio = $('music-audio');
        const panel = $('music-panel'), addRow = $('music-add-row'), url = $('music-url-input');
        const vol = $('music-volume'), mute = $('btn-music-mute'), bar = $('music-progress');

        load();
        index = tracks.length ? 0 : -1;
        volume = Number(vol.value) / 100;
        applyVolume();
        meta(); playBtn(); progress();
        setInterval(() => { if (active === 'yt' && ytReadyFlag) progress(); }, 500);

        $('btn-music-toggle').addEventListener('click', () => {
            const open = panel.classList.toggle('hide') === false;
            $('btn-music-toggle').setAttribute('aria-expanded', String(open));
        });
        $('btn-music-close').addEventListener('click', () => panel.classList.add('hide'));
        $('btn-music-play').addEventListener('click', () => {
            if (!tracks.length) { addRow.classList.remove('hide'); url.focus(); return; }
            if (eng().playing()) return eng().pause();
            if (!loaded()) return play(index < 0 ? 0 : index);
            const r = eng().play();
            if (r && r.catch) r.catch(() => note('Periksa URL audio'));
        });
        $('btn-music-next').addEventListener('click', () => next(false));
        $('btn-music-prev').addEventListener('click', prev);

        vol.addEventListener('input', () => {
            volume = Number(vol.value) / 100;
            muted = false;
            applyVolume();
            applyMute();
            mute.innerHTML = muteIcon();
        });
        mute.addEventListener('click', () => {
            muted = !muted;
            applyMute();
            mute.innerHTML = muteIcon();
        });
        mute.innerHTML = muteIcon();

        bar.addEventListener('pointerdown', () => { seeking = true; });
        bar.addEventListener('input', () => {
            const d = eng().length();
            if (d > 0) eng().seek(bar.value / 1000 * d);
        });
        const endSeek = () => { seeking = false; progress(); };
        bar.addEventListener('change', endSeek);
        bar.addEventListener('pointerup', endSeek);

        $('btn-music-add-toggle').addEventListener('click', () => { addRow.classList.toggle('hide'); url.focus(); });
        const submit = () => { if (add(url.value)) { url.value = ''; addRow.classList.add('hide'); } };
        $('btn-music-add').addEventListener('click', submit);
        url.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });

        $('btn-music-clear').addEventListener('click', () => {
            tracks = []; index = -1; save();
            audioEng.stop();
            if (ytReadyFlag) ytEng.stop();
            active = null; ytCurrent = null;
            meta(); playBtn(); progress();
        });
        $('btn-music-repeat').addEventListener('click', e => { repeat = !repeat; e.currentTarget.classList.toggle('active', repeat); });
        $('btn-music-shuffle').addEventListener('click', e => { shuffle = !shuffle; e.currentTarget.classList.toggle('active', shuffle); });

        audio.addEventListener('play', playBtn);
        audio.addEventListener('pause', playBtn);
        audio.addEventListener('timeupdate', progress);
        audio.addEventListener('durationchange', progress);
        audio.addEventListener('loadedmetadata', () => { progress(); if (active === 'audio') note('Direct audio'); });
        audio.addEventListener('ended', () => next(true));
        audio.addEventListener('error', () => { if (audio.currentSrc) note('URL audio tidak dapat diputar'); playBtn(); progress(); });
    }

    SAMC.music = { init };
})();


(function () {
    const $ = id => document.getElementById(id);

    function init() {
        if (new URLSearchParams(location.search).get('demo') !== '1') return;
        const panel = $('demo-panel');
        panel.classList.remove('hide');

        const demo = { left: false, right: false, lights: 0, seatbelt: true, engine: true, gear: 1 };
        const sliders = {
            speed: { suffix: ' km/h', show: v => v },
            rpm: { suffix: 'k', show: v => (v / 10).toFixed(1) },
            fuel: { suffix: '%', show: v => v },
            health: { suffix: '%', show: v => v }
        };

        const send = () => SAMC.hud.apply({
            speed: Number($('demo-speed').value) / 3.6,
            rpm: Number($('demo-rpm').value) / 100,
            fuel: Number($('demo-fuel').value) / 100,
            health: Number($('demo-health').value) / 100,
            gear: demo.gear,
            engine: demo.engine,
            headlights: demo.lights,
            leftIndicator: demo.left,
            rightIndicator: demo.right,
            seatbelt: demo.seatbelt,
            odometer: 123.4
        });

        Object.keys(sliders).forEach(name => {
            const input = $('demo-' + name);
            input.addEventListener('input', () => {
                $('demo-' + name + '-v').textContent = sliders[name].show(input.value) + sliders[name].suffix;
                send();
            });
        });

        panel.querySelectorAll('button[data-demo]').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.demo;
                if (key === 'gear') demo.gear = Number(btn.dataset.value);
                else if (key === 'lights') demo.lights = demo.lights ? 0 : 3;
                else demo[key] = !demo[key];
                if (key !== 'gear') btn.classList.toggle('on', !!demo[key]);
                send();
            });
        });
        send();
    }

    SAMC.demo = { init };
})();


(function () {
    const ACTIONS = ['vehicle', 'speedometer', 'update', 'telemetry'];
    const KEYS = ['speed', 'rpm', 'fuel', 'health', 'gear'];

    function isTelemetry(d) {
        const action = typeof d.action === 'string' ? d.action.toLowerCase() : '';
        const type = typeof d.type === 'string' ? d.type.toLowerCase() : '';
        return ACTIONS.includes(action) || ACTIONS.includes(type) || KEYS.some(k => d[k] !== undefined);
    }

    window.addEventListener('message', e => {
        try {
            let d = e.data;
            if (typeof d === 'string') d = JSON.parse(d);
            if (!d || typeof d !== 'object') return;
            if (d.action === 'visible') SAMC.hud.setVisible(d.visible !== false);
            else if (isTelemetry(d)) SAMC.hud.apply(d);
        } catch (err) {
            console.error('[SAMC] message error', err);
        }
    });

    const setter = key => value => SAMC.hud.apply({ [key]: value });
    window.SAMCSpeedo = {
        update: d => SAMC.hud.apply(d),
        setSpeed: setter('speed'),
        setRPM: setter('rpm'),
        setFuel: setter('fuel'),
        setHealth: setter('health'),
        setGear: setter('gear'),
        setEngine: setter('engine'),
        setHeadlights: setter('headlights'),
        setLeftIndicator: setter('leftIndicator'),
        setRightIndicator: setter('rightIndicator'),
        setSeatbelts: setter('seatbelt'),
        setOdometer: setter('odometer'),
        setSpeedMode: mode => SAMC.hud.setSpeedMode(mode)
    };

    ['setEngine', 'setSpeed', 'setRPM', 'setFuel', 'setHealth', 'setGear', 'setHeadlights',
        'setLeftIndicator', 'setRightIndicator', 'setSeatbelts', 'setOdometer', 'setSpeedMode']
        .forEach(name => { window[name] = window.SAMCSpeedo[name]; });

    document.addEventListener('DOMContentLoaded', () => {
        SAMC.hud.init();
        SAMC.sync.init();
        SAMC.music.init();
        SAMC.demo.init();
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => SAMC.gauge.redraw());
    });
})();
