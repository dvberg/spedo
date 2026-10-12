(function () {
    const KEY = SAMC.config.storage.playlist;
    const $ = id => document.getElementById(id);
    let audio, tracks = [], index = -1, repeat = false, shuffle = false, seeking = false;

    const fmt = s => {
        const n = Math.floor(Number(s));
        return Number.isFinite(n) && n >= 0 ? Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0') : '0:00';
    };

    function normalizeUrl(input) {
        try {
            const u = new URL(String(input || '').trim());
            if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
            const h = u.hostname.toLowerCase().replace(/^www\./, '');
            if (/(^|\.)(youtube\.com|youtube-nocookie\.com)$/.test(h) || h === 'youtu.be') return null;
            return u.href;
        } catch (_) { return null; }
    }

    function titleFrom(url, n) {
        try {
            let name = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
            try { name = decodeURIComponent(name); } catch (_) {}
            name = name.replace(/\.(mp3|ogg|oga|wav|m4a|aac|opus|flac|webm)$/i, '').replace(/[._]+/g, ' ').trim();
            if (name && !/^[a-f0-9]{18,}$/i.test(name)) return name.slice(0, 80);
        } catch (_) {}
        return 'Audio ' + n;
    }

    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(tracks)); } catch (_) {} };

    function load() {
        try {
            const raw = JSON.parse(localStorage.getItem(KEY));
            tracks = (Array.isArray(raw) ? raw : []).map((t, i) => {
                const url = t && normalizeUrl(t.url || t.id);
                return url ? { url, title: String(t.title || titleFrom(url, i + 1)).slice(0, 100) } : null;
            }).filter(Boolean);
        } catch (_) { tracks = []; }
    }

    const note = msg => { $('music-track-subtitle').textContent = msg; };

    function renderList() {
        const list = $('music-playlist');
        list.replaceChildren();
        if (!tracks.length) {
            const e = document.createElement('div');
            e.className = 'music-empty';
            e.textContent = 'Belum ada lagu. Tekan ＋ untuk tempel URL audio.';
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
            row.append('♫ ', name, num);
            row.addEventListener('click', () => play(i));
            list.appendChild(row);
        });
    }

    function meta() {
        const t = tracks[index];
        $('music-track-title').textContent = t ? t.title : 'Belum ada lagu';
        note(t ? 'Direct audio' : 'Tempel URL audio');
        renderList();
    }

    function playBtn() {
        const playing = !audio.paused && !audio.ended;
        $('btn-music-play').textContent = playing ? '❚❚' : '▶';
    }

    function progress() {
        const d = audio.duration, ok = Number.isFinite(d) && d > 0;
        $('music-current-time').textContent = fmt(audio.currentTime);
        $('music-duration').textContent = ok ? fmt(d) : '--:--';
        const bar = $('music-progress');
        bar.disabled = !ok;
        if (!seeking) bar.value = ok ? Math.round(audio.currentTime / d * 1000) : 0;
    }

    function play(i) {
        if (i < 0 || i >= tracks.length) return;
        index = i;
        meta();
        note('Memuat audio…');
        audio.src = tracks[i].url;
        audio.play().then(() => note('Direct audio')).catch(() => note('Tekan ▶ atau periksa URL'));
    }

    function add(input) {
        const url = normalizeUrl(input);
        if (!url) { note('Gunakan URL langsung ke file audio, bukan YouTube'); return false; }
        let i = tracks.findIndex(t => t.url === url);
        if (i === -1) { tracks.push({ url, title: titleFrom(url, tracks.length + 1) }); i = tracks.length - 1; save(); }
        play(i);
        return true;
    }

    function next(auto) {
        if (!tracks.length) return;
        if (auto && repeat && index >= 0) { audio.currentTime = 0; audio.play(); return; }
        let n;
        if (shuffle && tracks.length > 1) { do { n = Math.floor(Math.random() * tracks.length); } while (n === index); }
        else { n = index + 1; if (n >= tracks.length) { if (!auto) return; n = 0; } }
        play(n);
    }

    function prev() {
        if (!tracks.length) return;
        if (audio.currentTime > 3) { audio.currentTime = 0; return; }
        play(index <= 0 ? tracks.length - 1 : index - 1);
    }

    function init() {
        audio = $('music-audio');
        const panel = $('music-panel'), addRow = $('music-add-row'), url = $('music-url-input');
        const vol = $('music-volume'), mute = $('btn-music-mute'), bar = $('music-progress');

        load();
        index = tracks.length ? 0 : -1;
        audio.volume = Number(vol.value) / 100;
        meta(); playBtn(); progress();

        $('btn-music-toggle').addEventListener('click', () => {
            const open = panel.classList.toggle('hide') === false;
            $('btn-music-toggle').setAttribute('aria-expanded', String(open));
        });
        $('btn-music-close').addEventListener('click', () => panel.classList.add('hide'));
        $('btn-music-play').addEventListener('click', () => {
            if (!tracks.length) { addRow.classList.remove('hide'); url.focus(); return; }
            if (!audio.paused && !audio.ended) return audio.pause();
            if (!audio.src) return play(index);
            audio.play().catch(() => note('Periksa URL audio'));
        });
        $('btn-music-next').addEventListener('click', () => next(false));
        $('btn-music-prev').addEventListener('click', prev);

        vol.addEventListener('input', () => {
            audio.volume = Number(vol.value) / 100;
            audio.muted = false;
            mute.textContent = audio.volume === 0 ? '🔇' : '🔊';
        });
        mute.addEventListener('click', () => {
            audio.muted = !audio.muted;
            mute.textContent = audio.muted ? '🔇' : '🔊';
        });

        bar.addEventListener('pointerdown', () => { seeking = true; });
        bar.addEventListener('input', () => {
            if (audio.duration > 0) audio.currentTime = bar.value / 1000 * audio.duration;
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
            audio.pause(); audio.removeAttribute('src'); audio.load();
            meta(); playBtn(); progress();
        });
        $('btn-music-repeat').addEventListener('click', e => { repeat = !repeat; e.currentTarget.classList.toggle('active', repeat); });
        $('btn-music-shuffle').addEventListener('click', e => { shuffle = !shuffle; e.currentTarget.classList.toggle('active', shuffle); });

        audio.addEventListener('play', playBtn);
        audio.addEventListener('pause', playBtn);
        audio.addEventListener('timeupdate', progress);
        audio.addEventListener('durationchange', progress);
        audio.addEventListener('loadedmetadata', () => { progress(); note('Direct audio'); });
        audio.addEventListener('ended', () => next(true));
        audio.addEventListener('error', () => { if (audio.currentSrc) note('URL audio tidak dapat diputar'); playBtn(); progress(); });
    }

    SAMC.music = { init };
})();
