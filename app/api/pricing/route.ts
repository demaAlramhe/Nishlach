import { NextResponse } from "next/server";
import { z } from "zod";
import {
  findPriceForDistance,
  getDrivingDistanceKm,
} from "@/lib/orders/server";

const bodySchema = z.object({
  origin_lat: z.number(),
  origin_lng: z.number(),
  dest_lat: z.number(),
  dest_lng: z.number(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    console.log("[pricing] POST /api/pricing body:", json);

    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      console.warn("[pricing] invalid body:", parsed.error.flatten());
      return NextResponse.json({ error: "קואורדינטות חסרות" }, { status: 400 });
    }

    const { origin_lat, origin_lng, dest_lat, dest_lng } = parsed.data;
    console.log("[pricing] received coords:", {
      origin_lat,
      origin_lng,
      dest_lat,
      dest_lng,
    });

    const distanceKm = await getDrivingDistanceKm(
      { lat: origin_lat, lng: origin_lng },
      { lat: dest_lat, lng: dest_lng }
    );

    console.log("[pricing] distance_km after Distance Matrix:", distanceKm);

    if (distanceKm == null) {
      console.warn(
        "[pricing] returning manual quote — distance_km is null/undefined"
      );
      return NextResponse.json({
        distance_km: null,
        price: null,
        manual: true,
      });
    }

    const price = await findPriceForDistance(distanceKm);
    console.log("[pricing] final price:", price, "manual:", price == null);

    return NextResponse.json({
      distance_km: distanceKm,
      price,
      manual: price == null,
    });
  } catch (error) {
    console.error("POST /api/pricing", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
