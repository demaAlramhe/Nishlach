import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ orderNumber: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orderNumber } = await context.params;
    if (!orderNumber?.trim()) {
      return NextResponse.json({ error: "חסר מספר הזמנה" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: order, error } = await supabase
      .from("orders")
      .select("order_number, status, delivered_at")
      .eq("order_number", orderNumber.trim())
      .maybeSingle();

    if (error) {
      console.error("GET /api/orders/[orderNumber]", error);
      return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
    }

    if (!order) {
      return NextResponse.json({ error: "הזמנה לא נמצאה" }, { status: 404 });
    }

    return NextResponse.json({
      order_number: order.order_number,
      status: order.status,
      delivered_at: order.delivered_at,
    });
  } catch (error) {
    console.error("GET /api/orders/[orderNumber]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
