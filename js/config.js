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
