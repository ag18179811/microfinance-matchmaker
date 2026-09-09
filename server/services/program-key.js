// Stable identifier for a matched program, used as the tracker and
// underwriter-review key. Derived from the program name rather than a
// database row id, so it survives a re-search that assigns fresh
// discovered_lenders ids — a program the owner tracked or practiced a
// review with stays linked. Output is URL-safe ([a-z0-9-] only).
//
// The client keeps a byte-identical copy in client/src/pages/Results.jsx
// (lenderKeyOf) — the two must agree so a program tracked from a match
// card and one auto-tracked when its pack is built collapse to one row.

export function programKey(name) {
  return (
    String(name || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-+|-+$)/g, '')
      .slice(0, 80) || 'program'
  );
}
