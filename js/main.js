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
        setOdometer: setter('odometer')
    };

    document.addEventListener('DOMContentLoaded', () => {
        SAMC.hud.init();
        SAMC.sync.init();
        SAMC.music.init();
        SAMC.demo.init();
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => SAMC.gauge.redraw());
    });
})();
