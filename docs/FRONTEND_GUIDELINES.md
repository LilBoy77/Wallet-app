# FRONTEND_GUIDELINES — Panduan Arsitektur & Desain Antarmuka Frontend

Dokumen ini memuat standar rekayasa kode, arsitektur komponen, integrasi data, dan sistem desain visual modern untuk aplikasi klien **`apps/web`** (React + TypeScript + Vite + Tailwind CSS).

---

## 1. Filosofi Desain Visual Fintech Modern `[DECIDED]`
Aplikasi keuangan memerlukan tampilan yang memancarkan **kepercayaan (trust), presisi, kejelasan informasi, dan kenyamanan visual**.
- **Larangan Desain Generik**: Dilarang menggunakan warna HTML bawaan (merah/biru/hijau mentah tanpa kurasi) atau tata letak tabel polos kaku tanpa hierarki visual.
- **Design Tokens & Palet Warna**:
  - *Primary / Accent*: Indigo / Emerald Deep (`#0f172a` Slate Navy untuk latar kontras, `#10b981` Emerald untuk pemasukan / saldo surplus, `#6366f1` Indigo Modern untuk aksen interaktif).
  - *Danger / Expense*: Rose Soft (`#f43f5e`) untuk pengeluaran dan status gagal.
  - *Neutral Surface*: Slate Palette (`#f8fafc`, `#f1f5f9`, `#e2e8f0` di light mode; `#0f172a`, `#1e293b` di dark mode).
- **Tipografi Modern**: Gunakan font modern bersih seperti *Inter* atau *Outfit* dengan skala ukuran proporsional (Display, Heading, Subheading, Body, Monospace untuk angka saldo/rekening).
- **Mikro-Interaksi**: Transisi halus pada hover kartu, animasi transisi angka saldo (*count-up/smooth update*), dan status loading skeleton yang tenang (*shimmer effect*).

---

## 2. Struktur Modul & Pemisahan Tanggung Jawab `[DECIDED]`
Direktori `apps/web/src` diorganisasi secara modular berbasis fitur (*feature-driven architecture*):
```text
src/
├── app/              # Setup root provider (QueryClient, AuthProvider, ThemeProvider)
├── routes/           # Router tree (AppRouter, PrivateRoute, AdminRoute, PublicRoute)
├── layouts/          # Layout template (AuthLayout, DashboardLayout, AdminLayout)
├── features/         # Modul fitur bisnis mandiri
│   ├── auth/         # Login, Register, ForgotPassword
│   ├── dashboard/    # Ringkasan analitik, chart arus kas, statistik
│   ├── wallet/       # Tampilan dompet, mutasi ledger, simulasi top-up
│   ├── transactions/ # Daftar transaksi, form tambah/edit, detail kuitansi
│   ├── transfers/    # Form kirim transfer saldo internal, kontak tujuan
│   ├── budgets/      # Pengaturan anggaran per kategori, progress bar
│   ├── categories/   # Kelola kategori kustom & daftar ikon
│   └── admin/        # Metrik sistem, manajemen status akun, audit log
├── components/       # Komponen UI atomik & reusable (Button, Input, Modal, Table, Badge, Card)
├── hooks/            # Custom hooks umum (useDebounce, useMediaQuery, useLocalStorage)
├── services/         # Konfigurasi Axios API client & interceptor
├── lib/              # Helper utility lokal (formatters: formatCurrency, formatDate)
├── types/            # Tipe TypeScript khusus view model
└── styles/           # Tailwind CSS directives, font definitions, animasi custom
```

### Aturan Pemisahan Kode:
1. **Pages / Routes**: Hanya mengorkestrasi komponen fitur dan layout. Dilarang memuat logika komputasi bisnis panjang di level Page.
2. **Components**: Komponen presentasional murni menerima data via `props` dan menembakkan event via callback.
3. **Hooks & Services**: Seluruh komunikasi network dan mutasi state server dibungkus dalam custom TanStack Query hooks (misal `useTransactionsQuery`, `useTransferMutation`).

---

## 3. Navigasi & Client-Side Route Protection `[DECIDED]`
- **Public Routes**: `/login`, `/register`. Jika pengguna sudah memiliki sesi login aktif, otomatis dialihkan (*redirect*) ke `/dashboard`.
- **Protected User Routes**: `/dashboard`, `/transactions`, `/transfers`, `/budgets`, `/categories`, `/wallet`, `/settings`. Pengguna tanpa autentikasi dialihkan ke `/login` dengan menyimpan rute asal (*intended location*).
- **Protected Admin Routes**: `/admin`, `/admin/users`, `/admin/activity-logs`. Hanya pengguna dengan `role === 'admin'` yang dapat mengakses; peran `user` dialihkan ke `/dashboard` atau halaman 403 Forbidden.

---

## 4. Komunikasi Data Server (TanStack Query + Axios) `[DECIDED]`
- **Axios Interceptor**:
  - Menyisipkan header `Authorization: Bearer <accessToken>` pada setiap request terproteksi.
  - Menangkap response `401 Unauthorized`: secara transparan memanggil endpoint `/api/v1/auth/refresh` untuk memperbarui access token di memori, lalu mencoba ulang request awal yang gagal (*automatic token retry queue*).
- **Manajemen Cache TanStack Query**:
  - Setelah mutasi transaksi (`POST /transactions`) atau transfer (`POST /transfers`), query key terkait (`['wallet']`, `['transactions']`, `['budgets']`, `['dashboard-summary']`) langsung di-invalidasi (`queryClient.invalidateQueries(...)`) agar data selalu terbarui tanpa *hard reload* halaman.
- **Larangan Halaman Data Statis**: Data tidak boleh di-hardcode. Jika API backend belum mengembalikan data atau server mati, UI menampilkan Error State yang informatif, bukan fallback ke data dummy palsu.

---

## 5. Form Handling & Validasi (React Hook Form + Zod) `[DECIDED]`
- Seluruh form (registrasi, transaksi pemasukan/pengeluaran, transfer saldo) menggunakan **React Hook Form** yang terhubung dengan **Zod resolver**.
- Skema validasi Zod diimpor langsung dari `packages/shared` untuk menjamin konsistensi 100% dengan validasi backend.
- Feedback visual instan:
  - Validasi pesan error inline ditampilkan di bawah input field terkait.
  - Tombol aksi utama (misal "Kirim Saldo") menampilkan status disabled + spinner loading saat request sedang diproses guna mencegah klik ganda.

---

## 6. Standar Penanganan Status Tampilan (UI States) `[DECIDED]`
Setiap view yang memuat data asinkron WAJIB menangani 4 status:
1. **Loading State**: Menampilkan Skeleton Loader dengan dimensi proporsional terhadap konten akhir, bukan spinner layar penuh yang mengganggu konteks.
2. **Empty State**: Menampilkan ilustrasi/ikon menarik, pesan yang menjelaskan ketiadaan data, dan tombol aksi persuasif (misal: "Belum ada transaksi. Tambah transaksi pertama Anda!").
3. **Error State**: Menampilkan pesan kesalahan ramah pengguna dan tombol "Coba Lagi" (*Retry action*).
4. **Success State**: Notifikasi Toast non-intrusif (posisi kanan atas atau bawah tengah) dengan durasi tampil 3-5 detik.

---

## 7. Responsivitas & Aksesibilitas (A11y) `[DECIDED]`
- **Desain Mobile-First**:
  - Viewport kecil (<640px): Sidebar berpindah menjadi Bottom Navigation Bar atau Sheet Drawer; tabel bertransformasi menjadi susunan kartu vertikal (*card list*).
  - Tablet (640px - 1024px): Layout grid 2 kolom.
  - Desktop (>1024px): Layout multi-kolom penuh dengan visualisasi dashboard komprehensif.
- **Aksesibilitas**:
  - Seluruh tombol dan link interaktif wajib memiliki atribut label yang jelas (`aria-label`).
  - Form input wajib memiliki elemen `<label>` yang terhubung dengan `id` input.
  - Rasio kontras teks terhadap latar belakang mematuhi standar WCAG AA (minimal 4.5:1 untuk teks normal).
