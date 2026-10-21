# SAMC Speedo

Dashboard kecepatan HUD (HTML/CSS/JS statis) untuk NUI FiveM dan GitHub Pages.

## Cara pakai

Buka `index.html`. Untuk menampilkan panel demo, tambahkan `?demo=1`.

Sync antar layar memakai PeerJS:
- `?mode=host` untuk host
- `?mode=client&code=XXXXXX` untuk client

## Layout

Pilih layout lewat `?layout=a` sampai `?layout=f`. Pilihan disimpan di localStorage (`spedo_layout`), dan default-nya layout `b`. Bisa juga diganti lewat kode: `SAMCSpeedo.setLayout('f')`.

- `a`: ringkas
- `b`: tengah (default)
- `c`: lebar
- `d`: vertikal
- `e`: Ghost, melayang tanpa panel
- `f`: LCD transparan, bar RPM vertikal dan latar speed gradasi

## Pengaturan

Tombol slider di toolbar HUD membuka panel pengaturan: warna aksen, ukuran, opasitas, dan ambang peringatan (speed, fuel, sabuk). Disimpan di localStorage (`spedo_custom`) dan bisa direset.

- Speed melewati ambang: angka merah dan berkedip.
- Fuel di bawah ambang: bar merah.
- Sabuk belum dipasang dan speed di atas ambang: ikon sabuk berkedip.
- Fokus HUD (Tab) lalu panah untuk menggeser 8px, Shift 24px. HUD dijaga tetap di dalam layar.
- Panel musik dan pengaturan muncul di sisi yang lebih lega.
- Ambang speed dan sabuk mengikuti satuan yang tampil (KMH, MPH, Knots).
- Ekspor menyalin pengaturan sebagai JSON, Impor memuatnya kembali (nilai di luar rentang dijepit).

## Satuan

- Speed: meter per detik (m/s). Bisa diberi `speedUnit: 'km/h'`, `'kmh'`, `'kph'`, atau `'mph'` agar dikonversi otomatis.
- RPM: 0ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“1.
- Fuel dan health: 0ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“1, atau 0ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“100 (dikonversi otomatis).
- Odometer: mil.

## Fungsi global

Semua fungsi ini tersedia di `window`:

```javascript
setEngine(true);
setSpeed(25);          // m/s
setRPM(0.55);          // 0ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“1
setFuel(0.75);         // 0ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“1
setHealth(0.9);        // 0ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“1
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

Panel musik (tombol ÃƒÂ¢Ã¢â€žÂ¢Ã‚Â« di kiri atas) mendukung:
- Link YouTube
- Link audio langsung
- Link Spotify (ditampilkan lewat embed)
- Link Google Drive dan Dropbox (otomatis diubah ke tautan unduhan)

Pemutaran YouTube bisa gagal di lingkungan yang membatasi embed (misalnya NUI). Pesan error akan tampil di panel musik dengan kodenya.

## Pengurangan gerakan

Animasi kedip dinonaktifkan jika sistem meminta `prefers-reduced-motion`.

## Struktur file

- `index.html`: markup HUD, panel musik, panel sync, dan panel demo
- `style.css`: gaya dasar
- `layouts/`: satu file CSS per layout
- `app.js`: logika HUD, telemetry, musik, sync, dan demo
- `peer.js`: library PeerJS (vendor, jangan diubah)
- `assets/`: font Formula1

## Uji

Buka 	ests/smoke.html di browser (file:// perlu --allow-file-access-from-files). Hasilnya ringkasan lolos/gagal per layout A-F.
