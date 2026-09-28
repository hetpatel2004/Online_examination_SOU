import React from 'react';

const Pagination = ({
  currentPage = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemLabel = 'items'
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalItems === 0) return null;

  const startItem = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers with smart ellipsis
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }

      if (currentPage < totalPages - 2) pages.push('...');
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }
    return pages;
  };

  const handlePageClick = (p) => {
    if (p === '...' || p === currentPage || p < 1 || p > totalPages) return;
    if (onPageChange) onPageChange(p);
  };

  return (
    <div className="pagination-wrapper">
      <div className="pagination-info">
        <span className="pagination-count">
          Showing <strong>{startItem}</strong>–<strong>{endItem}</strong> of <strong>{totalItems}</strong> {itemLabel}
        </span>
        {onPageSizeChange && (
          <div className="pagination-size-selector">
            <label htmlFor="page-size-select">Per page:</label>
            <select
              id="page-size-select"
              className="pagination-select"
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                if (onPageChange) onPageChange(1);
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination-controls">
          <button
            type="button"
            className="pagination-btn pagination-nav"
            onClick={() => handlePageClick(1)}
            disabled={currentPage === 1}
            title="First Page"
          >
            «
          </button>
          <button
            type="button"
            className="pagination-btn pagination-nav"
            onClick={() => handlePageClick(currentPage - 1)}
            disabled={currentPage === 1}
            title="Previous Page"
          >
            ‹ Prev
          </button>

          <div className="pagination-pages">
            {getPageNumbers().map((p, idx) =>
              p === '...' ? (
                <span key={`dots-${idx}`} className="pagination-dots">
                  …
                </span>
              ) : (
                <button
                  type="button"
                  key={`page-${p}`}
                  className={`pagination-btn pagination-num ${currentPage === p ? 'active' : ''}`}
                  onClick={() => handlePageClick(p)}
                >
                  {p}
                </button>
              )
            )}
          </div>

          <button
            type="button"
            className="pagination-btn pagination-nav"
            onClick={() => handlePageClick(currentPage + 1)}
            disabled={currentPage === totalPages}
            title="Next Page"
          >
            Next ›
          </button>
          <button
            type="button"
            className="pagination-btn pagination-nav"
            onClick={() => handlePageClick(totalPages)}
            disabled={currentPage === totalPages}
            title="Last Page"
          >
            »
          </button>
        </div>
      )}
    </div>
  );
};

export default Pagination;
