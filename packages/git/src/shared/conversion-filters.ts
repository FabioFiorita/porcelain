const FILTER_OPERATIONS = ['clean', 'smudge', 'process'] as const;
const FILTER_KEY = /^filter\.(.+)\.(?:clean|smudge|process)$/u;

export type ConfigEntry = { key: string; value: string };

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
  const fields = output.split('\0');
  const records: { path: string; filter: string }[] = [];
  for (let index = 0; index + 3 < fields.length; index += 3)
    records.push({
      path: fields[index] ?? '',
      filter: fields[index + 2] ?? '',
    });
  return records;
}

export function disabledFilterConfig(drivers: Iterable<string>): string[] {
  return [...new Set(drivers)].flatMap((driver) =>
    FILTER_OPERATIONS.map((operation) => `filter.${driver}.${operation}=`),
  );
}
