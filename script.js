let elements = {};
let speedMode = 1;
let indicators = 0;

const onOrOff = state => state ? 'On' : 'Off';

/**
 * Updates the display of the engine state.
 *
 * @param {boolean} state If true, the engine is on; otherwise, it is off.
 * @description Sets the engine state display based on the provided boolean state.
 */
function setEngine(state) {
    elements.engine.innerText = onOrOff(state);
}

/**
 * Updates the speed display based on the current speed mode.
 * @param {number} speed - The speed value in meters per second (m/s).
 * @description Converts the speed value to the current speed mode and updates the display.
 */
function setSpeed(speed) {
    switch(speedMode)
    {
        case 1: speed = elements.speed.innerText = `${Math.round(speed * 2.236936)} MPH`; break; // MPH
        case 2: speed = elements.speed.innerText = `${Math.round(speed * 1.943844)} Knots`; break; // Knots
        default: speed = elements.speed.innerText = `${Math.round(speed * 3.6)} KMH`; // KMH
    }
}

/**
 * Updates the RPM (Revolutions Per Minute) display.
 * @param {number} rpm - The RPM value to display. (0 to 1).
 */
function setRPM(rpm) {
    elements.rpm.innerText = `${rpm.toFixed(4)} RPM`;
}

/**
 * Updates the fuel level display as a percentage.
 * @param {number} fuel - The fuel level (0 to 1).
 */
function setFuel(fuel) {
    elements.fuel.innerText = `${(fuel * 100).toFixed(1)}%`;
}

/**
 * Updates the vehicle health display as a percentage.
 * @param {number} health - The vehicle health level (0 to 1).
 */
function setHealth(health) {
    elements.health.innerText = `${(health * 100).toFixed(1)}%`;
}

/**
 * Updates the current gear display.
 * @param {number} gear - The current gear to display. 0 represents neutral/reverse.
 */
function setGear(gear) {
    elements.gear.innerText = String(gear);
}

/**
 * Updates the headlights status display.
 * @param {number} state - The headlight state (0: Off, 1: On, 2: High Beam).
 */
function setHeadlights(state) {
    switch(state)
    {
        case 1: elements.headlights.innerText = 'On'; break;
        case 2: elements.headlights.innerText = 'High Beam'; break;
        default: elements.headlights.innerText = 'Off';
    }
}

/**
 * Sets the state of the left turn indicator and updates the display.
 * @param {boolean} state - If true, turns the left indicator on; otherwise, turns it off.
 */
function setLeftIndicator(state) {
    indicators = (indicators & 0b10) | (state ? 0b01 : 0b00);
    elements.indicators.innerText = `${indicators & 0b01 ? 'On' : 'Off'} / ${indicators & 0b10 ? 'On' : 'Off'}`;
}

/**
 * Sets the state of the right turn indicator and updates the display.
 * @param {boolean} state - If true, turns the right indicator on; otherwise, turns it off.
 */
function setRightIndicator(state) {
    indicators = (indicators & 0b01) | (state ? 0b10 : 0b00);
    elements.indicators.innerText = `${indicators & 0b01 ? 'On' : 'Off'} / ${indicators & 0b10 ? 'On' : 'Off'}`;
}

/**
 * Updates the seatbelt status display.
 * @param {boolean} state - If true, indicates seatbelts are fastened; otherwise, indicates they are not.
 */
function setSeatbelts(state) {
    elements.seatbelts.innerText = onOrOff(state);
}

/**
 * Sets the speed display mode and updates the speed unit display.
 * @param {number} mode - The speed mode to set (0: KMH, 1: MPH, 2: Knots).
 */
function setSpeedMode(mode) {
    speedMode = mode;
}

/**
 * Updates the odometer display.
 * @param {number} distance - The distance in miles.
 */
function setOdometer(distance)
{
    elements.odometer.innerText = distance.toFixed(1) + ' Miles';
}

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    elements = {
        engine: document.getElementById('engine'),
        speed: document.getElementById('speed'),
        rpm: document.getElementById('rpm'),
        fuel: document.getElementById('fuel'),
        health: document.getElementById('health'),
        gear: document.getElementById('gear'),
        headlights: document.getElementById('headlights'),
        indicators: document.getElementById('indicators'),
        seatbelts: document.getElementById('seatbelts'),
        odometer: document.getElementById('odometer'),
    };
});

// Telemetry bridge for the game (NUI postMessage). Maps incoming fields to the template functions above.
window.addEventListener('message', event => {
    let data = event.data;
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { return; }
    }
    if (!data || typeof data !== 'object') return;

    const p = (data.data && typeof data.data === 'object') ? data.data : data;
    if (!elements.speed) return;

    if (p.speed !== undefined) setSpeed(Number(p.speed) || 0);
    if (p.rpm !== undefined) setRPM(Number(p.rpm) || 0);
    if (p.fuel !== undefined) setFuel(normalize(p.fuel));
    if (p.health !== undefined) setHealth(normalize(p.health));
    if (p.gear !== undefined) setGear(p.gear);
    if (p.engine !== undefined) setEngine(!!p.engine);
    if (p.headlights !== undefined) setHeadlights(Number(p.headlights) || 0);
    if (p.leftIndicator !== undefined) setLeftIndicator(!!p.leftIndicator);
    if (p.rightIndicator !== undefined) setRightIndicator(!!p.rightIndicator);
    if (p.seatbelt !== undefined) setSeatbelts(!!p.seatbelt);
    if (p.odometer !== undefined) setOdometer(Number(p.odometer) || 0);
    if (p.speedMode !== undefined) setSpeedMode(Number(p.speedMode));
    if (p.visible !== undefined) document.querySelector('main').style.display = p.visible ? '' : 'none';
});

function normalize(value) {
    const n = Number(value) || 0;
    return n > 1 ? Math.max(0, Math.min(100, n)) / 100 : Math.max(0, Math.min(1, n));
}
