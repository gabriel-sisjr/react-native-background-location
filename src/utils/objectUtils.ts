/**
 * Utility functions for object manipulation
 */

/**
 * Extracts all defined properties from a source object into a new object
 * Only includes properties that are not undefined
 * @param source - Source object to extract properties from
 * @returns Object containing all defined properties (both required and optional)
 */
export function extractDefinedProperties<T extends Record<string, any>>(
  source: T
): Partial<T> {
  const result: Partial<T> = {};

  for (const key in source) {
    if (
      Object.prototype.hasOwnProperty.call(source, key) &&
      source[key] !== undefined
    ) {
      result[key] = source[key];
    }
  }

  return result;
}
