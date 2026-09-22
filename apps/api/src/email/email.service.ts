import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private log = new Logger('Email');
  private resend: Resend | null = null;
  private from: string;

  constructor() {
    const key = process.env.RESEND_API_KEY;
    this.from = process.env.EMAIL_FROM ?? 'Research Casino <onboarding@resend.dev>';
    if (key) {
      this.resend = new Resend(key);
    } else {
      this.log.warn('RESEND_API_KEY not set — emails will be logged only');
    }
  }

  private async send(to: string, subject: string, html: string, text: string) {
    if (!this.resend) {
      this.log.log(`[dev-email] to=${to} subject=${subject}\n${text}`);
      return { ok: true, dev: true };
    }
    try {
      const res = await this.resend.emails.send({
        from: this.from,
        to,
        subject,
        html,
        text,
      });
      this.log.log(`Email sent to ${to}: ${res.data?.id}`);
      return { ok: true, id: res.data?.id };
    } catch (e) {
      this.log.error(`Email failed to ${to}: ${(e as Error).message}`);
      return { ok: false, error: (e as Error).message };
    }
  }

  async sendVerification(to: string, username: string, verifyUrl: string) {
    const subject = 'Research Casino — подтвердите email';
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #0a0a0f; padding: 32px; color: #e5e7eb;">
  <div style="max-width: 480px; margin: 0 auto; background: #12121a; border: 1px solid #22222e; border-radius: 16px; padding: 32px;">
    <div style="font-size: 24px; font-weight: 800; background: linear-gradient(90deg, #a855f7, #22d3ee); -webkit-background-clip: text; background-clip: text; color: transparent; margin-bottom: 8px;">
      Research Casino
    </div>
    <div style="font-size: 11px; color: #7a7a86; margin-bottom: 24px;">
      Research prototype. Virtual currency only. No real-money gambling.
    </div>

    <h1 style="font-size: 20px; margin: 0 0 12px 0;">Привет, ${username}!</h1>
    <p style="color: #b0b0b8; line-height: 1.5; margin: 0 0 24px 0;">
      Подтверди свой email — это займёт 5 секунд.
    </p>

    <a href="${verifyUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(90deg, #a855f7, #22d3ee); color: #000; font-weight: 800; text-decoration: none; border-radius: 10px;">
      Подтвердить email
    </a>

    <p style="color: #7a7a86; font-size: 12px; margin-top: 32px; line-height: 1.5;">
      Ссылка действует 24 часа.
    </p>

    <hr style="border: none; border-top: 1px solid #22222e; margin: 24px 0;">
    <div style="font-size: 11px; color: #5a5a66;">
      Если кнопка не работает — скопируй ссылку:<br>
      <span style="color: #22d3ee; word-break: break-all;">${verifyUrl}</span>
    </div>
  </div>
</body>
</html>`;

    const text = `Привет, ${username}!\n\nПодтверди email для Research Casino:\n\n${verifyUrl}\n\nСсылка действует 24 часа.`;

    return this.send(to, subject, html, text);
  }
}
