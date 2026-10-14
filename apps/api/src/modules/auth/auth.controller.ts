import type { Request, Response } from 'express';
import { env } from '../../config/env.js';
import { pool } from '../../database/index.js';
import { authService, toUserProfileResponse } from './auth.service.js';
import { authRepository } from './auth.repository.js';
import { UnauthorizedError } from '../../shared/errors/index.js';

export class AuthController {
  private setRefreshCookie(res: Response, rawToken: string): void {
    res.cookie('refreshToken', rawToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
    });
  }

  register = async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    const user = await authService.register(req.body, req.ip || '');
    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil',
      data: user,
    });
  };

  login = async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    const { user, tokens, rawRefreshToken } = await authService.login(req.body, req.ip || '');
    this.setRefreshCookie(res, rawRefreshToken);

    res.status(200).json({
      success: true,
      message: 'Login berhasil',
      data: { user, tokens },
    });
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    const rawRefreshToken = req.cookies?.refreshToken;
    if (!rawRefreshToken) {
      throw new UnauthorizedError('Cookie refresh token tidak ditemukan');
    }

    const { user, tokens, newRawRefreshToken } = await authService.refresh(
      rawRefreshToken,
      req.ip || ''
    );
    this.setRefreshCookie(res, newRawRefreshToken);

    res.status(200).json({
      success: true,
      message: 'Token berhasil diperbarui',
      data: { user, tokens },
    });
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    const rawRefreshToken = req.cookies?.refreshToken;
    await authService.logout(rawRefreshToken, req.user?.id, req.ip || '');
    this.clearRefreshCookie(res);

    res.status(200).json({
      success: true,
      message: 'Logout berhasil',
      data: null,
    });
  };

  logoutAll = async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    await authService.logoutAll(req.user!.id, req.ip || '');
    this.clearRefreshCookie(res);

    res.status(200).json({
      success: true,
      message: 'Seluruh sesi berhasil dicabut',
      data: null,
    });
  };

  me = async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    const user = await authRepository.findUserById(pool, req.user!.id);
    if (!user) {
      throw new UnauthorizedError('Pengguna tidak ditemukan');
    }

    res.status(200).json({
      success: true,
      message: 'Profil pengguna berhasil dimuat',
      data: toUserProfileResponse(user),
    });
  };

  changePassword = async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    await authService.changePassword(req.user!.id, req.body, req.ip || '');
    this.clearRefreshCookie(res);

    res.status(200).json({
      success: true,
      message: 'Kata sandi berhasil diubah. Seluruh sesi lain telah dicabut.',
      data: null,
    });
  };

  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    await authService.forgotPassword(req.body.email, req.ip || '');

    res.status(200).json({
      success: true,
      message:
        'Jika email terdaftar pada sistem kami, tautan pemulihan kata sandi telah dikirimkan',
      data: null,
    });
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    await authService.resetPassword(req.body, req.ip || '');
    this.clearRefreshCookie(res);

    res.status(200).json({
      success: true,
      message: 'Kata sandi berhasil diperbarui. Silakan login kembali dengan kata sandi baru.',
      data: null,
    });
  };
}

export const authController = new AuthController();
