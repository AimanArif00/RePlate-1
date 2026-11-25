import { CheckCircle2, Clock, PackageCheck, XCircle, AlertTriangle } from 'lucide-react';
import { getOrderStatusLabel } from '../../lib/replateRules';
import type { OrderStatus } from '../../types/replate';

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const label = getOrderStatusLabel(status);

  switch (status) {
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 whitespace-nowrap">
          <Clock className="h-3.5 w-3.5 text-amber-600" />
          {label}
        </span>
      );
    case 'confirmed':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-800 whitespace-nowrap">
          <CheckCircle2 className="h-3.5 w-3.5 text-sky-600" />
          {label}
        </span>
      );
    case 'ready_for_pickup':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#166534] whitespace-nowrap">
          <PackageCheck className="h-3.5 w-3.5 text-[#166534]" />
          {label}
        </span>
      );
    case 'picked_up':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#166534] whitespace-nowrap">
          <CheckCircle2 className="h-3.5 w-3.5 text-[#22C55E]" />
          {label}
        </span>
      );
    case 'cancelled':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 whitespace-nowrap">
          <XCircle className="h-3.5 w-3.5 text-gray-500" />
          {label}
        </span>
      );
    case 'expired':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 whitespace-nowrap">
          <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
          {label}
        </span>
      );
  }
}
