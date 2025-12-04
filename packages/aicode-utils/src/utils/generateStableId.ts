/**
 * Generate a stable, random ID string
 *
 * @param length - Length of the ID to generate (default: 8)
 * @returns A random alphanumeric ID string (lowercase)
 *
 * @example
 * ```typescript
 * const id = generateStableId(6); // Returns something like "a3f9k2"
 * ```
 */
export function generateStableId(length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  // Use crypto for better randomness
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const values = new Uint8Array(length);
    crypto.getRandomValues(values);

    for (let i = 0; i < length; i++) {
      result += chars[values[i] % chars.length];
    }
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }

  return result;
}
