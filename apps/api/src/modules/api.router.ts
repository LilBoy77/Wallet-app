import { Router } from 'express';

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
 * Used by subsequent phases (Phase 4: Auth, Phase 5: Wallets, Phase 6: Transactions, etc.)
 *
 * Example usage:
 * ```typescript
 * registerApiModule({
 *   name: 'auth',
 *   prefix: '/auth',
 *   router: authRouter,
 *   description: 'Authentication and session management module'
 * });
 * ```
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

/**
 * Empty Module Registry Blueprint
 * Domain modules will be registered here in future phases:
 * - Phase 4: /auth (Authentication & Session)
 * - Phase 5: /wallets (Wallets & Balances)
 * - Phase 6: /transactions (Transactions & Ledger)
 * - Phase 7: /transfers (Internal Fund Transfers)
 * - Phase 8: /categories & /budgets
 * - Phase 9: /attachments & /notifications
 * - Phase 10: /admin
 */
