/** strings.json lookup with {name} placeholders. A missing key shows as [key] and warns once. */
export function createStrings(
  table: Readonly<Record<string, string>>,
  warn: (key: string, msg: string) => void = () => {},
): (key: string, params?: Record<string, string | number>) => string {
  return (key, params) => {
    const s = table[key];
    if (s === undefined) {
      warn(`string:${key}`, `Missing string "${key}".`);
      return `[${key}]`;
    }
    if (!params) return s;
    return s.replace(/\{([a-zA-Z0-9_]+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
  };
}
