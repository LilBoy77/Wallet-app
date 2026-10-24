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
