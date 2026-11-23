export type Signatory = { name: string; signedAt: string };
export const signatoryPageSize = 50;

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

export type SignatoryRoster = ReturnType<typeof signatoryPage> & {
  total: number;
  anonymousCount: number;
};

// Fill the last named page, then page through unnamed signatures using only their count.
export function anonymousRowsOnPage(roster: SignatoryRoster, page: number) {
  if (roster.next) return { count: 0, hasMore: false };
  const firstCapacity = Math.max(
    0,
    signatoryPageSize - roster.signatories.length,
  );
  const offset =
    page === 0 ? 0 : firstCapacity + (page - 1) * signatoryPageSize;
  const remaining = Math.max(0, roster.anonymousCount - offset);
  const count = Math.min(
    remaining,
    page === 0 ? firstCapacity : signatoryPageSize,
  );
  return { count, hasMore: count < remaining };
}
