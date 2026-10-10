# BACKEND_GUIDELINES — Panduan Rekayasa Arsitektur Backend API

Dokumen ini memuat standar rekayasa backend, konvensi penulisan kode, penanganan transaksi database, validasi, dan pola arsitektur berlapis untuk layanan **`apps/api`** (Node.js + Express + TypeScript + PostgreSQL).

---

## 1. Pola Arsitektur Berlapis per Domain (Modular Layered Pattern) `[DECIDED]`
Layanan backend diorganisasikan ke dalam modul domain mandiri di `apps/api/src/modules/`:
```text
modules/
├── auth/
├── users/
├── wallets/
├── transactions/
├── transfers/
├── categories/
├── budgets/
├── attachments/
├── notifications/
└── admin/
```
Setiap modul domain wajib memisahkan tanggung jawab ke dalam 5 lapisan:
1. **`*.routes.ts`**: Mendefinisikan endpoint URL, metode HTTP, dan merangkai middleware (Rate Limiter, `requireAuth`, `requireRole`, `validateBody(schema)`, Controller handler).
2. **`*.controller.ts`**: Menangani konteks HTTP: membaca `req.params`, `req.query`, `req.body`, memanggil Service terkait, dan membungkus hasil ke dalam Response Envelope (`res.status(200).json(...)`).
3. **`*.service.ts`**: Memuat seluruh logika bisnis murni. Mengelola validasi aturan bisnis (misal saldo mencukupi), mengorkestrasi beberapa repositori, dan membungkus alur dalam transaksi database. **Service tidak boleh mengakses objek `req` atau `res` secara langsung**.
4. **`*.repository.ts`**: Menjalankan interaksi I/O database (SELECT, INSERT, UPDATE, row locking `FOR UPDATE`, filter soft delete).
5. **`*.schemas.ts`**: Skema Zod untuk validasi request payload, URL parameter, dan query string (dapat mengimpor dari `packages/shared`).

---

## 2. Standar Konvensi Penamaan (Naming Conventions) `[DECIDED]`
- **File & Folder**: Kebab-case (misal `transfer.service.ts`, `wallet-entry.repository.ts`).
- **Kelas**: PascalCase (misal `TransferService`, `TransactionRepository`, `AppError`).
- **Fungsi & Variabel**: camelCase (misal `createInternalTransfer`, `sourceWalletId`).
- **Konstanta & Enum**: UPPER_SNAKE_CASE (misal `TRANSACTION_STATUS_COMPLETED`, `DEFAULT_PAGE_LIMIT`).
- **Tabel & Kolom Database**: snake_case (misal `wallet_entries`, `idempotency_key`, `created_at`).

---

## 3. Penanganan Transaksi Database Atomik (Database Transactions) `[DECIDED]`
Seluruh operasi yang memodifikasi lebih dari satu entitas finansial (seperti transfer saldo internal atau mutasi transaksi yang memengaruhi balance) WAJIB menggunakan transaksi database terkelola:

```typescript
// Contoh Pola Transaksi Finansial Aman
export class TransferService {
  async executeTransfer(params: ExecuteTransferDto, currentUser: AuthenticatedUser) {
    const dbClient = await db.beginTransaction();
    try {
      // 1. Ambil ID terkecil terlebih dahulu untuk mengunci baris (Anti-Deadlock)
      const sortedIds = [params.sourceWalletId, params.targetWalletId].sort();
      await dbClient.query(
        'SELECT id, balance FROM wallets WHERE id IN ($1, $2) FOR UPDATE',
        sortedIds
      );

      // 2. Validasi kecukupan saldo & status wallet
      const source = await this.walletRepo.findById(params.sourceWalletId, dbClient);
      if (source.balance < params.amount) {
        throw new AppError('Saldo tidak mencukupi untuk transfer', 422, 'INSUFFICIENT_FUNDS');
      }

      // 3. Mutasi Saldo
      await this.walletRepo.decrementBalance(params.sourceWalletId, params.amount, dbClient);
      await this.walletRepo.incrementBalance(params.targetWalletId, params.amount, dbClient);

      // 4. Catat Transfer Record & Double-Entry Ledger
      const transfer = await this.transferRepo.create(params, dbClient);
      await this.ledgerRepo.createDebitEntry(source, params.amount, transfer.id, dbClient);
      await this.ledgerRepo.createCreditEntry(target, params.amount, transfer.id, dbClient);

      // 5. Commit Transaksi
      await db.commitTransaction(dbClient);
      return transfer;
    } catch (error) {
      await db.rollbackTransaction(dbClient);
      throw error;
    }
  }
}
```

---

## 4. Middleware Validasi & Penanganan Error Terpusat `[DECIDED]`
1. **Validasi Skema (Zod Middleware)**:
   - Diterapkan sebelum Controller dieksekusi: `validateBody(zodSchema)`, `validateQuery(zodSchema)`.
   - Mengembalikan HTTP 422 Unprocessable Entity dengan rincian field yang bermasalah.
2. **Abstraksi `AppError`**:
   - `class AppError extends Error { constructor(public message: string, public statusCode: number = 400, public errorCode: string = 'BAD_REQUEST', public details: any = null) { ... } }`
3. **Global Error Handler Middleware**:
   - Menangkap seluruh error turunan `AppError` dan exception tak tertangani.
   - Mengembalikan JSON konsisten `{ success: false, error: { code, message, details } }`.
   - Di production, pesan internal dari exception yang tidak bertipe `AppError` disanitasi menjadi `"Internal server error"` dan detail disembunyikan.

---

## 5. Larangan Manipulasi Data Dummy & Fallback Ilegal `[DECIDED]`
- **Otorisasi Nyata di Backend**: Dilarang hanya mengandalkan pengecekan hak akses di frontend. Backend wajib memvalidasi token JWT, kecocokan role, dan kepemilikan resource di setiap request.
- **Dilarang Fallback ke Data Dummy**: Jika database gagal terkoneksi atau query mengembalikan error, service DILARANG mengembalikan array data dummy statis sebagai respon sukses palsu. Sistem WAJIB mengembalikan status error nyata (misal 500 atau 503) agar anomali dapat terdeteksi dan diatasi.

---

## 6. Audit Trail & Pencatatan Aktivitas (Activity Logging) `[DECIDED]`
Setiap aksi penting (registrasi akun, update profil, pergantian sandi, transfer saldo, perubahan status user oleh admin) wajib dicatat secara asinkron ke tabel `activity_logs`:
- Menyimpan: `user_id`, `action` (misal `'TRANSFER_FUNDS'`), `entity` (`'transfers'`), `entity_id`, metadata ringkas (non-sensitif), dan `ip_address`.
