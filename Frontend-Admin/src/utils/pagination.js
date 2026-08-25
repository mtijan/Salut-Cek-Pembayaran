export function clampPage(page, totalPages) {
  const normalizedTotal = Math.max(1, Number(totalPages) || 1);
  const normalizedPage = Math.max(1, Number(page) || 1);
  return Math.min(normalizedPage, normalizedTotal);
}
