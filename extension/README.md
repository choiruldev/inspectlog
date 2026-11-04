# InspectLog Chrome Extension Companion (Manifest V3)

Ekstensi browser resmi untuk merekam deep traffic API (Payload, Response Body, Status) dan console logs langsung dari tab browser yang sedang dibuka.

### Keunggulan Ekstensi:
1. **Website Ber-Login / Internal**: Menggunakan sesi login dan cookies yang sedang aktif di browser Anda.
2. **Localhost & Intranet**: Mampu meng-inspect `localhost:3000`, development server, atau website di balik VPN perusahaan.
3. **Privasi**: Data diproses langsung di browser lokal Anda tanpa dikirim ke server pihak ketiga.

---

### Cara Pasang di Google Chrome / Edge / Brave:

1. Buka browser Chrome, buka URL: `chrome://extensions`
2. Aktifkan **"Developer mode"** di pojok kanan atas.
3. Klik tombol **"Load unpacked"** di pojok kiri atas.
4. Pilih folder: `/Users/irul/Documents/PROJECT/inspect-web/extension`
5. Ekstensi **InspectLog** akan langsung muncul di toolbar browser!

---

### Cara Pakai:
1. Buka website target apa saja (misal: dashboard toko Anda, checkout, atau `localhost:3000`).
2. Klik ikon InspectLog di toolbar Chrome.
3. Klik **"Mulai Rekam Traffic"**.
4. Lakukan aktivitas di website (klik tombol, submit form checkout, dsb.).
5. Klik **"Berhenti & Kumpulkan Data"**.
6. Klik **"Download JSON Report"** untuk analisis atau upload ke dashboard InspectLog.
