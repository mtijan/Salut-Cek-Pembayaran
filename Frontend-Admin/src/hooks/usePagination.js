import { useEffect, useState } from 'react';
import { clampPage } from '../utils/pagination';

export function usePagination(totalPages, initialPage = 1) {
  const [page, setPage] = useState(initialPage);

  useEffect(() => {
    setPage((currentPage) => clampPage(currentPage, totalPages));
  }, [totalPages]);

  return { page, setPage };
}
