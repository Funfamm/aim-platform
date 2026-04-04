// src/lib/utils.ts
/**
 * Generate a deterministic anonymized email for a deleted user.
 * Keeps the original domain for auditability while ensuring the email
 * can never match a real user during re‑registration.
 */
export function generateDeletedEmail(userId: string, email: string): string {
  return `deleted_${userId}_${email}`;
}
