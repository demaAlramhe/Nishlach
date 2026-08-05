import { NextResponse } from "next/server";
import { PICKUP_ORIGIN } from "@/lib/constants";
import { emptyToNull } from "@/lib/geo";
import {
  findPriceForDistance,
  getDrivingDistanceKm,
  isActiveServiceArea,
} from "@/lib/orders/server";
import { createClient } from "@/lib/supabase/server";
import { createOrderSchema } from "@/lib/validations/order";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "נתונים לא תקינים",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const input = parsed.data;

    const inServiceArea = await isActiveServiceArea(input.dropoff_city);
    if (!inServiceArea) {
      return NextResponse.json(
        {
          error: `מצטערים, השירות עדיין לא זמין ב${input.dropoff_city} כרגע. אנחנו כרגע פועלים באזור תל אביב-יפו.`,
          code: "OUT_OF_SERVICE_AREA",
        },
        { status: 422 }
      );
    }

    const distanceKm =
      (await getDrivingDistanceKm(PICKUP_ORIGIN, {
        lat: input.dropoff_lat,
        lng: input.dropoff_lng,
      })) ?? input.distance_km ?? null;

    const price =
      distanceKm != null
        ? await findPriceForDistance(distanceKm)
        : input.price ?? null;

    const supabase = await createClient();

    const { data: orderNumber, error: seqError } = await supabase.rpc(
      "next_order_number"
    );

    if (seqError || !orderNumber) {
      console.error("next_order_number failed", seqError);
      return NextResponse.json(
        { error: "לא הצלחנו ליצור מספר הזמנה. נסו שוב." },
        { status: 500 }
      );
    }

    const { data: order, error: insertError } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber as string,
        customer_name: input.customer_name,
        customer_phone: input.customer_phone,
        pickup_location: input.pickup_location,
        tracking_number: emptyToNull(input.tracking_number),
        proof_image_url: emptyToNull(input.proof_image_url),
        dropoff_address: input.dropoff_address,
        dropoff_city: input.dropoff_city,
        house_number: emptyToNull(input.house_number),
        entrance_number: emptyToNull(input.entrance_number),
        entry_code: emptyToNull(input.entry_code),
        note: emptyToNull(input.note),
        dropoff_lat: input.dropoff_lat,
        dropoff_lng: input.dropoff_lng,
        distance_km: distanceKm,
        price,
        status: "pending",
        payment_status: "unpaid",
      })
      .select("order_number")
      .single();

    if (insertError || !order) {
      console.error("order insert failed", insertError);
      return NextResponse.json(
        { error: "שגיאה ביצירת ההזמנה. נסו שוב." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      order_number: order.order_number,
      price,
      distance_km: distanceKm,
    });
  } catch (error) {
    console.error("POST /api/orders", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
