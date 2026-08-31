export function buildPaginationItems(
  page: number,
  totalPages: number,
): Array<number | 'ellipsis'> {
  if (totalPages < 1) return [];

  const visible = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => {
      if (totalPages <= 5) return true;
      if (p === 1 || p === totalPages) return true;
      if (Math.abs(p - page) <= 1) return true;
      return false;
    },
  );

  return visible.reduce<Array<number | 'ellipsis'>>((acc, p, i, arr) => {
    if (i > 0 && p - (arr[i - 1] ?? 0) > 1) acc.push('ellipsis');
    acc.push(p);
    return acc;
  }, []);
}
