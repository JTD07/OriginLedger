export const EVIDENCE_PAGE_SIZE = 20;

export function evidencePageRange(
  page: number,
  pageSize: number = EVIDENCE_PAGE_SIZE,
): { page: number; from: number; to: number } {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const from = (safePage - 1) * pageSize;
  return { page: safePage, from, to: from + pageSize - 1 };
}
