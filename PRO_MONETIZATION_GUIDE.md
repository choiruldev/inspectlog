# Panduan Pengaktifan Fitur Berbayar & Monetisasi (Pro Tier)
> **Catatan:** Saat ini InspectLog berjalan dalam mode **100% Gratis / Community Edition** untuk memudahkan akuisisi pengguna awal dan pengujian tanpa batas. Semua mesin pembayaran, webhook, dan database billing **sudah selesai dibuat** dan siap diaktifkan kapan saja.

Dokumen ini adalah memori instruksi teknis jika di masa mendatang Anda ingin mulai menarik biaya berlangganan Pro dari pengguna.

---

## 1. Arsitektur Monetisasi yang Sudah Tersedia

Sistem billing InspectLog dibangun dengan komponen lengkap:

| Komponen | Lokasi File | Fungsi |
| :--- | :--- | :--- |
| **API Pembuat Tagihan** | `app/api/payment/create/route.ts` | Membuat token transaksi Midtrans Snap & mencatat invoice di SQLite. |
| **Webhook Pembayaran** | `app/api/payment/webhook/route.ts` | Menerima notifikasi otomatis saat uang masuk, lalu menaikkan role user dari `free` menjadi `pro`. |
| **Simulasi Sandbox** | `app/payment/simulate/page.tsx` | UI struk invoice untuk menguji simulasi bayar tanpa uang riil. |
| **Tabel Database** | `data/inspect.db` -> `invoices` & `users` | Mencatat nomor invoice, nominal, metode bayar, dan status aktif Pro. |

---

## 2. Cara Mengaktifkan Kembali Tampilan Berbayar (2 Langkah)

### Langkah 1: Aktifkan Flag di Halaman Monitoring
Buka file [`app/monitoring/page.tsx`](file:///Users/irul/Documents/PROJECT/inspect-web/app/monitoring/page.tsx) baris ~62:
```typescript
// UBAH DARI:
const ENABLE_PAID_TIER = false;

// MENJADI:
const ENABLE_PAID_TIER = true;
```
*Efek*: Tombol **"Plans & Pricing"**, modal paket langganan (Bulanan & Tahunan), dan opsi upgrade Pro otomatis kembali muncul di dashboard monitoring.

### Langkah 2: Kembalikan Badge "Pro" di Navbar Utama
Buka file [`app/page.tsx`](file:///Users/irul/Documents/PROJECT/inspect-web/app/page.tsx) baris ~575:
```tsx
<Link href="/monitoring" className="...">
  <Bell className="w-3.5 h-3.5 text-zinc-400" />
  <span>Monitor</span>
  {/* Tambahkan kembali badge Pro di bawah ini */}
  <span className="text-[10px] uppercase font-bold text-amber-400 px-1 rounded bg-amber-950/60 border border-amber-900/50">Pro</span>
</Link>
```

---

## 3. Menghubungkan ke Akun Midtrans Asli (Menerima Rupiah Riil)

Saat ingin menerima uang sungguhan via QRIS, GoPay, OVO, ShopeePay, dan Transfer Bank BCA/Mandiri/BRI:

1. **Daftar Akun Midtrans**:
   - Kunjungi [https://midtrans.com](https://midtrans.com) dan buat akun (bisa perorangan atau badan usaha).
2. **Ambil API Keys**:
   - Masuk ke Dashboard Midtrans -> menu **Settings** -> **Access Keys**.
   - Salin **Server Key** dan **Client Key** Production.
3. **Isi di file `.env` di server Anda**:
   ```env
   NODE_ENV=production
   MIDTRANS_SERVER_KEY=Mid-server-xxxxxxxxxxxxxxxx
   MIDTRANS_CLIENT_KEY=Mid-client-xxxxxxxxxxxxxxxx
   ENABLE_PAYMENT_SIMULATOR=false
   ```
4. **Pasang Webhook URL di Dashboard Midtrans**:
   - Masuk ke Dashboard Midtrans -> **Settings** -> **Configuration**.
   - Pada kolom **Payment Notification URL**, isi URL domain publik Anda:
     `https://domain-kamu.com/api/payment/webhook`

Begitu customer selesai transfer / scan QRIS, server Midtrans akan mengirim sinyal ke webhook ini dan akun customer langsung otomatis berstatus **PRO** detik itu juga!

---

## 4. Mengubah Nominal Harga Paket Langganan

Jika ingin menaikkan atau menurunkan harga langganan:

1. **Harga Tampilan Modal**:
   - Edit teks harga di [`app/monitoring/page.tsx`](file:///Users/irul/Documents/PROJECT/inspect-web/app/monitoring/page.tsx) (bagian modal Pro Tier):
     - Paket Bulanan: `Rp 49.000 / bulan`
     - Paket Tahunan: `Rp 399.000 / tahun`
2. **Nominal Invoice Backend**:
   - Edit nilai nominal tagihan di [`app/api/payment/create/route.ts`](file:///Users/irul/Documents/PROJECT/inspect-web/app/api/payment/create/route.ts):
     ```typescript
     const amount = plan === "annual" ? 399000 : 49000;
     ```

---

## 5. Menguji Coba Alur Bayar Tanpa Biaya (Mode Simulator)

Sebelum memakai akun Midtrans asli, Anda bisa menguji alur pembayaran lokal kapan saja:
1. Jalankan aplikasi: `http://localhost:3000`
2. Buka simulator: `http://localhost:3000/payment/simulate?invoice=INV-202611-PRO01`
3. Klik tombol **"Simulasikan Pembayaran Sukses (Sandbox)"**.
4. Sistem akan mengeksekusi webhook simulasi dan mengubah akun menjadi `role: "pro"` di SQLite.
