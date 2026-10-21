# AGENTS.md - SAMC Speedo

## Struktur
- `index.html`: markup HUD, panel Pengaturan (`custom-panel`), panel sync, panel musik.
- `app.js`: satu file, berisi gauge, HUD (`SAMC.hud`), sync PeerJS, musik, dan `window.SAMCSpeedo`. Jangan dipecah.
- `style.css`: gaya dasar dan variabel `:root`. `layouts/*.css`: satu file per layout, semua dipilih lewat `body[data-layout]`.
- `tests/smoke.html`: uji semua layout. Jalankan di Edge dengan `--allow-file-access-from-files`.

## Konvensi
- Bahasa UI dan komentar: Indonesia.
- `setRPM` menerima 0-1. Jangan ubah semantiknya. `_headers` dan filter origin `postMessage` jangan dihapus.
- Aksen: `--amber` dan `--green` diganti dari panel Pengaturan. Layout F memakai `--f-rgb` (RGB tanpa `#`), bila kosong cyan bawaan.
- Ambang peringatan memakai angka yang tampil (mengikuti satuan speed), bukan selalu MPH.

## localStorage
- `spedo_settings`: posisi dan skala HUD. `spedo_layout`: layout aktif. `spedo_custom`: aksen, opasitas, ambang.
- `spedo_sync_code`: kode sync terakhir. `samc_music_audio_playlist_v2`: playlist.

## Gotcha
- File di repo ini berakhir baris CRLF di working copy Windows. Edit teks multibaris lewat skrip harus memakai `\r\n`.
- Di PowerShell, jangan menamai fungsi `R` (bentrok dengan alias `r`/`Invoke-History`).
- rAF tidak jalan penuh di Edge headless, dan jalur folder temp `opencode` berisi karakter tak terlihat di beberapa lokasi.