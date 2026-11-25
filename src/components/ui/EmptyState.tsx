import type { ReactNode } from 'react';
import { Utensils } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-[#E5EBE3] bg-white px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#F0F5EE] text-[#166534]">
        {icon ?? <Utensils className="h-5 w-5" />}
      </div>
      <h3 className="mt-4 text-base font-semibold text-[#1F2937]">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-gray-600">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 rounded-lg bg-[#166534] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14532D] transition-colors whitespace-nowrap shrink-0"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
