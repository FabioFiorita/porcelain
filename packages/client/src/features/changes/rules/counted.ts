export function plural(count: number, one: string, many = `${one}s`) {
  return count === 1 ? one : many;
}

export function counted(count: number, one: string, many = `${one}s`) {
  return `${count} ${plural(count, one, many)}`;
}
