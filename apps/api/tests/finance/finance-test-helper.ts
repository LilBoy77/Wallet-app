import request from 'supertest';
import type { Express } from 'express';
import type { WalletResponse } from '@wallet-app/shared';

export interface TestUserSession {
  user: {
    id: string;
    username: string;
    email: string;
    full_name: string;
    role: string;
  };
  accessToken: string;
  wallet: WalletResponse;
}

let counter = 1;

export async function createAuthenticatedUser(
  app: Express,
  options?: {
    username?: string;
    email?: string;
    password?: string;
    initialBalance?: number;
  }
): Promise<TestUserSession> {
  const count = counter++;
  const username = options?.username || `fin_user_${Date.now()}_${count}`;
  const email = options?.email || `fin_${Date.now()}_${count}@wallet.local`;
  const password = options?.password || 'ValidPassword123!';

  // 1. Register (creates user and default wallet atomically)
  const regRes = await request(app)
    .post('/api/v1/auth/register')
    .send({
      username,
      email,
      password,
      full_name: `Test User ${count}`,
    })
    .expect(201);

  // 2. Login to obtain access token with active session
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);

  const accessToken = loginRes.body.data.tokens.access_token as string;

  // 3. Fetch default wallet
  const walletRes = await request(app)
    .get('/api/v1/wallets/my')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);

  let wallet = walletRes.body.data as WalletResponse;

  // 4. Optionally fund initial balance via topup simulation (chunked if exceeding per-tx cap)
  if (options?.initialBalance && options.initialBalance > 0) {
    let remaining = options.initialBalance;
    while (remaining > 0) {
      const chunk = Math.min(remaining, 50_000_000);
      const topupRes = await request(app)
        .post('/api/v1/wallets/my/topup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: chunk })
        .expect(200);
      wallet = topupRes.body.data as WalletResponse;
      remaining -= chunk;
    }
  }

  return {
    user: regRes.body.data,
    accessToken,
    wallet,
  };
}
