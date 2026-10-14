import { Router } from 'express';
import { authRouter } from './auth/auth.router.js';

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
