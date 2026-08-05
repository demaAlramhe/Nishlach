export function courierAuthEmail(username: string): string {
  return `${username.trim().toLowerCase()}@nishlach.internal`;
}

export type CourierOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  pickup_location: string;
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
  phone: string;
  is_active: boolean;
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "ממתינה",
  claimed: "נלקחה",
  picked_up: "נאספה",
  delivered: "נמסרה",
};
