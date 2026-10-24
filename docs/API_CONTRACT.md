# API_CONTRACT — Kontrak Spesifikasi RESTful API

Dokumen ini mendefinisikan konvensi API, standar struktur payload, dan katalog endpoint lengkap untuk **Wallet App**.  
> **Status Dokumen**: Seluruh endpoint dalam dokumen ini berstatus **Direncanakan (Planned)** untuk diimplementasikan pada fase backend mendatang. Dokumen ini BUKAN klaim bahwa API telah aktif atau berfungsi saat ini.

---

## 1. Konvensi Standar API & Versioning `[DECIDED]`
- **Base URL**: `/api/v1`
- **Format Payload**: `application/json` (kecuali upload berkas `multipart/form-data`)
- **Header Autentikasi**: `Authorization: Bearer <access_token>`
- **Header Idempotensi**: `Idempotency-Key: <uuid_v4>` (khusus endpoint transfer saldo)
- **Status Codes Terstandarisasi**:
  - `200 OK`: Permintaan berhasil (GET, PUT/PATCH, DELETE dengan payload kembalian).
  - `201 Created`: Sumber daya berhasil dibuat (POST).
  - `204 No Content`: Berhasil tanpa body kembalian (DELETE murni).
  - `400 Bad Request`: Format JSON rusak atau query parameter tidak valid.
  - `401 Unauthorized`: Ketiadaan token autentikasi atau token kedaluwarsa.
  - `403 Forbidden`: Pengguna terautentikasi namun tidak memiliki hak akses role atau kepemilikan resource.
  - `404 Not Found`: Sumber daya tidak ditemukan.
  - `409 Conflict`: Konflik data unik (misal email/username duplikat) atau idempotency key bentrok.
  - `422 Unprocessable Entity`: Validasi payload skema Zod gagal atau saldo tidak mencukupi.
  - `429 Too Many Requests`: Melebihi ambang batas rate limiting.
  - `500 Internal Server Error`: Kesalahan sistem internal tak terduga.

---

## 2. Struktur Payload Terstandarisasi (Envelope Format) `[DECIDED]`

### A. Respons Sukses Tunggal / Non-Paginated
```json
{
  "success": true,
  "data": {
    "id": "8f8b1c4a-3e2a-4c28-98e3-0d3f23a54b81",
    "name": "Personal Wallet",
    "balance": 1500000
  },
  "message": "Data berhasil dimuat"
}
```

### B. Respons Sukses Terpaginasi
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total_items": 42,
    "total_pages": 5
  }
}
```

### C. Respons Gagal / Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input yang diberikan tidak valid",
    "details": [
      {
        "field": "amount",
        "message": "Nominal transfer harus lebih besar dari 0"
      }
    ],
    "requestId": "bf8c4f6f-37e2-484b-8a8c-48a0dbbb6e4d"
  }
}
```

---

## 3. Katalog Kode Error Stabil (Error Code Catalog) `[DECIDED]`
| Kode Error | HTTP Status | Penjelasan & Skenario |
| :--- | :--- | :--- |
| `BAD_REQUEST` | 400 | Parameter query tidak valid, kolom wajib kosong, atau format request salah. |
| `INVALID_JSON` | 400 | Payload body bukan sintaks JSON yang valid. |
| `INVALID_PARAMETER` | 400 | Format identifier, UUID, atau parameter URL tidak sesuai tipe data. |
| `UNAUTHORIZED` | 401 | Ketiadaan access token, token kedaluwarsa, atau kredensial salah. |
| `FORBIDDEN` | 403 | Akses ditolak karena batasan role atau origin CORS tidak diizinkan. |
| `ORIGIN_NOT_ALLOWED` | 403 | Request Origin ditolak oleh whitelist CORS backend. |
| `NOT_FOUND` | 404 | Rute URL tidak ditemukan atau entitas data tidak tersedia. |
| `CONFLICT` | 409 | Tabrakan data unik atau konflik kunci idempotensi. |
| `DUPLICATE_ENTRY` | 409 | Pelanggaran constraint unik basis data (misal email/username kembar). |
| `TRANSACTION_CONCURRENCY_ERROR` | 409 | Kegagalan serialisasi atau deadlock konkuren database (`40001`/`40P01`). |
| `PAYLOAD_TOO_LARGE` | 413 | Ukuran body request atau berkas melebihi batas (default 1MB, upload 2MB). |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Format berkas atau tipe MIME tidak didukung. |
| `VALIDATION_ERROR` | 422 | Kegagalan validasi skema Zod (disertai daftar rincian `field` dan `message`). |
| `UNPROCESSABLE_ENTITY` | 422 | Validasi aturan bisnis gagal (misal saldo tidak mencukupi). |
| `INSUFFICIENT_BALANCE` | 400 | Saldo dompet tidak mencukupi untuk transaksi pengeluaran atau transfer. |
| `WALLET_INACTIVE` | 400 | Dompet sumber atau target berstatus nonaktif. |
| `SAME_WALLET_TRANSFER` | 400 | Pengirim dan penerima transfer merujuk ke dompet yang sama. |
| `TRANSACTION_ALREADY_VOIDED` | 400 | Transaksi sudah pernah dibatalkan (voided) sebelumnya. |
| `IMMUTABLE_FINANCIAL_FIELD` | 400 | Percobaan modifikasi atribut finansial transaksi yang bersifat permanen. |
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | Header `Idempotency-Key` (UUIDv4) wajib disertakan pada request transfer. |
| `IDEMPOTENCY_CONFLICT` | 409 | Idempotency key sudah pernah digunakan dengan request payload berbeda. |
| `TOO_MANY_REQUESTS` | 429 | Ambang batas rate limit terlampaui (disertai header `Retry-After`). |
| `INTERNAL_SERVER_ERROR` | 500 | Kesalahan internal sistem tak terduga (disanitasi di mode production). |
| `NESTED_TRANSACTION_NOT_SUPPORTED` | 500 | Percobaan transaksi database bersarang pada client yang sama ditolak. |
| `SERVICE_UNAVAILABLE` | 503 | Database atau komponen inti sistem sedang tidak dapat dihubungi. |
| `QUERY_TIMEOUT` | 504 | Batas waktu eksekusi query terlampaui (`57014`). |

### Kebijakan Bahasa Error (Error Language Policy) `[DECIDED]`
1. **`error.code`**:
   - Selalu dalam **Bahasa Inggris** menggunakan konvensi `SCREAMING_SNAKE_CASE` (contoh: `VALIDATION_ERROR`, `UNAUTHORIZED`, `DUPLICATE_ENTRY`, `ORIGIN_NOT_ALLOWED`).
   - Bersifat **permanen dan stabil** sebagai kontrak programatik untuk logika kondisional frontend (i18n mapping, routing redirect, handling form error) dan automasi testing.
2. **`error.message`**:
   - Ditulis secara konsisten dalam **satu bahasa (Bahasa Indonesia)** di seluruh modul backend.
   - Berfungsi sebagai teks deskriptif yang ramah pengguna (*human-readable*) jika frontend ingin langsung menampilkannya pada UI banner/toast.
3. **`error.details`**:
   - Struktur data detail validasi atau konteks terstruktur (misal rincian array `{ field, message }` dari Zod).
   - Bersih dari informasi sensitif arsitektur internal server (seperti constraint SQL, nama tabel, query, atau whitelist origin CORS).

---

## 4. Konvensi Query Parameters (Search, Filter, Sort, Pagination) `[DECIDED]`
- **Pagination**: `?page=1&limit=20` (default: page=1, limit=10, max=100)
- **Search**: `?search=makan` (pencarian teks pada deskripsi atau nama penerima)
- **Filter**: `?type=expense&category_id=<uuid>&start_date=2026-01-01&end_date=2026-01-31&min_amount=10000`
- **Sorting**: `?sort_by=transaction_date&order=desc` (whitelist kolom yang diizinkan per modul; input tidak dikenal ditolak untuk mencegah SQL injection)

---

## 5. Katalog Endpoint per Modul

### Modul 0: Infrastruktur & Health Check (Di Luar Prefix `/api/v1`)
| Method | Endpoint | Peran | Parameter / Body | Status Code | Keterangan | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | Public | None | 200 | Liveness probe (memverifikasi server HTTP menyala) | `VERIFIED` |
| `GET` | `/health/ready` | Public | None | 200, 503 | Readiness probe (memeriksa konektivitas pool PostgreSQL) | `VERIFIED` |

### Modul 1: Autentikasi (`/api/v1/auth`)
| Method | Endpoint | Peran | Parameter / Body | Status Code | Tabel Terkait | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Public | Body: `username`, `email`, `password`, `full_name` | 201, 400, 409, 422 | `users`, `activity_logs` | `VERIFIED` |
| `POST` | `/auth/login` | Public | Body: `email`, `password` | 200, 401, 422 | `users`, `refresh_tokens`, `activity_logs` | `VERIFIED` |
| `POST` | `/auth/refresh` | Public | Cookie: `refreshToken`, Header: `X-Requested-With` | 200, 401 | `users`, `refresh_tokens` | `VERIFIED` |
| `POST` | `/auth/logout` | Public | Cookie: `refreshToken`, Header: `X-Requested-With` | 200, 401 | `refresh_tokens` | `VERIFIED` |
| `POST` | `/auth/logout-all` | User, Admin | Header: `Bearer <token>` | 200, 401 | `refresh_tokens` | `VERIFIED` |
| `GET` | `/auth/me` | User, Admin | Header: `Bearer <token>` | 200, 401 | `users` | `VERIFIED` |
| `PUT` | `/auth/change-password` | User, Admin | Header: `Bearer <token>`, Body: `current_password`, `new_password` | 200, 400, 401, 422 | `users`, `refresh_tokens`, `activity_logs` | `VERIFIED` |
| `POST` | `/auth/forgot-password` | Public | Body: `email` | 200, 422 | `users`, `password_resets`, `activity_logs` | `VERIFIED` |
| `POST` | `/auth/reset-password` | Public | Body: `token`, `new_password` | 200, 400, 422 | `users`, `password_resets`, `refresh_tokens`, `activity_logs` | `VERIFIED` |

*Catatan Keamanan Sesi*: Access token JWT mengikat klaim session id (`sid`) ke keluarga refresh token aktif. Token ditolak seketika (HTTP 401 `UNAUTHORIZED`) pasca `logout`, `logout-all`, `change-password`, atau `reset-password`.

### Modul 2: Profil & Pengguna (`/api/v1/users`)
| Method | Endpoint | Peran | Parameter / Body | Status Code | Tabel Terkait | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/users/profile` | User, Admin | Header: `Bearer <token>` | 200, 401 | `users` | `PLANNED` |
| `PUT` | `/users/profile` | User, Admin | Body: `full_name`, `username` | 200, 400, 409, 422 | `users` | `PLANNED` |
| `GET` | `/users/search` | User, Admin | Query: `query` (mencari penerima transfer) | 200, 401 | `users`, `wallets` | `PLANNED` |

### Modul 3: Dompet & Saldo (`/api/v1/wallets`)
| Method | Endpoint | Peran | Parameter / Body | Status Code | Tabel Terkait | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/wallets/my` | User, Admin | Header: `Bearer <token>` | 200, 401 | `wallets` | `VERIFIED` |
| `GET` | `/wallets/my/entries` | User, Admin | Query: `page`, `limit`, `type` | 200, 401 | `wallet_entries` | `VERIFIED` |
| `POST` | `/wallets/my/topup` | User, Admin | Header: `Bearer <token>`<br/>Body: `amount`<br/>*Gated by env flag `ENABLE_TOPUP_SIMULATION` (default off, disallow on production)* | 200, 400, 401, 403, 422, 429 | `wallets`, `wallet_entries`, `activity_logs` | `VERIFIED` |
| `PUT` | `/wallets/my` | User, Admin | Header: `Bearer <token>`<br/>Body: `name` | 200, 400, 401, 422 | `wallets`, `activity_logs` | `VERIFIED` |

### Modul 4: Transaksi (`/api/v1/transactions`)
| Method | Endpoint | Peran | Parameter / Body | Status Code | Tabel Terkait | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/transactions` | User, Admin | Body: `walletId`, `type`, `amount`, `categoryId`, `description`, `transactionDate` | 201, 400, 404, 422 | `transactions`, `wallets`, `wallet_entries` | `VERIFIED` |
| `GET` | `/transactions` | User, Admin | Query: `page`, `limit`, `walletId`, `type`, `status`, `startDate`, `endDate`, `sortBy`, `order` | 200, 401 | `transactions` | `VERIFIED` |
| `GET` | `/transactions/:id` | User, Admin | Param: `id` | 200, 401, 404 | `transactions` | `VERIFIED` |
| `PUT` | `/transactions/:id` | User, Admin | Param: `id`, Body: `categoryId`, `description` | 200, 400, 404, 422 | `transactions` | `VERIFIED` |
| `POST` | `/transactions/:id/void` | User, Admin | Param: `id`, Body: `reason` | 200, 400, 404, 422 | `transactions`, `wallets`, `wallet_entries` | `VERIFIED` |

### Modul 5: Transfer Saldo Internal (`/api/v1/transfers`)
| Method | Endpoint | Peran | Parameter / Body | Status Code | Tabel Terkait | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/transfers` | User, Admin | Header: `Idempotency-Key` (UUIDv4)<br/>Body: `sourceWalletId`, `targetWalletId`, `amount`, `notes` | 201, 400, 404, 409, 422 | `transfers`, `wallets`, `wallet_entries`, `idempotency_records` | `VERIFIED` |
| `GET` | `/transfers` | User, Admin | Query: `page`, `limit`, `direction` ('sent', 'received', 'all') | 200, 401 | `transfers`, `wallets` | `VERIFIED` |
| `GET` | `/transfers/:id` | User, Admin | Param: `id` | 200, 401, 404 | `transfers`, `wallets` | `VERIFIED` |

### Modul 6: Kategori (`/api/v1/categories`)
| Method | Endpoint | Peran | Parameter / Body | Status Code | Tabel Terkait | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/categories` | User, Admin | Query: `type` ('income', 'expense') | 200, 401 | `categories` | `PLANNED` |
| `POST` | `/categories` | User, Admin | Body: `name`, `type`, `icon`, `color` | 201, 400, 409, 422 | `categories` | `PLANNED` |
| `PUT` | `/categories/:id` | User, Admin | Param: `id`, Body: `name`, `icon`, `color` | 200, 400, 404, 422 | `categories` | `PLANNED` |
| `DELETE` | `/categories/:id` | User, Admin | Param: `id` (Soft Delete) | 200, 401, 403, 404 | `categories` | `PLANNED` |

### Modul 7: Anggaran (`/api/v1/budgets`)
| Method | Endpoint | Peran | Parameter / Body | Status Code | Tabel Terkait | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/budgets` | User, Admin | Query: `month`, `year` | 200, 401 | `budgets`, `categories`, `transactions` | `PLANNED` |
| `POST` | `/budgets` | User, Admin | Body: `category_id`, `limit_amount`, `start_date`, `end_date` | 201, 400, 422 | `budgets` | `PLANNED` |
| `PUT` | `/budgets/:id` | User, Admin | Param: `id`, Body: `limit_amount` | 200, 400, 404, 422 | `budgets` | `PLANNED` |
| `DELETE` | `/budgets/:id` | User, Admin | Param: `id` | 204, 401, 404 | `budgets` | `PLANNED` |

### Modul 8: Lampiran Bukti Transaksi (`/api/v1/attachments`)
| Method | Endpoint | Peran | Parameter / Body | Status Code | Tabel Terkait | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/attachments/upload` | User, Admin | FormData: `file` (max 2MB), `transaction_id` | 201, 400, 413, 415, 422 | `attachments`, `transactions` | `PLANNED` |
| `GET` | `/attachments/:id/download` | User, Admin | Param: `id` | 200, 401, 404 | `attachments` | `PLANNED` |
| `DELETE` | `/attachments/:id` | User, Admin | Param: `id` | 204, 401, 404 | `attachments` | `PLANNED` |

### Modul 9: Notifikasi (`/api/v1/notifications`)
| Method | Endpoint | Peran | Parameter / Body | Status Code | Tabel Terkait | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/notifications` | User, Admin | Query: `unread_only=true` | 200, 401 | `notifications` | `PLANNED` |
| `PATCH` | `/notifications/:id/read` | User, Admin | Param: `id` | 200, 401, 404 | `notifications` | `PLANNED` |
| `POST` | `/notifications/read-all` | User, Admin | None | 200, 401 | `notifications` | `PLANNED` |

### Modul 10: Admin (`/api/v1/admin`)
| Method | Endpoint | Peran | Parameter / Body | Status Code | Tabel Terkait | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/admin/metrics` | Admin | None (Statistik global) | 200, 401, 403 | `users`, `wallets`, `transfers` | `PLANNED` |
| `GET` | `/admin/users` | Admin | Query: `page`, `limit`, `search`, `status` | 200, 401, 403 | `users`, `wallets` | `PLANNED` |
| `PATCH` | `/admin/users/:id/status` | Admin | Param: `id`, Body: `is_active` | 200, 401, 403, 404 | `users` | `PLANNED` |
| `GET` | `/admin/activity-logs` | Admin | Query: `page`, `limit`, `user_id`, `action` | 200, 401, 403 | `activity_logs` | `PLANNED` |
