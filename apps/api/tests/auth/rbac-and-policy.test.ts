import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../src/config/env.js';
import {
  authenticate,
  requireRole,
  assertOwnerOrAdmin,
  ROUTE_POLICY_REGISTRY,
  normalizePath,
  globalErrorHandler,
} from '../../src/middlewares/index.js';
import { asyncHandler } from '../../src/shared/errors/index.js';
import { apiV1Router } from '../../src/modules/api.router.js';
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTestTables,
  getTestPool,
} from '../database/test-db-helper.js';

describe('Auth Module - RBAC, Ownership Assertion & Structural Route Policy', () => {
  let adminUserId: string;
  let normalUserId1: string;
  let normalUserId2: string;
  let adminToken: string;
  let userToken1: string;
  let userToken2: string;

  beforeAll(async () => {
    await setupTestDatabase();
    await cleanTestTables();

    const pool = getTestPool();

    // 1. Create Admin User
    const adminRes = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role)
       VALUES ('admin_rbac', 'admin_rbac@wallet.local', '$argon2id$mock', 'Admin RBAC', 'admin')
       RETURNING id`
    );
    adminUserId = adminRes.rows[0].id;
    adminToken = jwt.sign(
      { sub: adminUserId, role: 'admin', email: 'admin_rbac@wallet.local', jti: 'admin-jti' },
      env.JWT_ACCESS_SECRET,
      { algorithm: 'HS256', expiresIn: '15m', issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE }
    );

    // 2. Create User 1
    const user1Res = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role)
       VALUES ('user_rbac_1', 'user1_rbac@wallet.local', '$argon2id$mock', 'User One RBAC', 'user')
       RETURNING id`
    );
    normalUserId1 = user1Res.rows[0].id;
    userToken1 = jwt.sign(
      { sub: normalUserId1, role: 'user', email: 'user1_rbac@wallet.local', jti: 'user1-jti' },
      env.JWT_ACCESS_SECRET,
      { algorithm: 'HS256', expiresIn: '15m', issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE }
    );

    // 3. Create User 2
    const user2Res = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role)
       VALUES ('user_rbac_2', 'user2_rbac@wallet.local', '$argon2id$mock', 'User Two RBAC', 'user')
       RETURNING id`
    );
    normalUserId2 = user2Res.rows[0].id;
    userToken2 = jwt.sign(
      { sub: normalUserId2, role: 'user', email: 'user2_rbac@wallet.local', jti: 'user2-jti' },
      env.JWT_ACCESS_SECRET,
      { algorithm: 'HS256', expiresIn: '15m', issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE }
    );
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it('should distinguish 401 Unauthorized (unauthenticated) from 403 Forbidden (insufficient role)', async () => {
    // Dedicated test app for testing role middleware
    const testApp = express();
    testApp.use(express.json());

    testApp.get(
      '/admin-only-endpoint',
      asyncHandler(authenticate),
      requireRole('admin'),
      (_req: Request, res: Response) => {
        res.status(200).json({ success: true, message: 'Welcome Admin' });
      }
    );
    testApp.use(globalErrorHandler);

    // 1. Without token -> 401 UNAUTHORIZED
    const unauthRes = await request(testApp).get('/admin-only-endpoint').expect(401);
    expect(unauthRes.body.error.code).toBe('UNAUTHORIZED');

    // 2. Normal user token on admin route -> 403 FORBIDDEN
    const forbiddenRes = await request(testApp)
      .get('/admin-only-endpoint')
      .set('Authorization', `Bearer ${userToken1}`)
      .expect(403);
    expect(forbiddenRes.body.error.code).toBe('FORBIDDEN');
    expect(forbiddenRes.body.error.message).toContain('tidak memiliki izin');

    // 3. Admin user token -> 200 OK
    const adminRes = await request(testApp)
      .get('/admin-only-endpoint')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(adminRes.body.success).toBe(true);
    expect(adminRes.body.message).toBe('Welcome Admin');
  });

  it('should enforce resource ownership helper (assertOwnerOrAdmin): prevent IDOR', async () => {
    const testApp = express();
    testApp.use(express.json());

    // Mock resource endpoint: /items/:ownerId
    testApp.get('/items/:ownerId', asyncHandler(authenticate), (req: Request, res: Response) => {
      // Enforce ownership: owner or admin
      assertOwnerOrAdmin(req.user, req.params['ownerId']!);
      res.status(200).json({ success: true, data: { owner: req.params['ownerId'] } });
    });
    testApp.use(globalErrorHandler);

    // 1. User 1 accessing User 1 resource -> 200 OK (Owner access)
    await request(testApp)
      .get(`/items/${normalUserId1}`)
      .set('Authorization', `Bearer ${userToken1}`)
      .expect(200);

    // 2. User 1 accessing User 2 resource -> 403 FORBIDDEN (IDOR prevented!)
    const idorRes = await request(testApp)
      .get(`/items/${normalUserId2}`)
      .set('Authorization', `Bearer ${userToken1}`)
      .expect(403);

    expect(idorRes.body.error.code).toBe('FORBIDDEN');
    expect(idorRes.body.error.message).toContain(
      'tidak memiliki izin untuk mengelola sumber daya milik pengguna lain'
    );

    // 3. Admin accessing User 2 resource -> 200 OK (Admin override)
    await request(testApp)
      .get(`/items/${normalUserId2}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // 4. User 2 accessing User 2 resource -> 200 OK (Owner access)
    await request(testApp)
      .get(`/items/${normalUserId2}`)
      .set('Authorization', `Bearer ${userToken2}`)
      .expect(200);
  });

  it('should structurally enumerate ALL routes registered under /api/v1 and fail if any route lacks explicit policy', () => {
    // Extract registered routes from Express apiV1Router stack
    interface ExtractedRoute {
      method: string;
      path: string;
    }

    const actualRoutes: ExtractedRoute[] = [];

    // Traverse router stack
    for (const layer of apiV1Router.stack) {
      if (layer.route) {
        // Direct route on router
        const methods = Object.keys(layer.route.methods);
        for (const m of methods) {
          actualRoutes.push({
            method: m.toUpperCase(),
            path: layer.route.path,
          });
        }
      } else if (layer.name === 'router' && layer.handle?.stack) {
        // Sub-router mounted on prefix
        // Extract prefix from regex
        let prefix = '';
        if (layer.regexp) {
          const match = layer.regexp.source
            .replace('^\\', '')
            .replace('\\/?(?=\\/|$)', '')
            .replace(/\\\//g, '/');
          prefix = match.startsWith('/') ? match : `/${match}`;
        }

        for (const subLayer of layer.handle.stack) {
          if (subLayer.route) {
            const methods = Object.keys(subLayer.route.methods);
            for (const m of methods) {
              const fullPath = `${normalizePath(prefix)}${subLayer.route.path === '/' ? '' : subLayer.route.path}`;
              actualRoutes.push({
                method: m.toUpperCase(),
                path: fullPath,
              });
            }
          }
        }
      }
    }

    expect(actualRoutes.length).toBeGreaterThan(0);

    // Verify 100% of actual routes have explicit declarations in ROUTE_POLICY_REGISTRY
    const unmappedRoutes: ExtractedRoute[] = [];

    for (const route of actualRoutes) {
      const policy = ROUTE_POLICY_REGISTRY.find(
        (p) => p.method === route.method && normalizePath(p.path) === normalizePath(route.path)
      );

      if (!policy) {
        unmappedRoutes.push(route);
      }
    }

    // Fail immediately if any route is undocumented/unmapped
    if (unmappedRoutes.length > 0) {
      const errorList = unmappedRoutes.map((r) => `${r.method} ${r.path}`).join(', ');
      throw new Error(
        `[SECURITY_STRUCTURAL_VIOLATION] Found registered routes on /api/v1 without explicit access policy in ROUTE_POLICY_REGISTRY: ${errorList}`
      );
    }

    expect(unmappedRoutes).toHaveLength(0);
  });
});
