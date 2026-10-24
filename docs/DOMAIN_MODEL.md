# DOMAIN_MODEL — Model Domain & Analisis Trade-off Finansial

Dokumen ini mendefinisikan entitas domain inti, relasi konseptual, state machine, dan analisis mendalam terhadap trade-off arsitektur data finansial untuk Wallet App.

---

## 1. Definisi Entitas Domain Inti
1. **User**: Entitas pemilik identitas dalam sistem. Memiliki kredensial autentikasi, profil (nama, email, username), dan peran (`role`: 'user' atau 'admin').
2. **Wallet**: Entitas akun keuangan virtual tertutup (*closed-loop*). Setiap pengguna memiliki tepat satu dompet utama (relasi 1:1) yang memuat snapshot saldo terverifikasi (`balance`).
3. **Transaction**: Catatan mutasi keuangan pengguna untuk pemasukan (*income*) atau pengeluaran (*expense*), terkait dengan kategori tertentu dan dapat memiliki lampiran bukti transfer.
4. **WalletEntry (Ledger Entry)**: Catatan pembukuan buku besar atomik (*double-entry principle*) yang merekam debit atau kredit mutasi saldo wallet.
5. **Transfer**: Entitas transaksi khusus yang memindahkan saldo dari dompet pengirim (*source wallet*) ke dompet penerima (*target wallet*) dalam transaksi atomik.
6. **Category**: Klasifikasi jenis transaksi (misalnya Makanan & Minuman, Transportasi, Gaji, Investasi). Dapat berupa kategori default sistem (global) atau kategori kustom pengguna.
7. **Budget**: Batasan pagu pengeluaran terencana per kategori dalam suatu periode (bulanan) yang memantau akumulasi pengeluaran.
8. **Attachment**: Metadata berkas bukti transaksi (struk/faktur) yang diunggah pengguna.
9. **ActivityLog**: Jejak audit sistem yang mencatat operasi kritis (login, perubahan profil, transfer saldo, perubahan status user).
10. **Notification**: Pemberitahuan aplikasi kepada pengguna (misal: transfer masuk, peringatan pagu anggaran terlampaui $\ge 80\%$).
11. **Tag & TransactionTag**: Label taksonomi fleksibel yang dapat dilekatkan pada banyak transaksi (relasi N:N).

---

## 2. Analisis Trade-off & Keputusan Kritis Finansial

### A. Representasi Nilai Uang (Integer Minor Unit vs NUMERIC) `[DECIDED]`
- **Opsi 1: `FLOAT` / `DOUBLE` di Database & JavaScript Number**:
  - *Kelemahan*: Binary floating point menghasilkan presisi tidak tepat (misal `0.1 + 0.2 = 0.30000000000000004`). Tidak dapat ditoleransi dalam sistem keuangan.
- **Opsi 2: `NUMERIC(15, 2)` / `DECIMAL`**:
  - *Kelebihan*: Standar database finansial umum yang mendukung sen.
  - *Kelemahan*: Di JavaScript, nilai numerik floating point tetap dapat terdistorsi saat di-parse menjadi `number`, membutuhkan pustaka bignumber tambahan.
- **Opsi 3: Integer Minor Units (`BIGINT` di DB / Integer Rupiah Utuh)**:
  - *Kelebihan*: IDR (Rupiah) dalam praktik operasional tidak menggunakan sen/desimal pecahan. Nilai 1 Rupiah direpresentasikan sebagai integer `1`. Untuk mata uang dengan sen di masa depan, minor unit sen (misal 100 sen = 1 dolar) tetap berupa integer. Operasi penambahan/pengurangan integer pada JavaScript dan SQL 100% presisi tanpa floating point artifact.
- **Keputusan**: **Menggunakan Integer Minor Units (`BIGINT` di PostgreSQL / Integer di backend) dengan basis mata uang IDR**. Lapisan frontend memformat angka murni untuk kebutuhan tampilan menggunakan `Intl.NumberFormat('id-ID')`.

---

### B. Arsitektur Saldo: Kolom Turunan vs Dihitung dari Ledger (`wallet_entries`) `[DECIDED]`
- **Opsi 1: Pure Computed Balance (Dihitung dari `SUM(amount)` tabel ledger setiap kali query)**:
  - *Kelebihan*: Tidak ada anomali duplikasi nilai.
  - *Kelemahan*: Skalabilitas buruk. Menghitung agregat seluruh riwayat transaksi setiap kali user membuka dashboard atau melakukan transfer akan memperlambat response time seiring bertambahnya volume data.
- **Opsi 2: Pure Snapshot Balance (Hanya kolom `balance` di tabel `wallets` tanpa ledger)**:
  - *Kelebihan*: Sangat cepat saat query baca.
  - *Kelemahan*: Rentan hilang jejak audit. Jika terjadi anomali sistem atau bug, tidak ada rekaman forensik untuk membuktikan dari mana selisih angka berasal.
- **Opsi 3: Hybrid Snapshot + Immutable Double-Entry Ledger (`wallet_entries`)**:
  - *Kelebihan*: Kolom `wallets.balance` menyimpan saldo terkini terverifikasi untuk performa tinggi read query. Setiap perubahan `balance` WAJIB disertai penulisan baris baru pada tabel `wallet_entries` (debit/kredit) dalam transaksi atomik yang sama. Konsistensi dapat diverifikasi kapan saja dengan query audit rekonsiliasi: `SUM(credits) - SUM(debits) == wallets.balance`.
- **Keputusan**: **Mengadopsi Pola Hybrid (Snapshot `wallets.balance` + Immutable `wallet_entries`)**.

---

### C. Atomisitas Transfer Saldo & Pencegahan Deadlock `[DECIDED]`
Pada operasi transfer saldo internal dari Pengguna A ke Pengguna B:
1. **Risiko Concurrency**:
   - *Lost Update*: Pengguna A mentransfer secara bersamaan di dua tab browser; saldo terpotong hanya sekali jika tidak ada lock.
   - *Deadlock*: Pengguna A mentransfer ke Pengguna B pada saat bersamaan Pengguna B mentransfer ke Pengguna A. Jika A mengunci row A lalu meminta row B, sementara B mengunci row B lalu meminta row A, database akan mengalami deadlock.
2. **Strategi Locking Terurut (Sorted Locking Order)**:
   - Sebelum melakukan update, transaksi database mengambil *exclusive row lock* (`SELECT ... FOR UPDATE`) pada kedua dompet.
   - Kedua baris dompet dikunci secara terurut berdasarkan ID terkecil terlebih dahulu:
     ```sql
     -- Jika wallet_source = 5 dan wallet_target = 2:
     -- Urutan lock: ID 2 dulu, baru ID 5
     SELECT id, balance FROM wallets WHERE id IN ($1, $2) ORDER BY id ASC FOR UPDATE;
     ```
   - Karena semua transaksi sistem selalu mengunci dengan urutan ID yang sama (ASC), kondisi *circular wait* tereliminasi sepenuhnya, sehingga **deadlock mustahil terjadi**.
3. **Pengecekan Saldo di dalam Transaction Boundary**:
   - Setelah lock diperoleh, sistem memeriksa: `source_wallet.balance >= transfer_amount`.
   - Jika kurang, transaksi langsung di-ROLLBACK dan mengembalikan HTTP 422 Unprocessable Entity.

---

### D. Idempotensi Permintaan Transfer (Idempotency Key & Canonical Hashing) `[DECIDED]`
- Pengguna yang mengalami latensi jaringan dapat mengirimkan request `POST /api/v1/transfers` berulang kali.
- Klien wajib menyertakan header `Idempotency-Key` (UUIDv4).
- Idempotensi diproteksi di tabel terdedikasi `idempotency_records` dengan `UNIQUE (user_id, idempotency_key)`:
  - Backend menghitung canonical SHA-256 hash dari payload JSON request (`canonicalStringify`).
  - Jika request pertama berhasil, status HTTP dan response body dicatat secara atomik di dalam transaksi transfer yang sama.
  - Jika request ulang dikirim dengan key yang sama dan payload identik: sistem langsung mengembalikan cached response tanpa memotong saldo berulang.
  - Jika key yang sama digunakan dengan payload berbeda: backend menolak dengan error `409 IDEMPOTENCY_CONFLICT`.
- Di tabel `transfers`, kolom `idempotency_key` dijamin unik per dompet sumber via constraint `UNIQUE (source_wallet_id, idempotency_key)`.

---

### E. Kebijakan Saldo Negatif & Safe Arithmetic `[DECIDED]`
- **Aturan Tegas**: Saldo dompet dalam ekosistem Wallet App **TIDAK BOLEH PERNAH BERNILAI NEGATIF** (`balance >= 0`).
- **Penegakan Multilapis**:
  1. *Database Constraint*: `CONSTRAINT chk_wallet_balance_non_negative CHECK (balance >= 0)`.
  2. *Row Lock Check*: Validasi eksplisit di service layer di bawah exclusive row lock (`SELECT ... FOR UPDATE`).
  3. *Safe BigInt Arithmetic*: Operasi penambahan dan pengurangan menggunakan utilitas `safeAddMoney` dan `safeSubtractMoney` di `packages/shared/src/finance.ts` untuk mencegah floating point artifacts dan runtime overflow.

---

### F. Integritas Ledger & Mutasi Saldo Atomik `[DECIDED]`
- **Single Point of Balance Mutation**: Mutasi `wallets.balance` secara ketat hanya diizinkan melalui `WalletsRepository` (`executeBalanceMutation`) di dalam transaksi database atomik.
- **Setiap Mutasi Bersifat Berpasangan dengan Ledger**:
  - Transaksi `INCOME`: 1 entry `CREDIT` pada `wallet_entries`.
  - Transaksi `EXPENSE`: 1 entry `DEBIT` pada `wallet_entries`.
  - Transfer internal: 2 entries berpasangan (1 `DEBIT` pada dompet pengirim, 1 `CREDIT` pada dompet penerima) dengan `reference_type = 'transfer'`.
  - Void transaksi: 1 entry kompensasi (`DEBIT` pembalik untuk INCOME, `CREDIT` pembalik untuk EXPENSE) dengan `reference_type = 'transaction_void'`.
- **Konservasi Saldo Total**: Total debit transfer internal selalu identik dengan total kredit transfer internal ($\sum \text{debit} = \sum \text{credit}$).

---

### G. Model Masuknya Uang pada Ekosistem Tertutup (Closed-Loop Simulation) `[DECIDED]`
- Sistem ini dirancang sebagai **simulasi dompet tertutup (closed-loop wallet)** tanpa ketergantungan pada payment gateway pihak ketiga eksternal (sesuai batasan proyek pada [AGENTS.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/AGENTS.md)).
- Saldo pengguna dalam simulasi ini dapat bertambah ke dalam ekosistem hanya melalui 2 (dua) mekanisme terkontrol:
  1. **Simulasi Top-Up (`POST /api/v1/wallets/my/topup`)**:
     - Ditujukan khusus untuk kebutuhan simulasi pengisian saldo pada fase pengembangan dan pengujian (*testing/development*).
     - **Gating Keamanan Ketat**: Endpoint ini hanya aktif jika flag environment `ENABLE_TOPUP_SIMULATION=true`. Secara bawaan (*default*), flag bernilai `false`. Backend secara otomatis menolak start atau memblokir akses (HTTP 403 `TOPUP_SIMULATION_DISABLED`) apabila `NODE_ENV=production`.
     - **Batas Maksimum Nominal**: Dibatasi oleh pagu batas atas per transaksi yang dikonfigurasi melalui `TOPUP_MAX_AMOUNT_PER_TX` (default Rp 50.000.000) dengan kode error HTTP 400 `LIMIT_EXCEEDED` jika terlampaui.
     - **Pencatatan & Audit**: Setiap simulasi topup dicatat sebagai entri kredit pada `wallet_entries` (`reference_type = 'topup_simulation'`) dan diaudit di `activity_logs`.
  2. **Pencatatan Transaksi Pemasukan Pribadi (`POST /api/v1/transactions` dengan `type: 'income'`)**:
     - Mengakomodasi pencatatan arus kas masuk pengguna (seperti penerimaan gaji tunai, hasil usaha, atau dividen) ke dalam saldo dompet.
     - **Batas Maksimum Nominal**: Dibatasi oleh pagu batas atas per transaksi yang dikonfigurasi melalui `INCOME_MAX_AMOUNT_PER_TX` (default Rp 50.000.000) dengan kode error HTTP 400 `LIMIT_EXCEEDED` jika terlampaui.
     - **Pencatatan & Audit**: Menghasilkan baris mutasi kredit ledger `wallet_entries` berpasangan dengan rekaman transaksi berstatus `COMPLETED`.

---

## 3. State Machine Transaksi & Transfer `[DECIDED]`

### A. State Machine Transaksi (Income / Expense)
```mermaid
stateDiagram-v2
    [*] --> COMPLETED: Pencatatan Transaksi Berhasil (Saldo Dimutasi & Ledger Ditulis)
    COMPLETED --> VOIDED: Pembatalan Transaksi (/transactions/:id/void)
    VOIDED --> [*]: Saldo Dikembalikan & Entri Pembalik Dicatat
```

- **COMPLETED**: Transaksi aktif. Atribut finansial (`amount`, `type`, `wallet_id`) bersifat kekal (*immutable*). Hanya `notes` dan `category_id` yang dapat diperbarui.
- **VOIDED**: Transaksi dibatalkan secara permanen. Transaksi yang sudah dibatalkan tidak dapat di-void ulang (menghasilkan `400 BAD_REQUEST`).

### B. State Machine Transfer Saldo
```mermaid
stateDiagram-v2
    [*] --> PROCESSING: Lock Acquired (ORDER BY id ASC FOR UPDATE)
    PROCESSING --> SUCCESS: Saldo Terpotong, Ditambah, Ledger Ditulis, Idempotency Dicatat
    PROCESSING --> FAILED: Saldo Tidak Cukup / Wallet Tidak Aktif / Rollback
    SUCCESS --> [*]
    FAILED --> [*]
```

---

## 4. Kepemilikan Data & Batasan Hak Akses (Data Ownership) `[DECIDED]`
- Setiap entitas finansial (`wallets`, `transactions`, `budgets`, `categories` kustom) terikat secara kaku pada `user_id`.
- Regular user hanya dapat membaca, mengubah, atau menghapus data miliknya sendiri (`WHERE user_id = :currentUser.id`).
- Admin memiliki hak inspeksi global untuk pemantauan sistem, namun tidak dapat memanipulasi mutasi saldo pengguna tanpa melalui alur resmi yang tercatat di audit trail `activity_logs`.
