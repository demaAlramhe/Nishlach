import { NextResponse } from "next/server";
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

    const pickupArea = await isActiveServiceArea(
      input.pickup_city,
      Array.isArray(body.pickup_city_candidates)
        ? body.pickup_city_candidates
        : []
    );
    if (!pickupArea.available) {
      return NextResponse.json(
        {
          error: `מצטערים, השירות עדיין לא זמין ב${input.pickup_city} כרגע. אנחנו כרגע פועלים באזור תל אביב-יפו.`,
          code: "OUT_OF_SERVICE_AREA",
          field: "pickup",
        },
        { status: 422 }
      );
    }

    const dropoffArea = await isActiveServiceArea(
      input.dropoff_city,
      Array.isArray(body.city_candidates) ? body.city_candidates : []
    );
    if (!dropoffArea.available) {
      return NextResponse.json(
        {
          error: `מצטערים, השירות עדיין לא זמין ב${input.dropoff_city} כרגע. אנחנו כרגע פועלים באזור תל אביב-יפו.`,
          code: "OUT_OF_SERVICE_AREA",
          field: "dropoff",
        },
        { status: 422 }
      );
    }

    const dropoffCity = dropoffArea.matchedCity ?? input.dropoff_city;

    console.log("[orders] pricing coords:", {
      origin_lat: input.pickup_lat,
      origin_lng: input.pickup_lng,
      dest_lat: input.dropoff_lat,
      dest_lng: input.dropoff_lng,
    });

    const distanceKm =
      (await getDrivingDistanceKm(
        { lat: input.pickup_lat, lng: input.pickup_lng },
        { lat: input.dropoff_lat, lng: input.dropoff_lng }
      )) ??
      input.distance_km ??
      null;

    console.log("[orders] distance_km:", distanceKm);

    const price =
      distanceKm != null
        ? await findPriceForDistance(distanceKm)
        : input.price ?? null;

    console.log("[orders] price:", price);

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
        pickup_lat: input.pickup_lat,
        pickup_lng: input.pickup_lng,
        tracking_number: emptyToNull(input.tracking_number),
        proof_text: emptyToNull(input.proof_text),
        dropoff_address: input.dropoff_address,
        dropoff_city: dropoffCity,
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
