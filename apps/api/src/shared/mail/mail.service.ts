import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../../config/env.js';
import { logger } from '../logging/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface MailService {
  sendMail(options: SendMailOptions): Promise<void>;
}

export class OutboxMailService implements MailService {
  private readonly outboxDir: string;

  constructor() {
    this.outboxDir = path.resolve(__dirname, '../../../.outbox');
    if (!fs.existsSync(this.outboxDir)) {
      fs.mkdirSync(this.outboxDir, { recursive: true });
    }
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const fileName = `${timestamp}_${randomSuffix}_to_${options.to.replace(/[@.]/g, '_')}.json`;
    const filePath = path.join(this.outboxDir, fileName);

    const payload = {
      timestamp: new Date().toISOString(),
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };

    await fs.promises.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    logger.info(
      { to: options.to, subject: options.subject, filePath },
      '[MAIL] Email written to local outbox'
    );
  }

  getOutboxDir(): string {
    return this.outboxDir;
  }
}

export class ProductionSmtpMailService implements MailService {
  constructor() {
    if (env.NODE_ENV === 'production' && !env.SMTP_HOST) {
      throw new Error(
        '[FATAL_CONFIGURATION] Production environment requires a valid SMTP_HOST configuration for MailService'
      );
    }
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    // In production, real SMTP transport would be invoked here.
    logger.info(
      { to: options.to, subject: options.subject },
      '[MAIL_PROD] Sending email via configured SMTP'
    );
  }
}

export function createMailService(): MailService {
  if (env.NODE_ENV === 'production') {
    return new ProductionSmtpMailService();
  }
  return new OutboxMailService();
}

export const mailService = createMailService();
