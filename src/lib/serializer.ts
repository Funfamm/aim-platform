// src/lib/serializer.ts
/** Convert Prisma objects that contain BigInt fields into JSON‑serializable plain objects. */
export function sanitizeBigInt<T extends Record<string, unknown>>(obj: T): T {
  const copy = { ...obj } as any;
  for (const key of Object.keys(copy)) {
    const value = copy[key];
    if (typeof value === 'bigint') {
      // Safe to cast to Number for IDs and sort orders in this app.
      copy[key] = Number(value);
    }
  }
  return copy;
}
