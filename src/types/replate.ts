export type UserRole = 'student' | 'vendor' | 'admin';
export type AccountStatus = 'pending' | 'active' | 'suspended';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type ListingStatus = 'draft' | 'published' | 'sold_out' | 'expired' | 'removed';
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'cancelled'
  | 'expired';
export type PaymentMethod = 'pay_at_pickup';
export type PaymentStatus = 'pending' | 'paid' | 'refunded';
export type VerificationMethod = 'code' | 'qr';

export interface Campus {
  id: string;
  campus_name: string;
  location: string;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  student_id: string | null;
  phone_number: string;
  role: UserRole;
  campus_id: string | null;
  account_status: AccountStatus;
  created_at: string;
  updated_at: string;
}

export interface Vendor {
  id: string;
  owner_id: string;
  campus_id: string | null;
  business_name: string;
  description: string;
  location: string;
  contact_phone: string;
  approval_status: ApprovalStatus;
  created_at: string;
  updated_at: string;
}

export interface FoodCategory {
  id: string;
  category_name: string;
  description: string;
  is_active: boolean;
  created_at: string;
}

export interface FoodListing {
  id: string;
  vendor_id: string;
  category_id: string;
  food_name: string;
  description: string;
  image_url: string;
  original_price: number;
  discounted_price: number;
  quantity_available: number;
  pickup_start_at: string;
  pickup_end_at: string;
  status: ListingStatus;
  created_at: string;
  updated_at: string;
}

export interface EnrichedFoodListing extends FoodListing {
  vendor_name: string;
  vendor_location: string;
  vendor_approval_status: ApprovalStatus;
  category_name: string;
  discount_percentage: number;
  effective_status: ListingStatus;
}

export interface Order {
  id: string;
  order_number: string;
  student_id: string;
  vendor_id: string;
  subtotal: number;
  total_amount: number;
  order_status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  pickup_deadline: string;
  created_at: string;
  updated_at: string;
  /** Plain code is returned only to the owning student when order is active. */
  pickup_code?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  food_listing_id: string;
  food_name_snapshot: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  created_at: string;
}

export interface PickupVerification {
  id: string;
  order_id: string;
  verified_by: string;
  verification_method: VerificationMethod;
  verified_at: string;
}

export interface Review {
  id: string;
  student_id: string;
  vendor_id: string;
  order_id: string;
  rating: number;
  comment: string;
  created_at: string;
  student_name?: string;
}

export interface EnrichedOrder extends Order {
  vendor_name: string;
  vendor_location: string;
  student_name: string;
  student_number: string | null;
  student_phone: string;
  items: OrderItem[];
  verification?: PickupVerification | null;
  review?: Review | null;
}

export interface SystemSettings {
  estimated_kg_per_meal: number;
  estimated_co2_per_kg: number;
  platform_contact_email: string;
  updated_at: string;
}

export interface CartItem {
  listingId: string;
  quantity: number;
}

export interface ImpactSummary {
  completedPickupsCount: number;
  totalMealsRescued: number;
  estimatedFoodSavedKg: number;
  estimatedCo2AvoidedKg: number;
  assumedKgPerMeal: number;
  assumedCo2PerKg: number;
}

export interface AuthSession {
  token: string;
  user: Profile;
  vendor: Vendor | null;
}
