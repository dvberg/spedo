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
