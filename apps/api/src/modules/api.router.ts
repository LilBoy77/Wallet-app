import { Router } from 'express';
import { authRouter } from './auth/auth.router.js';
import { walletsRouter } from './wallets/wallets.router.js';
import { transactionsRouter } from './transactions/transactions.router.js';
import { transfersRouter } from './transfers/transfers.router.js';

export interface ApiModuleRegistration {
  name: string;
  prefix: string;
  router: Router;
  description?: string;
}

const registeredModules: ApiModuleRegistration[] = [];

/**
 * Root Router for API Version 1 (/api/v1)
 * Holds module registrations for domain sub-routers.
 */
export const apiV1Router: Router = Router();

/**
 * Registers a new domain module into the /api/v1 router.
 */
export function registerApiModule(module: ApiModuleRegistration): void {
  registeredModules.push(module);
  apiV1Router.use(module.prefix, module.router);
}

/**
 * Returns read-only list of currently registered API modules.
 */
export function getRegisteredModules(): ReadonlyArray<ApiModuleRegistration> {
  return [...registeredModules];
}

// Phase 4: Register Auth Module (/api/v1/auth)
registerApiModule({
  name: 'auth',
  prefix: '/auth',
  router: authRouter,
  description: 'Authentication, session management, and RBAC module',
});

// Phase 5: Register Wallets Module (/api/v1/wallets)
registerApiModule({
  name: 'wallets',
  prefix: '/wallets',
  router: walletsRouter,
  description: 'Core wallet balance, metadata, and audit ledger entries',
});

// Phase 5: Register Transactions Module (/api/v1/transactions)
registerApiModule({
  name: 'transactions',
  prefix: '/transactions',
  router: transactionsRouter,
  description: 'Income, expense, metadata updates, and atomic void operations',
});

import { categoriesRouter } from './categories/categories.router.js';
import { budgetsRouter } from './budgets/budgets.router.js';
import { attachmentsRouter } from './attachments/attachments.router.js';
import {
  activityLogsRouter,
  adminActivityLogsRouter,
} from './activity-logs/activity-logs.router.js';

// Phase 5: Register Transfers Module (/api/v1/transfers)
registerApiModule({
  name: 'transfers',
  prefix: '/transfers',
  router: transfersRouter,
  description: 'Atomic, idempotent, double-entry internal wallet transfers',
});

// Phase 6: Register Categories Module (/api/v1/categories)
registerApiModule({
  name: 'categories',
  prefix: '/categories',
  router: categoriesRouter,
  description: 'Category management with system defaults and soft-delete-aware uniqueness',
});

// Phase 6: Register Budgets Module (/api/v1/budgets)
registerApiModule({
  name: 'budgets',
  prefix: '/budgets',
  router: budgetsRouter,
  description: 'Monthly budget management with aggregated expense realization tracking',
});

// Phase 6: Register Attachments Module (/api/v1/attachments)
registerApiModule({
  name: 'attachments',
  prefix: '/attachments',
  router: attachmentsRouter,
  description: 'Secure file upload and download for transaction receipts',
});

// Phase 6: Register Activity Logs Module (/api/v1/activity-logs)
registerApiModule({
  name: 'activity-logs',
  prefix: '/activity-logs',
  router: activityLogsRouter,
  description: 'Immutable system audit trail and user activity log inquiry',
});

// Phase 6: Register Admin Activity Logs (/api/v1/admin)
registerApiModule({
  name: 'admin',
  prefix: '/admin',
  router: adminActivityLogsRouter,
  description: 'Admin operational oversight endpoints',
});
