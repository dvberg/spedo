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
        $('btn-client-connect').classList.toggle('hide', role === 'client');
        $('btn-client-disconnect').classList.toggle('hide', role !== 'client');
    }

    function showTab(tab) {
        $('tab-host').classList.toggle('active', tab === 'host');
        $('tab-client').classList.toggle('active', tab === 'client');
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
        try { $('sync-client-input').value = localStorage.getItem(cfg.storage.syncCode) || ''; } catch (_) {}

        const panel = $('sync-panel');
        $('btn-sync').addEventListener('click', e => { e.stopPropagation(); panel.classList.toggle('hide'); });
        $('btn-sync-close').addEventListener('click', () => panel.classList.add('hide'));
        $('tab-host').addEventListener('click', () => showTab('host'));
        $('tab-client').addEventListener('click', () => showTab('client'));
        $('btn-host-connect').addEventListener('click', startHost);
        $('btn-host-disconnect').addEventListener('click', () => stop());
        $('btn-client-disconnect').addEventListener('click', () => stop());
        $('btn-restore-hud').addEventListener('click', () => stop());
        $('btn-client-connect').addEventListener('click', () => {
            const v = $('sync-client-input').value.trim().toUpperCase();
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
            if (mode === 'client') $('sync-client-input').value = qCode;
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
