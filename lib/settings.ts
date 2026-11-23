export function settingValue<T extends Record<string, unknown>>(
  value: unknown,
): T | undefined {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value))
    return value as T;
  return undefined;
}
