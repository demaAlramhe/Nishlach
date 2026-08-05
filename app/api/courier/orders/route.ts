import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ORDER_SELECT =
  "id, order_number, customer_name, customer_phone, pickup_location, dropoff_address, dropoff_city, house_number, entrance_number, entry_code, note, distance_km, price, status, courier_id, created_at, claimed_at, picked_up_at, delivered_at";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  console.log("[courier] authenticated user id:", user?.id ?? null);
  if (userError) {
    console.error("[courier] getUser error:", userError);
  }

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const {
    data: courier,
    error: courierError,
  } = await supabase
    .from("couriers")
    .select("id, full_name, phone, is_active, auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  console.log("[courier] courier record:", courier);
  console.log("[courier] courier query error:", courierError);

  const pendingRes = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  console.log("[courier] pending orders data:", pendingRes.data);
  console.log("[courier] pending orders error:", pendingRes.error);
  console.log(
    "[courier] pending orders count:",
    pendingRes.data?.length ?? null
  );

  let mineRes = {
    data: null as unknown,
    error: null as unknown,
  };

  if (courier?.id) {
    mineRes = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("courier_id", courier.id)
      .neq("status", "pending")
      .order("created_at", { ascending: false });

    console.log("[courier] my orders data:", mineRes.data);
    console.log("[courier] my orders error:", mineRes.error);
  }

  return NextResponse.json({
    user_id: user.id,
    courier,
    courier_error: courierError,
    pending: {
      data: pendingRes.data,
      error: pendingRes.error,
    },
    mine: {
      data: mineRes.data,
      error: mineRes.error,
    },
  });
}
