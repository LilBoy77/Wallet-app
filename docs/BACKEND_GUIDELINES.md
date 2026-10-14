# BACKEND_GUIDELINES — Panduan Rekayasa Arsitektur Backend API

Dokumen ini memuat standar rekayasa backend, konvensi penulisan kode, urutan pipeline middleware, penanganan transaksi database, validasi Zod, dan pola registrasi modul untuk layanan **`apps/api`** (Node.js + Express 4 + TypeScript + PostgreSQL).

---

## 1. Pipeline Middleware Terstandarisasi (Request Pipeline) `[DECIDED]`

Express application (`apps/api/src/app.ts`) menjalankan middleware dalam urutan sekuensial yang disengaja dan terdokumentasi:

1. **Request ID Tracking (`requestIdMiddleware`)**:
   - Membaca header `X-Request-Id` (format UUID v4). Jika valid, dipakai ulang; bila tidak ada atau invalid, dibuat baru menggunakan `crypto.randomUUID()`.
   - Disematkan ke konteks `req.id` dan dikembalikan di response header `X-Request-Id`.
2. **Security Headers & Proxy (`helmet` + `trust proxy`)**:
   - Proteksi header HTTP dasar via Helmet (anti-clickjacking, nosniff, CSP).
   - Pengaturan `trust proxy` dikonfigurasi melalui environment variable `TRUST_PROXY`.
3. **CORS Whitelist (`createCorsMiddleware`)**:
   - Origin eksplisit dari `CORS_ORIGIN`. Wildcard `*` dilarang keras saat `credentials: true`.
   - Permintaan dari origin tak dikenal ditolak dengan status HTTP 403 `ORIGIN_NOT_ALLOWED`.
4. **Global Rate Limiter (`globalRateLimiter`)**:
   - Ambang batas request global per IP (default: 100 request / 15 menit). Melebihi batas mengembalikan HTTP 429 berformat standar dengan header `Retry-After`.
5. **Body Parser (`express.json`, `express.urlencoded`)**:
   - Batas muatan aman dari `BODY_SIZE_LIMIT` (default: 1MB). JSON rusak memicu HTTP 400 `INVALID_JSON`, payload melebihi batas memicu HTTP 413 `PAYLOAD_TOO_LARGE`.
6. **Structured Safe Request Logging (`requestLoggingMiddleware`)**:
   - Pencatatan request berbasis Pino dengan redaksi otomatis pada header autentikasi (`authorization`, `cookie`, `set-cookie`) dan kata kunci sensitif (`password`, `token`, `secret`).
   - Body request **tidak pernah** dicatat ke log demi privasi dan keamanan.
7. **Infrastructure Health Probes (di luar prefix `/api/v1`)**:
   - `GET /health`: Liveness probe (HTTP 200 konstan, tidak menyentuh database).
   - `GET /health/ready`: Readiness probe (memeriksa konektivitas PostgreSQL via `checkDatabaseHealth()`).
8. **Root API Router (`/api/v1`)**:
   - Titik integrasi seluruh router modul domain via registry terpusat.
9. **404 Route Not Found Handler (`notFoundHandler`)**:
   - Menangkap seluruh URL yang tidak terdaftar dan mengembalikan envelope 404 terstandarisasi.
10. **Centralized Global Error Handler (`globalErrorHandler`)**:
    - Titik akhir penerjemahan error sistem, `AppError`, Zod, dan SQLSTATE PostgreSQL.

---

## 2. Pola Arsitektur Berlapis per Domain (Modular Layered Pattern) `[DECIDED]`

Layanan backend diorganisasikan ke dalam modul domain mandiri di `apps/api/src/modules/`:
```text
modules/
├── api.router.ts      <-- Root registry modul /api/v1
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

### Cara Mendaftarkan Modul Baru ke API Router:
Gunakan fungsi `registerApiModule` dari `apps/api/src/modules/api.router.ts`:
```typescript
import { Router } from 'express';
import { registerApiModule } from './api.router.js';

const exampleRouter = Router();
exampleRouter.get('/', (req, res) => res.json({ success: true, data: [] }));

// Daftarkan modul ke prefix /api/v1/example
registerApiModule({
  name: 'example',
  prefix: '/example',
  router: exampleRouter,
  description: 'Contoh registrasi modul domain baru',
});
```

---

## 3. Penanganan Transaksi Database Terkelola (`withTransaction`) `[DECIDED]`

Seluruh operasi mutasi saldo atau multi-entitas finansial WAJIB menggunakan helper `withTransaction`:

```typescript
import { withTransaction } from '../database/index.js';

const transferResult = await withTransaction(
  async (client) => {
    // 1. Kunci baris dompet (Anti-Deadlock: urutkan ID)
    await client.query('SELECT id, balance FROM wallets WHERE id IN ($1, $2) FOR UPDATE', [id1, id2]);

    // 2. Mutasi saldo
    await client.query('UPDATE wallets SET balance = balance - $1 WHERE id = $2', [amount, id1]);
    await client.query('UPDATE wallets SET balance = balance + $1 WHERE id = $2', [amount, id2]);

    return { transferred: true };
  },
  {
    isolationLevel: 'REPEATABLE READ', // Pilihan: 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE'
    maxRetries: 2,                     // Retry otomatis jika terjadi deadlock (40P01) atau serialization failure (40001)
  }
);
```

### Aturan Transaksi:
- **Client Selalu Dilepas**: Client database selalu di-release kembali ke pool pada blok `finally`.
- **Tidak Mendukung Nested Transactions**: Memanggil `withTransaction` di dalam `withTransaction` aktif pada client yang sama akan ditolak secara tegas dengan `AppError` (`NESTED_TRANSACTION_NOT_SUPPORTED`).
- **Tanpa Base Repository CRUD Generik**: Repositori tiap modul ditulis eksplisit untuk mempertahankan kejelasan query SQL dan mekanisme locking.

---

## 4. Model Error & Cara Melempar Exception `[DECIDED]`

### Hirarki Error:
Gunakan kelas error terstandarisasi dari `apps/api/src/shared/errors/index.js`:
- `BadRequestError(message?, details?)` $\rightarrow$ 400 `BAD_REQUEST`
- `UnauthorizedError(message?, details?)` $\rightarrow$ 401 `UNAUTHORIZED`
- `ForbiddenError(message?, details?)` $\rightarrow$ 403 `FORBIDDEN`
- `NotFoundError(message?, details?)` $\rightarrow$ 404 `NOT_FOUND`
- `ConflictError(message?, details?)` $\rightarrow$ 409 `CONFLICT`
- `PayloadTooLargeError(message?, details?)` $\rightarrow$ 413 `PAYLOAD_TOO_LARGE`
- `UnsupportedMediaTypeError(message?, details?)` $\rightarrow$ 415 `UNSUPPORTED_MEDIA_TYPE`
- `ValidationError(message?, details?)` $\rightarrow$ 422 `VALIDATION_ERROR`
- `UnprocessableEntityError(message?, details?)` $\rightarrow$ 422 `UNPROCESSABLE_ENTITY`
- `TooManyRequestsError(message?, retryAfterSeconds?, details?)` $\rightarrow$ 429 `TOO_MANY_REQUESTS`
- `InternalServerError(message?, details?)` $\rightarrow$ 500 `INTERNAL_SERVER_ERROR`

### Pola Pemanggilan Handler Asinkron (Express v4):
Karena Express yang terpasang adalah v4, setiap handler rute asinkron WAJIB dibungkus dengan `asyncHandler`:
```typescript
import { asyncHandler, NotFoundError } from '../shared/errors/index.js';

router.get('/:id', asyncHandler(async (req, res) => {
  const user = await userService.findById(req.params.id);
  if (!user) {
    throw new NotFoundError('Pengguna tidak ditemukan');
  }
  res.json({ success: true, data: user });
}));
```

---

## 5. Validasi Input & Listing Query Helper `[DECIDED]`

### Validasi Skema via Middleware `validate`:
```typescript
import { validate } from '../middlewares/index.js';
import { z } from 'zod';

const transferSchema = z.object({
  target_wallet_number: z.string().min(5),
  amount: z.number().positive('Nominal transfer harus lebih besar dari 0'),
  note: z.string().max(200).optional(),
});

router.post('/transfer', validate({ body: transferSchema }), asyncHandler(controller.transfer));
```

### Parsing Listing Query (Pagination, Sorting Whitelist & Search):
Dilarang menyusun clause `ORDER BY` dari string input mentah klien. Gunakan helper `parseListingQuery`:
```typescript
import { parseListingQuery, createPaginationMeta } from '../shared/utils/index.js';

const ALLOWED_SORT_COLUMNS = ['created_at', 'amount', 'transaction_date'] as const;

router.get('/transactions', asyncHandler(async (req, res) => {
  const queryParams = parseListingQuery(req.query, {
    allowedSortColumns: ALLOWED_SORT_COLUMNS,
    defaultSortColumn: 'transaction_date',
    defaultSortOrder: 'desc',
    allowedFilterKeys: ['type', 'category_id'],
  });

  const { items, totalCount } = await transactionService.list(queryParams);

  res.json({
    success: true,
    data: items,
    meta: createPaginationMeta({
      page: queryParams.page,
      limit: queryParams.limit,
      totalItems: totalCount,
    }),
  });
}));
```

---

## 6. Standar Keamanan & Larangan Manipulasi Dummy `[DECIDED]`
- **Otorisasi Nyata di Sisi Server**: Backend memvalidasi hak akses dan kepemilikan data (IDOR guard) di setiap request.
- **Dilarang Fallback ke Data Dummy**: Kegagalan koneksi database atau query wajib mengembalikan error status nyata (misal 500 atau 503), bukan data tiruan.
