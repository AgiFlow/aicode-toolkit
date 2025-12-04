/**
 * Generate a stable, random ID string
 *
 * @param length - Length of the ID to generate (default: 8)
 * @returns A random alphanumeric ID string (lowercase)
 *
 * @remarks
 * Negative or non-integer lengths are normalized (floored and clamped to 0).
 * Returns empty string for length <= 0.
 *
 * @example
 * ```typescript
 * const id = generateStableId(6); // Returns something like "a3f9k2"
 * ```
 */
export function generateStableId(length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  // Handle edge cases: negative or non-integer lengths
  const normalizedLength = Math.max(0, Math.floor(length));

  if (normalizedLength === 0) {
    return '';
  }

  // Use crypto for better randomness
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const values = new Uint8Array(normalizedLength);
    crypto.getRandomValues(values);

    for (let i = 0; i < normalizedLength; i++) {
      result += chars[values[i] % chars.length];
    }
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < normalizedLength; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }

  return result;
}
