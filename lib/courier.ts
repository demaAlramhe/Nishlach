export function courierAuthEmail(username: string): string {
  return `${username.trim().toLowerCase()}@nishlach.internal`;
}

export type CourierOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  pickup_location: string;
  tracking_number: string | null;
  proof_text: string | null;
  dropoff_address: string;
  dropoff_city: string;
  house_number: string | null;
  entrance_number: string | null;
  entry_code: string | null;
  note: string | null;
  distance_km: number | string | null;
  price: number | string | null;
  status: string;
  courier_id: string | null;
  created_at: string;
  claimed_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
};

export type CourierProfile = {
  id: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  is_admin?: boolean;
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "ממתינה",
  claimed: "נתפסה, טרם נאספה",
  picked_up: "נאספה",
  delivered: "נמסרה",
};

/** Pill styles aligned with customer order status tracker */
export const ORDER_STATUS_BADGE_CLASS: Record<string, string> = {
  pending: "bg-neutral-100 text-brand-muted ring-neutral-200",
  claimed: "bg-brand-yellow/20 text-brand-dark ring-brand-yellow/40",
  picked_up: "bg-blue-50 text-blue-700 ring-blue-200",
  delivered: "bg-brand-success/10 text-brand-success ring-brand-success/30",
};
