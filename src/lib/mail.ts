import { AppError } from './errors';

const ENDPOINT = 'https://api.resend.com/emails';
const TIMEOUT_MS = 10_000;

/**
 * Resend's sandbox sender. It only delivers to the address that owns the API
 * key, which is enough to try the flow but not to run a group on — point
 * RESEND_FROM at an address on a domain you have verified with Resend.
 */
const DEFAULT_FROM = 'Minimarket <onboarding@resend.dev>';

export interface Message {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** False when no API key is set, which is the normal state in local development. */
export function mailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/**
 * Hands one message to Resend. Their REST API is a single POST, so this talks
 * to it directly rather than pulling in the SDK for one call.
 */
export async function sendEmail(message: Message): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new AppError('Email delivery is not configured on this installation.');

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || DEFAULT_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch (error) {
    // A timeout or DNS failure is an outage, not something the sender did wrong.
    console.error('[mail] Resend request failed:', error);
    throw new AppError('Could not reach the email service. Try again in a moment.');
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error(`[mail] Resend returned ${response.status}:`, detail);
    throw new AppError('The email service rejected that message. Try again in a moment.');
  }
}

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The sign-in email. Plain text first — plenty of school mail clients strip HTML. */
export function signInMessage(to: string, url: string, minutes: number): Message {
  const safeUrl = escape(url);
  const text = [
    'Here is your Minimarket sign-in link:',
    '',
    url,
    '',
    `It works once and expires in ${minutes} minutes.`,
    'If you did not ask to sign in, you can ignore this email — nothing has changed.',
  ].join('\n');

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#141312;padding:32px;color:#EDE8DE">
  <div style="max-width:460px;margin:0 auto;background:#1A1815;border:1px solid #2A2724;border-radius:16px;padding:28px">
    <div style="font-size:20px;font-weight:600;letter-spacing:-0.02em;margin-bottom:10px">Sign in to Minimarket</div>
    <div style="font-size:14px;line-height:1.55;color:#B5AEA3;margin-bottom:22px">
      Tap the button below and you are in. No password needed.
    </div>
    <a href="${safeUrl}"
       style="display:block;text-align:center;background:#C8A24C;color:#141312;font-size:15px;font-weight:600;
              padding:13px 20px;border-radius:10px;text-decoration:none">Sign in</a>
    <div style="font-size:12px;line-height:1.6;color:#7C746A;margin-top:22px">
      This link works once and expires in ${minutes} minutes.
      If you did not ask to sign in, ignore this email — nothing has changed.
    </div>
    <div style="font-size:11px;color:#5C554D;margin-top:16px;word-break:break-all">${safeUrl}</div>
  </div>
</div>`.trim();

  return { to, subject: 'Your Minimarket sign-in link', text, html };
}
