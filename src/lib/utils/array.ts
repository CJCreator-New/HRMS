/**
 * Normalizes a Supabase query result into a consistent array.
 *
 * Supabase queries can return:
 *  - An array (normal case)
 *  - A single object (when `.single()` is used)
 *  - null/undefined (when no rows match)
 *
 * This helper ensures callers always get `T[]` without repetitive
 * `Array.isArray() ? ... : ...` defensive casting.
 */
export function toArray<T>(result: T | T[] | null | undefined): T[] {
  if (result == null) return [];
  if (Array.isArray(result)) return result;
  return [result];
}
