import { z } from 'zod';

export type UserRole = 'admin' | 'user';

export const passwordSchema = z
  .string({ required_error: 'Kata sandi wajib diisi' })
  .min(8, 'Kata sandi minimal 8 karakter')
  .max(72, 'Kata sandi maksimal 72 karakter')
  .regex(/[A-Z]/, 'Kata sandi harus mengandung minimal satu huruf besar')
  .regex(/[a-z]/, 'Kata sandi harus mengandung minimal satu huruf kecil')
  .regex(/[0-9]/, 'Kata sandi harus mengandung minimal satu angka');

export const usernameSchema = z
  .string({ required_error: 'Username wajib diisi' })
  .min(3, 'Username minimal 3 karakter')
  .max(50, 'Username maksimal 50 karakter')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username hanya boleh memuat huruf, angka, dan underscore (_)');

export const emailSchema = z
  .string({ required_error: 'Email wajib diisi' })
  .email('Format email tidak valid')
  .max(255, 'Email maksimal 255 karakter')
  .transform((val) => val.trim().toLowerCase());

// 1. Register Schema
export const registerInputSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  full_name: z
    .string({ required_error: 'Nama lengkap wajib diisi' })
    .min(2, 'Nama lengkap minimal 2 karakter')
    .max(100, 'Nama lengkap maksimal 100 karakter')
    .trim(),
});

export type RegisterInput = z.infer<typeof registerInputSchema>;

// 2. Login Schema
export const loginInputSchema = z.object({
  email: emailSchema,
  password: z
    .string({ required_error: 'Kata sandi wajib diisi' })
    .min(1, 'Kata sandi tidak boleh kosong'),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

// 3. Change Password Schema
export const changePasswordInputSchema = z.object({
  current_password: z
    .string({ required_error: 'Kata sandi saat ini wajib diisi' })
    .min(1, 'Kata sandi saat ini tidak boleh kosong'),
  new_password: passwordSchema,
});

export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;

// 4. Forgot Password Schema
export const forgotPasswordInputSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordInputSchema>;

// 5. Reset Password Schema
export const resetPasswordInputSchema = z.object({
  token: z
    .string({ required_error: 'Token pemulihan kata sandi wajib diisi' })
    .min(1, 'Token pemulihan kata sandi tidak boleh kosong'),
  new_password: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;

// Types for responses
export interface UserProfileResponse {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

export interface AuthSuccessResponse {
  user: UserProfileResponse;
  tokens: AuthTokens;
}

export interface JwtAccessPayload {
  sub: string;
  role: UserRole;
  email: string;
  jti: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}
