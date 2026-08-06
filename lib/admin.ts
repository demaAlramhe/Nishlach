import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AdminCourier = {
  id: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  is_admin: boolean;
  auth_user_id: string | null;
  created_at: string;
};

export type PricingConfig = {
  id: string;
  base_price: number;
  free_km: number;
  price_per_km: number;
  updated_at: string;
};

/**
 * Require an authenticated active admin.
 * - No session → redirect to courier login
 * - Session but not admin → returns null (caller shows forbidden UI)
 */
export async function requireAdminSession(): Promise<{
  userId: string;
  courier: {
    id: string;
    full_name: string;
    is_admin: boolean;
    is_active: boolean;
  };
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/courier/login");
  }

  const { data: courier } = await supabase
    .from("couriers")
    .select("id, full_name, is_admin, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (
    !courier ||
    !courier.is_admin ||
    !courier.is_active
  ) {
    return null;
  }

  return { userId: user.id, courier };
}
