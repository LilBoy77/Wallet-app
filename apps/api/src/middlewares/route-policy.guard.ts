import type { UserRole } from '@wallet-app/shared';

export interface RoutePolicy {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string; // Relative to /api/v1
  access: 'public' | 'authenticated';
  roles?: UserRole[];
  description: string;
}

/**
 * Structural Route Policy Registry:
 * Every endpoint exposed under /api/v1 MUST have an explicit policy declared here.
 * If an endpoint is created without an entry here, automated route enumeration tests will fail.
 */
export const ROUTE_POLICY_REGISTRY: RoutePolicy[] = [
  // Module 1: Auth Endpoints
  {
    method: 'POST',
    path: '/auth/register',
    access: 'public',
    description: 'Pendaftaran akun pengguna baru',
  },
  {
    method: 'POST',
    path: '/auth/login',
    access: 'public',
    description: 'Masuk akun menggunakan kredensial email & kata sandi',
  },
  {
    method: 'POST',
    path: '/auth/refresh',
    access: 'public',
    description: 'Rotasi access token menggunakan cookie refresh token yang valid',
  },
  {
    method: 'POST',
    path: '/auth/logout',
    access: 'public',
    description: 'Keluar dan mencabut refresh token pada cookie saat ini',
  },
  {
    method: 'POST',
    path: '/auth/logout-all',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Mencabut seluruh sesi dan refresh token milik pengguna',
  },
  {
    method: 'GET',
    path: '/auth/me',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Mengambil profil detail pengguna yang sedang login',
  },
  {
    method: 'PUT',
    path: '/auth/change-password',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Mengubah kata sandi pengguna terautentikasi dan mencabut sesi lain',
  },
  {
    method: 'POST',
    path: '/auth/forgot-password',
    access: 'public',
    description: 'Permintaan tautan pemulihan kata sandi',
  },
  {
    method: 'POST',
    path: '/auth/reset-password',
    access: 'public',
    description: 'Penyetelan ulang kata sandi menggunakan token pemulihan yang valid',
  },

  // Module 2: Wallets Endpoints (Phase 5)
  {
    method: 'GET',
    path: '/wallets/my',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Mengambil data dompet milik pengguna yang sedang login',
  },
  {
    method: 'GET',
    path: '/wallets/my/entries',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Mengambil riwayat mutasi audit ledger dompet milik pengguna',
  },
  {
    method: 'POST',
    path: '/wallets/my/topup',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Simulasi pengisian saldo dompet (fase pengembangan/testing)',
  },
  {
    method: 'PUT',
    path: '/wallets/my',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Memperbarui metadata non-finansial dompet pengguna',
  },

  // Module 3: Transactions Endpoints (Phase 5)
  {
    method: 'POST',
    path: '/transactions',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Mencatat transaksi baru (pemasukan atau pengeluaran)',
  },
  {
    method: 'GET',
    path: '/transactions',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Mengambil daftar riwayat transaksi pengguna dengan filter dan paginasi',
  },
  {
    method: 'GET',
    path: '/transactions/:id',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Mengambil detail satu transaksi milik pengguna',
  },
  {
    method: 'PUT',
    path: '/transactions/:id',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Memperbarui metadata non-finansial transaksi (deskripsi/kategori)',
  },
  {
    method: 'DELETE',
    path: '/transactions/:id',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Membatalkan (void) transaksi dan menghasilkan entri pembalik di ledger',
  },

  // Module 4: Transfers Endpoints (Phase 5)
  {
    method: 'POST',
    path: '/transfers',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Melakukan transfer saldo internal antar-dompet secara atomik dan idempoten',
  },
  {
    method: 'GET',
    path: '/transfers',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Mengambil daftar riwayat transfer kirim dan terima milik pengguna',
  },
  {
    method: 'GET',
    path: '/transfers/:id',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Mengambil detail transaksi transfer milik pengguna',
  },

  // Module 5: Categories Endpoints (Phase 6)
  {
    method: 'GET',
    path: '/categories',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Mengambil daftar kategori transaksi sistem dan milik pengguna',
  },
  {
    method: 'POST',
    path: '/categories',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Membuat kategori kustom baru milik pengguna',
  },
  {
    method: 'GET',
    path: '/categories/:id',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Mengambil detail kategori berdasarkan ID',
  },
  {
    method: 'PUT',
    path: '/categories/:id',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Memperbarui nama, ikon, atau warna kategori kustom pengguna',
  },
  {
    method: 'DELETE',
    path: '/categories/:id',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Menghapus (soft delete) kategori kustom milik pengguna',
  },

  // Module 6: Budgets Endpoints (Phase 6)
  {
    method: 'GET',
    path: '/budgets',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Mengambil daftar pagu anggaran bulanan beserta realisasi belanja agregat',
  },
  {
    method: 'POST',
    path: '/budgets',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Membuat pagu anggaran baru untuk kategori dan periode bulan tertentu',
  },
  {
    method: 'GET',
    path: '/budgets/:id',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Mengambil detail pagu anggaran beserta realisasi belanja',
  },
  {
    method: 'PUT',
    path: '/budgets/:id',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Memperbarui nominal pagu limit anggaran',
  },
  {
    method: 'DELETE',
    path: '/budgets/:id',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Menghapus (soft delete) pagu anggaran pengguna',
  },

  // Module 7: Attachments Endpoints (Phase 6)
  {
    method: 'POST',
    path: '/attachments',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Mengunggah berkas kuitansi/bukti transaksi yang aman',
  },
  {
    method: 'GET',
    path: '/attachments/:id/download',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Mengunduh berkas fisik bukti transaksi terproteksi',
  },
  {
    method: 'GET',
    path: '/attachments/:id',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Mengambil metadata berkas lampiran transaksi',
  },
  {
    method: 'GET',
    path: '/attachments/transaction/:transactionId',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Mengambil daftar berkas lampiran pada suatu transaksi',
  },
  {
    method: 'DELETE',
    path: '/attachments/:id',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Menghapus berkas lampiran dan fisik berkas dari server',
  },

  // Module 8: Activity Logs Endpoints (Phase 6)
  {
    method: 'GET',
    path: '/activity-logs/my',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description: 'Mengambil riwayat log aktivitas audit milik pengguna sendiri',
  },
  {
    method: 'GET',
    path: '/activity-logs',
    access: 'authenticated',
    roles: ['user', 'admin'],
    description:
      'Mengambil riwayat log aktivitas audit (milik sendiri bagi user, seluruh log bagi admin)',
  },

  // Module 9: Admin Endpoints (Phase 6)
  {
    method: 'GET',
    path: '/admin/activity-logs',
    access: 'authenticated',
    roles: ['admin'],
    description: 'Mengambil seluruh riwayat log aktivitas audit sistem per kontrak admin',
  },
];

/**
 * Normalizes a route path for comparison (removing trailing slashes).
 */
export function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (trimmed.length > 1 && trimmed.endsWith('/')) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
}

/**
 * Finds policy for an endpoint.
 */
export function getRoutePolicy(method: string, path: string): RoutePolicy | undefined {
  const normMethod = method.toUpperCase();
  const normPath = normalizePath(path);

  return ROUTE_POLICY_REGISTRY.find(
    (p) => p.method === normMethod && normalizePath(p.path) === normPath
  );
}
