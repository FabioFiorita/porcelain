// Shared by the query layer and the API adapters, which cannot import each
// other, so the connected request deadline has a single definition.
export const REQUEST_TIMEOUT_MS = 15_000;
