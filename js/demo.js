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
