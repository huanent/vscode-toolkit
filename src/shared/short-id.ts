export const shortIdLength = 8;

/** Only abbreviates an ID when its prefix uniquely identifies it in the supplied scope. */
export function getShortId(id: string, ids: Iterable<string>): string {
  const prefix = id.slice(0, shortIdLength);
  let found = false;
  for (const candidate of ids) {
    if (candidate === id) found = true;
    else if (candidate.startsWith(prefix)) return id;
  }
  return found ? prefix : id;
}

/** Exact IDs take precedence; callers decide how to report missing or ambiguous prefixes. */
export function findIdMatches<T>(
  entries: readonly T[],
  id: string,
  getId: (entry: T) => string,
  prefixLength?: number,
): T[] {
  const exact = entries.find((entry) => getId(entry) === id);
  if (exact) return [exact];
  if (!id || (prefixLength !== undefined && id.length !== prefixLength)) return [];
  return entries.filter((entry) => getId(entry).startsWith(id));
}
