# TESTING_STRATEGY — Strategi Pengujian Komprehensif & Skenario Batas

Dokumen ini mendefinisikan arsitektur pengujian, target cakupan, dan skenario pengujian batas kritis (edge cases) untuk memastikan integritas, keandalan finansial, dan kepatuhan sistem **Wallet App**.

---

## 1. Piramida & Matriks Pengujian `[DECIDED]`

```
       / \
      / E2E \         (Playwright / Cypress) -> Alur End-to-End User & Admin
     /-------\
    /  Integ  \       (Supertest + PostgreSQL Test DB) -> REST API & DB Transactions
   /-----------\
  /    Unit     \     (Vitest / Jest) -> Pure Functions, Zod Schemas, Domain Math
 /---------------\
```

| Tingkat Pengujian | Area Fokus | Alat Pengujian | Kriteria Keberhasilan |
| :--- | :--- | :--- | :--- |
| **Unit Testing** | Logika perhitungan matematis, validasi Zod, helper format uang, parser tanggal | Vitest | 100% lulus, eksekusi <5 detik |
| **Integration Testing** | Endpoint REST API, middleware auth, atomisitas transfer saldo, migrasi & constraint DB | Vitest + Supertest | Seluruh endpoint REST API merespons sesuai [API_CONTRACT.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/API_CONTRACT.md) |
| **Frontend Component Test** | Render form, state handling (Loading/Empty/Error), interaksi form | React Testing Library | Komponen menampilkan feedback error dan memvalidasi input |
| **End-to-End (E2E)** | Skenario lengkap login, pencatatan transaksi, transfer saldo, dan verifikasi saldo dashboard | Playwright | Alur transfer berhasil memotong saldo pengirim dan menambah saldo penerima di UI |

---

## 2. Skenario Pengujian Batas Wajib (Mandatory Edge Scenarios) `[DECIDED]`

### 1. Skenario Pencegahan Transfer Ganda (*Double Spend*)
- **Tujuan**: Memastikan dua permintaan transfer saldo yang dikirim secara konkuren tidak memotong saldo lebih dari sekali atau melebihi saldo aktual.
- **Prosedur Pengujian**:
  1. Siapkan User A dengan saldo Rp 100.000.
  2. Tembakkan dua request transfer konkuren secara paralel ke User B masing-masing sebesar Rp 70.000 (total Rp 140.000).
- **Hasil yang Diharapkan**: Tepat satu request berhasil (201 Created) dan satu request lainnya gagal (422 Unprocessable Entity: Insufficient Balance). Saldo akhir User A harus tepat Rp 30.000, bukan minus atau nol.

### 2. Skenario Penolakan Saldo Negatif
- **Tujuan**: Menguji penegakan constraint database dan layer service terhadap percobaan pembuatan transaksi yang melebihi saldo yang ada.
- **Prosedur Pengujian**:
  1. User A memiliki saldo Rp 50.000.
  2. Mencoba melakukan transaksi pengeluaran sebesar Rp 60.000 atau transfer Rp 60.000.
- **Hasil yang Diharapkan**: Permintaan ditolak dengan status HTTP 422. Jika query SQL mentah dipaksakan, database PostgreSQL menolak dengan pelanggaran constraint `chk_wallet_balance_non_negative`.

### 3. Skenario Akses Data Pengguna Lain (IDOR & Otorisasi)
- **Tujuan**: Memastikan User A tidak dapat melihat, mengubah, atau menghapus transaksi milik User B.
- **Prosedur Pengujian**:
  1. Login sebagai User A dan peroleh access token.
  2. Kirim request `GET /api/v1/transactions/:id_milik_user_B` atau `DELETE /api/v1/transactions/:id_milik_user_B`.
- **Hasil yang Diharapkan**: Server merespons dengan HTTP 404 Not Found atau 403 Forbidden. Data transaksi User B tetap utuh tanpa perubahan.

### 4. Skenario Serangan SQL Injection
- **Tujuan**: Memverifikasi bahwa seluruh query input disanitasi dan menggunakan parameterized queries.
- **Prosedur Pengujian**:
  1. Kirim payload pencarian atau login dengan muatan SQL berbahaya: `' OR '1'='1' --`, `admin'--`, `'; DROP TABLE users; --`.
- **Hasil yang Diharapkan**: Query dieksekusi sebagai nilai string literal; tidak ada perubahan skema atau bypass autentikasi (HTTP 401 atau empty search result).

### 5. Skenario Penggunaan Kembali Refresh Token yang Dicabut (Revoked Token Reuse)
- **Tujuan**: Memverifikasi deteksi pencurian token dan pencabutan sesi otomatis.
- **Prosedur Pengujian**:
  1. Pengguna login dan mendapatkan Refresh Token R1.
  2. Pengguna memanggil `/auth/refresh` -> Server memberikan R2 dan mencabut R1.
  3. Penyerang mencoba memanggil `/auth/refresh` menggunakan token R1 yang sudah dicabut.
- **Hasil yang Diharapkan**: Server mendeteksi token reuse, menolak request (HTTP 401 Unauthorized), dan secara otomatis mencabut token R2 untuk melindungi akun pengguna.

### 6. Skenario Kesalahan Pagination & Query Batas
- **Tujuan**: Memastikan endpoint penanganan paginasi tahan terhadap nilai tidak wajar.
- **Prosedur Pengujian**:
  1. Request `?page=-1&limit=0`
  2. Request `?page=999999&limit=1000`
  3. Request `?limit=abc`
- **Hasil yang Diharapkan**: Input tidak valid dinormalisasi ke batas default yang aman atau ditolak dengan HTTP 400/422. Nilai limit dibatasi maksimal 100.

### 7. Skenario Kegagalan Upload Berkas Lampiran
- **Tujuan**: Memverifikasi keamanan upload file terhadap file ilegal atau berukuran berlebih.
- **Prosedur Pengujian**:
  1. Mengunggah file `.exe` atau `.sh` yang diubah ekstensinya menjadi `.jpg`.
  2. Mengunggah file gambar berukuran 5MB (melebihi limit 2MB).
- **Hasil yang Diharapkan**: File berukuran >2MB ditolak dengan HTTP 413 Payload Too Large. File dengan magic bytes non-gambar/PDF ditolak dengan HTTP 415 Unsupported Media Type. Tidak ada file tersimpan di server.

### 8. Skenario Kesesuaian Dokumentasi Swagger vs Response API Riil
- **Tujuan**: Memastikan kontrak API tidak menyimpang (*schema drift*).
- **Prosedur Pengujian**:
  1. Jalankan automated contract test yang membandingkan response JSON aktual dari setiap endpoint terhadap OpenAPI v3 schema.
- **Hasil yang Diharapkan**: 100% struktur response, field wajib, dan tipe data cocok dengan definisi skema di Swagger.

---

## 3. Matriks Pengujian Finansial Komprehensif (Phase 5 Financial Test Matrix) `[VERIFIED]`

Pengujian Phase 5 difokuskan pada kebenaran data finansial, pembuktian konkurensi, dan pencegahan anomali uang:

| Test Suite / File | Skenario Pengujian | Metodologi & Penegakan | Hasil Uji Nyata |
| :--- | :--- | :--- | :--- |
| **`transfers-concurrency.test.ts`** | **Exhaustion Under Contention**: 10 transfer paralel bersaing memperebutkan saldo terbatas. | `Promise.all` serentak; baris dikunci via `ORDER BY id ASC FOR UPDATE`. | Saldo akhir tepat $\ge 0$, tidak pernah negatif; sisa request ditolak 400 `INSUFFICIENT_BALANCE`. Lulus 5 ronde berturut-turut tanpa flakiness. |
| **`transfers-concurrency.test.ts`** | **Bidirectional Deadlock Prevention**: User A $\rightarrow$ User B dan User B $\rightarrow$ User A dieksekusi simultan. | Penguncian deterministik urutan ID terkecil (`ORDER BY id ASC`). | 0 deadlock (`40P01`), 0 timeout, konservasi total saldo terjaga 100%. |
| **`transfers-idempotency.test.ts`** | **Concurrent Replay**: 20 request konkuren dengan `Idempotency-Key` identik. | `Promise.all` serentak; isolasi tabel `idempotency_records` (`UNIQUE(user_id, idempotency_key)`). | Tepat 1 eksekusi mutasi; 19 request menerima cached response; 0 saldo terpotong ganda. |
| **`transfers-idempotency.test.ts`** | **Payload Mismatch Conflict**: Key sama digunakan dengan nominal/target berbeda. | Canonical JSON stringify + SHA-256 hash comparison. | Ditolak seketika dengan HTTP 409 `IDEMPOTENCY_CONFLICT`. |
| **`failure-injection-rollback.test.ts`** | **Mid-Transfer Crash**: Kegagalan disuntikkan di antara pemotongan source dan penambahan target. | Fault injection seam pada service layer; `withTransaction` rollback test. | Transaksi di-ROLLBACK utuh; saldo kedua pihak tidak berubah; 0 entri ledger yatim (*orphan*). |
| **`failure-injection-rollback.test.ts`** | **Atomic User Registration (D1)**: Kegagalan pembuatan dompet default saat register. | Rollback transaksi `users` + `wallets`. | Akun user di-rollback; tidak ada user tanpa dompet. |
| **`structural-ledger-guard.test.ts`** | **Structural Mutation Isolation**: Memastikan tidak ada file selain `WalletsRepository` yang memutasi kolom `balance`. | Static AST / code scanning regex inspection. | Terbukti hanya 1 file repositori yang memiliki query `UPDATE wallets SET balance`. |
| **`structural-ledger-guard.test.ts`** | **Append-Only Trigger Proof**: Percobaan `UPDATE` atau `DELETE` pada tabel `wallet_entries`. | Database trigger `prevent_wallet_entries_mutation()`. | Database melempar exception; modifikasi dilarang keras. |
| **`structural-ledger-guard.test.ts`** | **Global Balance Conservation**: $\sum \text{wallets.balance} = \sum \text{ledger credits} - \sum \text{ledger debits}$. | Dynamic reconciliation aggregate query. | 100% konsisten tanpa selisih 1 Rupiah pun. |

---

## 4. Matriks Pengujian Komprehensif Phase 6 (Categories, Budgets, Attachments, Activity Logs) `[VERIFIED]`

Pengujian Phase 6 difokuskan pada integritas kategori, realisasi anggaran bebas floating-point, validasi magic bytes unggahan, ketahanan konkurensi kuota lampiran, keabadian audit trail, dan siklus migrasi:

| Test Suite / File | Jumlah Tes | Skenario Pengujian Kunci | Metodologi & Penegakan | Hasil Uji Nyata |
| :--- | :--- | :--- | :--- | :--- |
| **`tests/finance/categories.test.ts`** | 12 tests | CRUD kategori, proteksi kategori sistem (anti-edit/delete), isolasi data pengguna (IDOR), validasi tipe (`income`/`expense`), reaktivasi soft-delete, dan pencatatan `CATEGORY_CREATED`, `CATEGORY_UPDATED`, `CATEGORY_DELETED`. | Supertest API test dengan assertion response envelope dan status database. | 12/12 lulus. Kategori sistem kebal modifikasi (`403 FORBIDDEN`). |
| **`tests/finance/budgets.test.ts`** | 12 tests | Pembuatan anggaran, penolakan overlap (`409 CONFLICT` & GiST exclusion konkuren), kalkulasi realisasi BigInt basis points (`percentage_bps`), zona waktu terkonfigurasi `BUDGET_TIMEZONE` (`AT TIME ZONE`), interval setengah terbuka `[start_date, end_date + 1 hari)` (uji tepi `23:59:59.9995` terhitung & `00:00:00` hari berikutnya dikecualikan), soft-delete, dan aksi `BUDGET_CREATED`, `BUDGET_UPDATED`, `BUDGET_DELETED`. | Supertest API test + kalkulasi exact basis points & uji tepi sub-milidetik lintas zona waktu. | 12/12 lulus. Realisasi sub-milidetik akurat tanpa offset `+07` hardcoded. |
| **`tests/attachments/attachments.test.ts`** | 10 tests | Validasi magic bytes nyata (JPEG, PNG, WebP, PDF), penolakan ekstensi palsu (`415 UNSUPPORTED_MEDIA_TYPE`), batas ukuran 2MB (`413 PAYLOAD_TOO_LARGE` maupun cabang abort socket `ECONNRESET`/`EPIPE` tetap memverifikasi 0 baris DB baru & 0 berkas baru di `UPLOAD_DIR`), isolasi IDOR, rollback berkas fisik, headers streaming (`nosniff`, `attachment`, `no-store`), serta aksi `ATTACHMENT_UPLOADED`, `ATTACHMENT_DELETED`. | Multipart upload Supertest dengan verifikasi biner, hitung baris DB, dan inspeksi direktori disk. | 10/10 lulus. Ekstensi palsu & file >2MB ditolak bersih tanpa baris atau berkas yatim. |
| **`tests/attachments/attachments-race.test.ts`** | 1 test (5 rounds) | **Contention Under Quota**: 10 upload paralel simultan ke `POST /api/v1/attachments` bersaing mengunggah lampiran ke transaksi yang sama dengan batas kuota maksimal 5 lampiran (rasio oversubscription 2x). | `Promise.all` serentak dengan `SELECT t.id, t.status, t.wallet_id, w.user_id FROM transactions t JOIN wallets w ... FOR UPDATE`. | Tepat 5 upload berhasil (`201 Created`) dan 5 upload ditolak (`400 LIMIT_EXCEEDED`). Lulus 5 ronde berturut-turut tanpa flakiness. |
| **`tests/activity-logs/activity-logs.test.ts`** | 10 tests | Paginasi log audit pribadi (`/activity-logs`, `/activity-logs/my`), inspeksi admin (`/admin/activity-logs`), sanitasi metadata, trigger immutabilitas `trg_activity_logs_immutable`, atomisitas rollback transaksi (tanpa log yatim), whitelist `sort_by`, pembuktian emisi nyata seluruh **25 aksi** katalog `ACTIVITY_ACTIONS` (`USER_REGISTERED`, `USER_LOGIN`, `USER_LOGIN_FAILED`, `TOKEN_REFRESHED`, `TOKEN_REUSE_DETECTED`, `USER_LOGOUT`, `USER_LOGOUT_ALL`, `PASSWORD_CHANGED`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED`, `TOPUP_SIMULATION`, `WALLET_UPDATE`, `TRANSFER_SENT`, `TRANSFER_RECEIVED`, `TRANSACTION_CREATED`, `TRANSACTION_METADATA_UPDATED`, `TRANSACTION_VOIDED`, `CATEGORY_CREATED`, `CATEGORY_UPDATED`, `CATEGORY_DELETED`, `BUDGET_CREATED`, `BUDGET_UPDATED`, `BUDGET_DELETED`, `ATTACHMENT_UPLOADED`, `ATTACHMENT_DELETED`), serta pemindai kode struktural anti string-literal di luar katalog. | Supertest API test + direct PostgreSQL trigger exception test + real 25-action emission proof + static AST/code guard + `@ts-expect-error` union check. | 10/10 lulus. `UPDATE`/`DELETE` ditolak PostgreSQL; 25/25 `ACTIVITY_ACTIONS` dipancarkan nyata & 0 string literal liar. |
| **`tests/auth/login-audit-privacy.test.ts`** | 3 tests | Privasi gagal login & perlindungan tabel append-only: email tidak terdaftar tidak menulis baris ke `activity_logs` (hanya ke Pino logger dengan hash SHA-256 email ternormalisasi + IP tanpa email mentah); kata sandi salah mencatat `USER_LOGIN_FAILED` (`INVALID_CREDENTIALS`) tanpa email mentah; akun nonaktif (`is_active = false`) maupun soft-deleted (`deleted_at IS NOT NULL`) mencatat `USER_LOGIN_FAILED` (`ACCOUNT_INACTIVE`) tanpa email mentah. | Supertest API test + spy `logger.warn` + inspeksi langsung kolom `metadata` JSONB `activity_logs`. | 3/3 lulus. 0 email mentah di log maupun database; 0 baris DB dari email tak terdaftar. |
| **`tests/finance/money-format-contract.test.ts`** | 3 tests | Kontrak tunggal format uang JSON safe integer `number` lewat `toSafeMoneyNumber`: memeriksa seluruh endpoint uang utama (`wallets`, `topup`, `entries`, `transactions`, `transfers` + cache `idempotency_records`, `budgets`, `admin/activity-logs` kunci `snake_case` `amount`/`new_balance`/`limit_amount`), uji fail-fast HTTP `500` saat `BIGINT > 2^53 - 1`, serta kepatuhan `runSeeder`. | Supertest contract test lintas endpoint + injeksi nilai `9007199254740992` + eksekusi penuh `runSeeder`. | 3/3 lulus. Seluruh field uang berupa integer `number` aman & overflow gagal cepat. |
| **`tests/database/phase6-migration.test.ts`** | 2 tests | Siklus hidup migrasi 012 (Up $\rightarrow$ Down $\rightarrow$ Up) reversibel, serta jaminan `truncateAllTables` memeriksa `assertTestDatabaseIsolation` terlebih dahulu dan me-re-enable trigger `trg_activity_logs_immutable` di dalam blok `finally` bahkan ketika terjadi error di tengah pembersihan. | Migrator CLI test + katalog `pg_trigger` (`tgenabled = 'O'`) + fault-injection `beforeTruncateHook`. | 2/2 lulus. Migrasi reversibel & trigger terbukti aktif pasca `truncateAllTables`. |
| **`tests/pipeline/rate-limiter-env.test.ts`** | 3 tests | Verifikasi ketat bahwa relaksasi rate limiter (`max: 1000` via `resolveRateLimitMax`) hanya aktif saat `NODE_ENV=test` dan mustahil aktif pada `NODE_ENV=production` maupun `development` di seluruh 10 limiter router. | Unit guard + dynamic module reload (`vi.resetModules`) + Supertest header `ratelimit-limit` & pemblokiran HTTP `429`. | 3/3 lulus. Mode `production` menegakkan limit ketat (`5`, `10`, `30`, `60`) dan memicu `429`. |

### Metrik Eksekusi Test Suite
- **Baseline Phase 5**: 189 tests / 40 test files (di `apps/api`)
- **Pencapaian Phase 6**: **246 tests / 49 test files** di `apps/api` (+ **1 test / 1 file** di `apps/web` = **247 tests / 50 test files** monorepo, 100% Pass)
- **Database Consistency Verification**: `pnpm db:verify` lulus 100% pada seluruh 8 kriteria integritas basis data.

