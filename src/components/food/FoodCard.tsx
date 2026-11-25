import { useState } from 'react';
import { Clock, MapPin, Plus, Utensils } from 'lucide-react';
import { formatPickupWindow, formatRM, getListingStatusLabel } from '../../lib/replateRules';
import type { EnrichedFoodListing } from '../../types/replate';

interface FoodCardProps {
  listing: EnrichedFoodListing;
  onViewDetails: (id: string) => void;
  onAddToCart: (listing: EnrichedFoodListing) => void;
  disableAdd?: boolean;
}

export function FoodCard({ listing, onViewDetails, onAddToCart, disableAdd = false }: FoodCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const isAvailable = listing.effective_status === 'published' && listing.quantity_available > 0;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-[#E5EBE3] bg-white transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-sm">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#EEF3EC]">
        {!imgFailed && listing.image_url ? (
          <img
            src={listing.image_url}
            alt={listing.food_name}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-[#EEF3EC] px-4 text-center text-[#166534]">
            <Utensils className="h-8 w-8 opacity-60" />
            <span className="mt-2 text-xs font-medium text-gray-600">{listing.food_name}</span>
          </div>
        )}
        {!isAvailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45">
            <span className="rounded-md bg-white px-3 py-1 text-xs font-semibold text-[#1F2937]">
              {getListingStatusLabel(listing.effective_status)}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium text-gray-500 truncate">
          {listing.category_name}
          <span aria-hidden="true"> · </span>
          {listing.vendor_name}
        </p>

        <h3 className="mt-1.5 text-base font-semibold text-[#1F2937] line-clamp-1">
          {listing.food_name}
        </h3>

        <div className="mt-2 flex items-baseline gap-2.5 tabular-nums">
          <span className="text-lg font-bold text-[#166534]">
            {formatRM(listing.discounted_price)}
          </span>
          <span className="text-sm text-gray-400 line-through">
            {formatRM(listing.original_price)}
          </span>
          <span className="text-xs font-semibold text-[#166534] bg-[#FACC15]/35 px-1.5 py-0.5 rounded">
            -{listing.discount_percentage}%
          </span>
        </div>

        <div className="mt-3 space-y-1 text-xs text-gray-600">
          <div className="flex items-center gap-1.5 truncate">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <span className="truncate">{listing.vendor_location}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 truncate">
              <Clock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <span className="truncate">
                {formatPickupWindow(listing.pickup_start_at, listing.pickup_end_at)}
              </span>
            </span>
            <span className="shrink-0 font-medium text-[#1F2937] tabular-nums">
              {listing.quantity_available} left
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 pt-3 border-t border-[#F0F4EE]">
          <button
            type="button"
            onClick={() => onViewDetails(listing.id)}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-[#1F2937] hover:bg-gray-50 transition-colors whitespace-nowrap shrink-0"
          >
            View Details
          </button>
          <button
            type="button"
            disabled={!isAvailable || disableAdd}
            onClick={() => onAddToCart(listing)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#166534] px-3 py-2 text-xs font-semibold text-white hover:bg-[#14532D] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            {isAvailable ? 'Add to Cart' : getListingStatusLabel(listing.effective_status)}
          </button>
        </div>
      </div>
    </article>
  );
}
