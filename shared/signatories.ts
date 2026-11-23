export type Signatory = { name: string; signedAt: string };
export const signatoryPageSize = 25;

export function signatoryPage(rows: Signatory[], before?: string) {
  const ordered = rows
    .filter((row) => !before || row.signedAt < before)
    .sort(
      (a, b) =>
        b.signedAt.localeCompare(a.signedAt) || a.name.localeCompare(b.name),
    );
  // Keep simultaneous signatures together so the public timestamp alone is a safe cursor.
  const boundary = ordered[signatoryPageSize - 1]?.signedAt;
  const page = boundary
    ? ordered.filter((row) => row.signedAt >= boundary)
    : ordered;
  return {
    signatories: page.map(({ name, signedAt }) => ({ name, signedAt })),
    next: boundary && page.length < ordered.length ? boundary : null,
  };
}
