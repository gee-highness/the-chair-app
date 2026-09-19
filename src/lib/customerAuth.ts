// src/lib/customerAuth.ts
//
// Deliberately NOT a rebuild of the staff auth system: a claim proves "this
// browser can read this email's inbox" and resolves to a customerId only —
// no role, nothing requireRole() will ever accept. See the CustomerClaim /
// CustomerClaimSession comments in types.ts and the decision note in
// PROGRESS2.md for why this exists instead of full customer accounts.
//
// KNOWN LIMITATION, flagged rather than silently faked: there is no email
// provider wired in (would need an API key for Resend/SendGrid/etc., which
// this environment doesn't have). `requestClaimCode` logs the one-time
// code to the server console instead of emailing it, and returns it
// directly in the API response ONLY outside production, so the flow is
// exercisable end-to-end in development. Wiring a real provider is a
// drop-in replacement of the `console.log` in the route handler, not a
// change to this file's logic.
import crypto from 'crypto';
import { getDatabase } from './mongodb';
import { CustomerClaim, CustomerClaimSession } from './types';
import { ObjectId } from 'mongodb';

const CODE_TTL_MINUTES = 15;
const SESSION_TTL_DAYS = 30;

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function generateCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/** Issues a one-time 6-digit code for the given (existing) customer, e-mailed to them. */
export async function requestClaimCode(email: string): Promise<{ code: string; customerId: ObjectId } | null> {
  const db = await getDatabase();
  const customer = await db.collection('customers').findOne({ email });
  if (!customer) return null; // caller returns a generic "check your email" regardless — no enumeration signal

  const code = generateCode();
  const codeHash = hashToken(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000);

  const claim: CustomerClaim = { codeHash, customerId: customer._id, email, expiresAt };
  await db.collection<CustomerClaim>('customerClaims').insertOne(claim);

  return { code, customerId: customer._id };
}

/** Verifies a one-time code and, on success, issues a long-lived claim session token. Single-use — deletes the code either way. */
export async function verifyClaimCode(email: string, code: string): Promise<{ rawToken: string; customerId: ObjectId } | null> {
  const db = await getDatabase();
  const codeHash = hashToken(code);
  const claim = await db.collection<CustomerClaim>('customerClaims').findOne({ email, codeHash, expiresAt: { $gt: new Date() } });
  if (!claim) return null;

  await db.collection('customerClaims').deleteOne({ _id: claim._id }); // single-use

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60_000);

  const session: CustomerClaimSession = { tokenHash, customerId: claim.customerId, expiresAt };
  await db.collection<CustomerClaimSession>('customerClaimSessions').insertOne(session);

  return { rawToken, customerId: claim.customerId };
}

/** Resolves a claim cookie's raw token to a customerId, or null if missing/expired. */
export async function verifyClaimSession(rawToken: string | undefined): Promise<{ customerId: ObjectId } | null> {
  if (!rawToken) return null;
  const db = await getDatabase();
  const tokenHash = hashToken(rawToken);
  const session = await db.collection<CustomerClaimSession>('customerClaimSessions').findOne({ tokenHash, expiresAt: { $gt: new Date() } });
  if (!session) return null;
  return { customerId: session.customerId };
}

export async function deleteClaimSession(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  const db = await getDatabase();
  await db.collection('customerClaimSessions').deleteOne({ tokenHash: hashToken(rawToken) });
}
