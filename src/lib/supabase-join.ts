/**
 * Les selects avec relation Supabase peuvent être typés comme T ou T[] selon le client.
 * Pour une relation many-to-one, on veut toujours un seul objet (ou null).
 */
export function normalizeRelationOne<T extends object>(
  value: T | T[] | null | undefined,
): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
