# SAMC Speedo

Dashboard kecepatan HUD (HTML/CSS/JS statis) untuk NUI FiveM dan GitHub Pages.

## Cara pakai

Buka `index.html`. Untuk menampilkan panel demo, tambahkan `?demo=1`.

Sync antar layar memakai PeerJS:
- `?mode=host` untuk host
- `?mode=client&code=XXXXXX` untuk client

## Satuan

- Speed: meter per detik (m/s). Bisa diberi `speedUnit: 'km/h'`, `'kmh'`, `'kph'`, atau `'mph'` agar dikonversi otomatis.
- RPM: 0–1.
- Fuel dan health: 0–1, atau 0–100 (dikonversi otomatis).
- Odometer: mil.

## Fungsi global

Semua fungsi ini tersedia di `window`:

```javascript
setEngine(true);
setSpeed(25);          // m/s
setRPM(0.55);          // 0–1
setFuel(0.75);         // 0–1
setHealth(0.9);        // 0–1
setGear(3);
setHeadlights(1);      // 0 = mati, 1 = nyala
setLeftIndicator(true);
setRightIndicator(true);
setSeatbelts(true);
setOdometer(123.4);
setSpeedMode(1);       // 0 = KMH, 1 = MPH, 2 = Knots
```

Objek `window.SAMCSpeedo` menyediakan fungsi yang sama dengan nama `setSpeed`, `setRPM`, dan seterusnya, plus `update(data)` untuk memperbarui beberapa field sekaligus.

## Telemetry lewat postMessage

Halaman menerima pesan `window.postMessage` dengan objek atau string JSON:

```javascript
window.postMessage({
    action: 'vehicle',
    speed: 30,
    rpm: 0.7,
    fuel: 0.4,
    health: 0.9,
    gear: 3,
    engine: true,
    seatbelt: false,
    leftIndicator: true,
    rightIndicator: false,
    headlights: 1,
    odometer: 42.5,
    visible: true
}, '*');
```

Action yang dikenali: `vehicle`, `speedometer`, `update`, `telemetry`, dan `visible` (dengan field `visible`).

## Musik

Panel musik (tombol ♫ di kiri atas) mendukung:
- Link YouTube
- Link audio langsung
- Link Google Drive dan Dropbox (otomatis diubah ke tautan unduhan)

Pemutaran YouTube bisa gagal di lingkungan yang membatasi embed (misalnya NUI). Pesan error akan tampil di panel musik dengan kodenya.

## Pengurangan gerakan

Animasi kedip dinonaktifkan jika sistem meminta `prefers-reduced-motion`.

## Struktur file

- `index.html`: markup HUD, panel musik, panel sync, dan panel demo
- `style.css`: seluruh gaya
- `app.js`: logika HUD, telemetry, musik, sync, dan demo
- `peer.js`: library PeerJS (vendor, jangan diubah)
- `assets/`: font Formula1
