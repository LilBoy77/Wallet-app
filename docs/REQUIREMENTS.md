# REQUIREMENTS — Spesifikasi Kebutuhan Sistem Wallet App

Dokumen ini mendefinisikan seluruh kebutuhan fungsional dan non-fungsional proyek Wallet App.  
**Aturan Status**: Seluruh requirement pada Phase 0 berstatus `PLANNED`. Status hanya boleh diubah menjadi `IN_PROGRESS`, `IMPLEMENTED`, atau `VERIFIED` setelah ada bukti implementasi dan pengujian nyata di fase berikutnya.

---

## 1. Frontend & Antarmuka Pengguna
| ID | Deskripsi Kebutuhan | Prioritas | Komponen | Kriteria Penerimaan | Metode Verifikasi | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-FE-01** | Desain UI modern, profesional bertema fintech dengan palet warna terkurasi, kontras tinggi, typography modern, dan micro-interaction responsif | High | Frontend | Tampilan konsisten, komponen UI modular, tanpa elemen HTML mentah default atau warna polos generik | Review visual browser & audit CSS tokens | `PLANNED` |
| **REQ-FE-02** | Layout responsif multi-device (Mobile <640px, Tablet 640-1024px, Desktop >1024px) dengan navigasi sidebar dan mobile bottom/drawer | High | Frontend | Seluruh halaman dapat diakses tanpa layout broken atau horizontal scroll liar pada viewport 375px hingga 1440px | Browser testing multi-viewport | `PLANNED` |
| **REQ-FE-03** | State handling konsisten untuk seluruh view data (Loading Skeleton, Empty State, Error State, Success Toast) | High | Frontend | Setiap interaksi asinkron menampilkan skeleton loading, pesan informatif saat data kosong, dan toast notifikasi | Manual & integration component test | `PLANNED` |

## 2. Autentikasi Frontend & Backend
| ID | Deskripsi Kebutuhan | Prioritas | Komponen | Kriteria Penerimaan | Metode Verifikasi | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-AUTH-01** | Registrasi akun baru dengan validasi username unik, email unik, nama lengkap, dan password kuat (min. 8 karakter, kombinasi huruf & angka) | High | Full-stack | Data tersimpan aman, password di-hash dengan Argon2id, audit log dicatat | `tests/auth/register.test.ts` (5 tests) & Zod validation | `VERIFIED` (Backend) |
| **REQ-AUTH-02** | Login pengguna berbasis kredensial menghasilkan access token singkat dan refresh token rotatif yang disimpan dalam HttpOnly cookie | High | Full-stack | Access token (15m) mengakses private route; refresh token atomik dengan rotasi row-lock dan deteksi reuse | `tests/auth/login.test.ts` & `tests/auth/refresh-rotation-concurrency.test.ts` | `VERIFIED` (Backend) |
| **REQ-AUTH-03** | Mekanisme Logout aman yang mencabut refresh token di database dan membersihkan sesi di klien | High | Full-stack | Token yang dicabut tidak dapat digunakan lagi untuk refresh; pembatalan seluruh sesi (`logout-all`) | `tests/auth/logout.test.ts` (2 tests) | `VERIFIED` (Backend) |

## 3. Routing & Role-Based Access Control (RBAC)
| ID | Deskripsi Kebutuhan | Prioritas | Komponen | Kriteria Penerimaan | Metode Verifikasi | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-ROUTE-01** | Proteksi route sisi klien (Public, Protected User, Protected Admin) dengan redirection otomatis | High | Frontend | Pengguna tanpa login diarahkan ke `/login`; pengguna non-admin mencoba akses `/admin` diarahkan ke `/dashboard` atau 403 page | React Router route guard test | `PLANNED` |
| **REQ-ROUTE-02** | Otorisasi ketat berbasis peran di sisi backend (middleware `authenticate`, `requireRole`, `assertOwnerOrAdmin`, `routePolicyGuard`) | High | Backend | Request API tanpa hak akses mengembalikan response standar HTTP 401 Unauthorized atau 403 Forbidden; status user diverifikasi real-time di DB | `tests/auth/rbac-and-policy.test.ts` (4 tests) | `VERIFIED` (Backend) |

## 4. Dashboard & Statistik
| ID | Deskripsi Kebutuhan | Prioritas | Komponen | Kriteria Penerimaan | Metode Verifikasi | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-DASH-01** | Dashboard Pengguna: Ringkasan saldo dompet, total pemasukan bulan berjalan, total pengeluaran bulan berjalan, dan sisa anggaran | High | Frontend | Data angka teragregasi secara akurat dari backend; format mata uang IDR rapi | UI component test & API verification | `PLANNED` |
| **REQ-DASH-02** | Visualisasi data interaktif: grafik arus kas (Recharts Area/Bar Chart) dan distribusi pengeluaran per kategori (Recharts Pie/Donut Chart) | Medium | Frontend | Grafik responsif, tooltip interaktif menampilkan angka detail dan persentase | Visual review & rendering test | `PLANNED` |
| **REQ-DASH-03** | Dashboard Admin: Metrik agregat seluruh sistem (total pengguna, total volume transaksi sistem, log aktivitas terbaru) | Medium | Full-stack | Hanya dapat diakses role admin; menyajikan data metrik sistem terkini | Admin access test & data check | `PLANNED` |

## 5. Entitas CRUD (Minimal $\ge 6$ Entitas Terpenuhi)
| ID | Entitas | Operasi CRUD | Komponen | Kriteria Penerimaan | Metode Verifikasi | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-CRUD-01** | **Users / Profile** | Read Profile, Update Profile, Change Password, Admin Manage User Status | Full-stack | Pengguna dapat mengupdate data pribadi; Admin dapat mengaktifkan/menonaktifkan akun | API test & form test | `PLANNED` |
| **REQ-CRUD-02** | **Wallets** | Read Wallet Details, Update Wallet Name/Preferences, Top-Up Simulation | Full-stack | Setiap user memiliki wallet default; saldo diperbarui melalui entri transaksi legal | DB constraint & API test | `PLANNED` |
| **REQ-CRUD-03** | **Transactions (Income & Expense)** | Create, Read, Update (sebelum di-freeze), Soft Delete, List with Filters | Full-stack | Transaksi pemasukan/pengeluaran memengaruhi saldo dompet secara tepat dan tercatat di ledger | Unit & ledger consistency test | `PLANNED` |
| **REQ-CRUD-04** | **Transfers (Internal)** | Create (Send), Read Transfer History, Read Transfer Detail | Full-stack | Transfer antar-user mengurangi saldo pengirim dan menambah saldo penerima secara atomik | Concurrency & isolation test | `PLANNED` |
| **REQ-CRUD-05** | **Categories** | Create, Read, Update, Soft Delete, Filter by Type (Income/Expense) | Full-stack | Kategori bawaan sistem tidak dapat dihapus user biasa; user dapat menambah kategori kustom | CRUD API test | `PLANNED` |
| **REQ-CRUD-06** | **Budgets (Anggaran)** | Create, Read, Update, Delete per Periode & Kategori | Full-stack | Menghitung realisasi belanja terhadap pagu anggaran dan menampilkan persentase ketercapaian | Calculation logic test | `PLANNED` |
| **REQ-CRUD-07** | **Attachments (Bukti Transaksi)** | Create (Upload), Read (Download/Preview), Delete | Full-stack | File terkait dengan entitas transaksi tertentu; dihapus saat transaksi dihapus atau terpisah | Upload validation & storage test | `PLANNED` |

## 6. Pencarian, Filter, Pengurutan & Pagination
| ID | Deskripsi Kebutuhan | Prioritas | Komponen | Kriteria Penerimaan | Metode Verifikasi | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-SFSP-01** | Pagination server-side terstandarisasi (`page`, `limit`, `total_items`, `total_pages`) pada daftar transaksi, log, dan transfer | High | Full-stack | Menampilkan data per halaman secara akurat tanpa *over-fetching* | API test & UI pagination test | `PLANNED` |
| **REQ-SFSP-02** | Filter multi-kriteria: rentang tanggal (*date range*), jenis transaksi (*income*, *expense*, *transfer*), kategori, dan rentang nominal | High | Full-stack | Query database teroptimasi dengan index yang sesuai; hasil filter akurat | Backend query test | `PLANNED` |
| **REQ-SFSP-03** | Pencarian teks (Search) berbasis deskripsi/catatan transaksi dan nama penerima transfer | Medium | Full-stack | Menggunakan search case-insensitive / ILIKE dengan debouncing pada frontend (300ms) | UI & API performance test | `PLANNED` |
| **REQ-SFSP-04** | Pengurutan fleksibel (Sorting) berdasarkan tanggal, nominal, dan tanggal pembuatan (ASC/DESC) | Medium | Full-stack | Parameter query divalidasi dengan whitelist kolom yang diizinkan untuk mencegah injection | Security & API test | `PLANNED` |

## 7. Upload File & Validasi Form
| ID | Deskripsi Kebutuhan | Prioritas | Komponen | Kriteria Penerimaan | Metode Verifikasi | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-UPLD-01** | Unggah bukti transaksi kuitansi/struk dengan validasi format MIME (image/jpeg, image/png, application/pdf) dan batas ukuran $\le 2\text{MB}$ | High | Full-stack | File divalidasi ganda (klien via Zod & server via Multer/magic bytes), nama file diacak (UUID) untuk mencegah path traversal | File upload integration test | `PLANNED` |
| **REQ-UPLD-02** | Validasi form frontend komprehensif menggunakan React Hook Form + skema Zod terbagi (*shared schema*) | High | Frontend | Menampilkan pesan error inline yang jelas di bawah input; tombol submit disable saat status invalid/submitting | Frontend form interaction test | `PLANNED` |

## 8. Notifikasi & Penanganan Error
| ID | Deskripsi Kebutuhan | Prioritas | Komponen | Kriteria Penerimaan | Metode Verifikasi | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-NOTIF-01** | Sistem notifikasi internal berbasis database (tabel `notifications`) untuk pemberitahuan transfer masuk dan peringatan anggaran mendekati limit | Medium | Full-stack | Notifikasi ditandai belum dibaca / sudah dibaca; dropdown notifikasi di header | API test & UI dropdown test | `PLANNED` |
| **REQ-NOTIF-02** | Penanganan error global terstandarisasi di frontend (Error Boundary, Network Interceptor) dan backend (Global Error Handler middleware) | High | Full-stack | Format payload error JSON konsisten (`success: false`, `code`, `message`, `details`, `requestId`) tanpa kebocoran stack trace di mode non-development | Error scenario API test & unit tests | `VERIFIED` (Backend) |

## 9. Desain REST API & Backend
| ID | Deskripsi Kebutuhan | Prioritas | Komponen | Kriteria Penerimaan | Metode Verifikasi | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-API-01** | Standar RESTful seragam dengan status code HTTP tepat (200, 201, 204, 400, 401, 403, 404, 409, 422, 500) | High | Backend | Seluruh endpoint mengikuti kontrak baku di [API_CONTRACT.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/API_CONTRACT.md) | Contract & integration test | `PLANNED` |
| **REQ-BE-01** | Arsitektur backend berlapis (*Layered Architecture*): Route $\rightarrow$ Controller $\rightarrow$ Service $\rightarrow$ Repository/Model $\rightarrow$ Database | High | Backend | Pemisahan logika bisnis murni di lapisan Service; Controller hanya menangani parsing request dan response | Code architecture review | `PLANNED` |
| **REQ-BE-02** | Atomisitas transaksi finansial: Mutasi saldo dompet dan transfer wajib dibungkus dalam PostgreSQL Database Transaction (`BEGIN ... COMMIT / ROLLBACK`) dengan isolasi dan locking ketat | Critical | Backend | Tidak terjadi inkonsistensi saldo atau *race condition* saat dua request simultan dieksekusi | Concurrency stress test & withTransaction test | `IMPLEMENTED` (Foundation) |
| **REQ-BE-03** | Idempotency protection pada endpoint transfer internal (`Idempotency-Key` header) | High | Backend | Pengiriman ulang request dengan key yang sama dalam jendela waktu tertentu tidak mengeksekusi transfer ganda | Repeated request test | `PLANNED` |

## 10. Database Relasional (Minimal $\ge 6$ Tabel Utama)
| ID | Nama Tabel | Peran Utama | Relasi | Soft Delete? | Kriteria Integritas | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-DB-01** | `users` | Entitas akun pengguna dan admin | 1:1 ke `wallets`, 1:N ke `categories`, `budgets`, `activity_logs` | Ya (`deleted_at`) | Email & username unik, role enum ('user', 'admin') | `VERIFIED` |
| **REQ-DB-02** | `wallets` | Dompet saldo internal per pengguna | 1:1 ke `users`, 1:N ke `wallet_entries` | Tidak (permanen audit) | Balance integer non-negatif (`balance >= 0`) | `VERIFIED` |
| **REQ-DB-03** | `transactions` | Catatan transaksi pemasukan & pengeluaran | N:1 ke `wallets`, N:1 ke `categories`, 1:N ke `attachments`, N:N ke `tags` via `transaction_tags` | Ya (`deleted_at`) | Amount $> 0$, type enum ('income', 'expense') | `VERIFIED` |
| **REQ-DB-04** | `wallet_entries` | Buku besar (*ledger*) mutasi saldo masuk/keluar | N:1 ke `wallets`, N:1 opsional ke `transactions` & `transfers` | Tidak (immutable ledger) | Entry type ('credit', 'debit'), balance_after | `VERIFIED` |
| **REQ-DB-05** | `transfers` | Rekaman transfer internal antar-dua wallet | N:1 ke `wallets` (source), N:1 ke `wallets` (target) | Tidak (audit log transfer) | Source $\ne$ Target, amount $> 0$, status enum | `VERIFIED` |
| **REQ-DB-06** | `categories` | Klasifikasi transaksi (makanan, gaji, dll.) | N:1 ke `users` (null jika sistem default), 1:N ke `transactions`, `budgets` | Ya (`deleted_at`) | Unik per nama + user_id | `VERIFIED` |
| **REQ-DB-07** | `budgets` | Pagu anggaran per kategori & periode | N:1 ke `users`, N:1 ke `categories` | Tidak | Limit amount $> 0$, periode valid | `VERIFIED` |
| **REQ-DB-08** | `attachments` | File bukti kuitansi/struk transaksi | N:1 ke `transactions` | Tidak | File path & MIME valid | `VERIFIED` |
| **REQ-DB-09** | `tags` & `transaction_tags` | Label kustom transaksi (Relasi N:N) | N:N antara `transactions` dan `tags` melalui tabel pivot `transaction_tags` | Tidak | Composite PK (`transaction_id`, `tag_id`) | `VERIFIED` |
| **REQ-DB-10** | `refresh_tokens`, `activity_logs`, `notifications` | Sesi autentikasi, audit trail, dan pemberitahuan sistem | Berelasi N:1 ke `users` | Tidak | Token hash, index pencarian teroptimasi | `VERIFIED` |

## 11. Kardinalitas Relasi (4 Tipe Terpenuhi)
| ID | Tipe Relasi | Pasangan Entitas | Penjelasan Bisnis Nyata | Status |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-REL-01** | **1:1 (One-to-One)** | `users` $\leftrightarrow$ `wallets` | Setiap user terdaftar memiliki tepat 1 dompet saldo utama dalam sistem; satu dompet dimiliki tepat satu user | `VERIFIED` |
| **REQ-REL-02** | **1:N (One-to-Many)** | `categories` $\leftrightarrow$ `transactions` | Satu kategori (mis. Makanan) dapat memayungi banyak transaksi pengeluaran; tiap transaksi mengacu ke satu kategori | `VERIFIED` |
| **REQ-REL-03** | **N:1 (Many-to-One)** | `wallet_entries` $\leftrightarrow$ `wallets` | Banyak entri mutasi saldo mengacu pada satu akun dompet pemilik mutasi | `VERIFIED` |
| **REQ-REL-04** | **N:N (Many-to-Many)** | `transactions` $\leftrightarrow$ `tags` (via `transaction_tags`) | Satu transaksi dapat diberi banyak tag (misal: `#liburan`, `#makan_siang`), dan satu tag dapat dilekatkan pada banyak transaksi | `VERIFIED` |

## 12. Soft Delete & Seeder
| ID | Kategori | Target Tabel | Kriteria Penerimaan | Metode Verifikasi | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-SD-01** | Soft Delete | `users`, `categories`, `transactions` ($\ge 3$ tabel) | Kolom `deleted_at` terisi timestamp saat dihapus; query default mengabaikan data ber-`deleted_at IS NOT NULL` | `VERIFIED` |
| **REQ-SEED-01** | Database Seeder | Seluruh tabel utama (`users`, `wallets`, `categories`, `budgets`, `transactions`, `wallet_entries`, `transfers`, `tags`) | Minimal $\ge 20$ data seed realistis per tabel utama, mencakup relasi yang valid, 1 akun admin default, 5 akun user, dan histori transaksi bervariasi | `VERIFIED` |

## 13. Dokumentasi API, Keamanan & Pengujian
| ID | Deskripsi Kebutuhan | Prioritas | Komponen | Kriteria Penerimaan | Metode Verifikasi | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-DOCS-01** | Dokumentasi interaktif Swagger/OpenAPI v3 yang dapat diakses di endpoint `/api/docs` dan Postman Collection lengkap | High | Docs / BE | Seluruh endpoint terdaftar dengan skema request, response, dan contoh payload | Review Swagger UI & import Postman | `PLANNED` |
| **REQ-SEC-01** | Hardening keamanan: Sanitasi input (XSS prevention), parameterized query / ORM (SQL Injection prevention), CORS whitelist ketat, Helmet security headers, Rate Limiting pada auth & transfer | Critical | Backend | Tidak ada kerentanan injeksi atau bypass token; rate limiter aktif pada 100 req/15 menit | Security test script & static scan | `IMPLEMENTED` (Foundation) |
| **REQ-TEST-01** | Pengujian komprehensif: Unit test logika bisnis, integration test endpoint REST API, concurrency test transfer internal, dan test skenario batas | High | Testing | Menjamin ketiadaan transfer ganda (*double spend*), saldo negatif, dan kebocoran data antar-user | Eksekusi test runner otomatis | `PLANNED` |
