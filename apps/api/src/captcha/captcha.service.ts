import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CaptchaService {
  private log = new Logger('Captcha');
  private secret = process.env.TURNSTILE_SECRET ?? '';

  /** Returns true if captcha valid OR if Turnstile is not configured (dev mode). */
  async verify(token: string | undefined, ip?: string): Promise<boolean> {
    if (!this.secret) {
      // Turnstile not configured → allow (dev / staging)
      return true;
    }
    if (!token || token.length < 10) return false;

    try {
      const params = new URLSearchParams();
      params.append('secret', this.secret);
      params.append('response', token);
      if (ip) params.append('remoteip', ip);

      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: params,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const json: any = await res.json();
      return !!json.success;
    } catch (e) {
      this.log.warn(`Turnstile verify failed: ${(e as Error).message}`);
      return false;
    }
  }
}
