import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  total:    number;
  page:     number;
  perPage:  number;
  onChange: (page: number) => void;
}

export function Pagination({ total, page, perPage, onChange }: Props) {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return null;

  const from = (page - 1) * perPage + 1;
  const to   = Math.min(page * perPage, total);

  return (
    <div className="flex items-center justify-between py-2 px-1">
      <span className="text-xs text-gray-400">
        {from}–{to} de {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          type="button"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="text-xs font-semibold text-gray-700 px-1">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          type="button"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
