import { createHmac } from 'node:crypto'
import { z } from 'zod'
import type { Config } from './config.js'

const singleLine = (min: number, max: number) => z.string().trim().min(min).max(max).refine(value => !/[\u0000-\u001f\u007f\u2028\u2029]/.test(value))
export const contactSchema = z.strictObject({
  name: singleLine(2, 100),
  email: z.email().trim().max(254),
  subject: singleLine(0, 160).default(''),
  message: z.string().trim().min(10).max(5000).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)),
  website: z.string().max(200).default(''),
  token: z.string().min(1).max(2048),
})
export type Contact = z.infer<typeof contactSchema>
export type Fetch = typeof fetch

export function privateKey(secret: string, scope: string, value: string) {
  return createHmac('sha256', secret).update(`${scope}\0${value}`).digest('hex')
}

export async function verifyChallenge(config: Config, token: string, ip: string, fetcher: Fetch) {
  const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: config.turnstileSecret, response: token, remoteip: ip }),
    signal: AbortSignal.timeout(8000),
    redirect: 'error',
  })
  if (!response.ok) throw new Error('verification_unavailable')
  const result = await response.json() as Record<string, unknown>
  return result.success === true && result.hostname === config.hostname && result.action === 'contact'
}

export async function sendContact(config: Config, input: Contact, fetcher: Fetch) {
  const payload = {
    from: config.from,
    to: [config.to],
    reply_to: input.email,
    subject: input.subject || `Portfolio message from ${input.name}`,
    text: `Name: ${input.name}\nEmail: ${input.email}\n\n${input.message}`,
  }
  const response = await fetcher('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendKey}`,
      'Content-Type': 'application/json',
      // Identical content uses the same key, including retries after an ambiguous timeout.
      'Idempotency-Key': `contact/${privateKey(config.rateLimitSecret, 'delivery', JSON.stringify(payload))}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
    redirect: 'error',
  })
  if (!response.ok) throw new Error('delivery_unavailable')
  const result = await response.json() as Record<string, unknown>
  if (typeof result.id !== 'string' || !result.id) throw new Error('delivery_unconfirmed')
}
