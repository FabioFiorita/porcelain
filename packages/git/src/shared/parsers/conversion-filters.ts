const FILTER_OPERATIONS = ['clean', 'smudge', 'process'] as const;
const FILTER_KEY = /^filter\.(.+)\.(?:clean|smudge|process)$/u;
const ATTRIBUTE_RECORD = /([^\0]*)\0[^\0]*\0([^\0]*)\0/gu;

type ConfigEntry = { key: string; value: string };

export function parseConfigList(output: string): ConfigEntry[] {
  return output
    .split('\0')
    .filter(Boolean)
    .map((record) => {
      const separator = record.indexOf('\n');
      return separator === -1
        ? { key: record, value: '' }
        : {
            key: record.slice(0, separator),
            value: record.slice(separator + 1),
          };
    });
}

export function filterDrivers(config: string): Map<string, string> {
  const drivers = new Map<string, string>();
  for (const { key, value } of parseConfigList(config)) {
    const driver = FILTER_KEY.exec(key)?.[1];
    if (driver !== undefined && value !== '' && !drivers.has(driver))
      drivers.set(driver, key);
  }
  return drivers;
}

export function parseFilterAttributes(
  output: string,
): { path: string; filter: string }[] {
  return [...output.matchAll(ATTRIBUTE_RECORD)].map(
    ([, path = '', filter = '']) => ({ path, filter }),
  );
}

export function disabledFilterConfig(drivers: Iterable<string>): string[] {
  return [...new Set(drivers)].flatMap((driver) =>
    FILTER_OPERATIONS.map((operation) => `filter.${driver}.${operation}=`),
  );
}
