import { NextResponse } from "next/server";
import { z } from "zod";
import { PICKUP_ORIGIN } from "@/lib/constants";
import {
  findPriceForDistance,
  getDrivingDistanceKm,
} from "@/lib/orders/server";

const bodySchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "קואורדינטות חסרות" }, { status: 400 });
    }

    const distanceKm = await getDrivingDistanceKm(PICKUP_ORIGIN, parsed.data);

    if (distanceKm == null) {
      return NextResponse.json({
        distance_km: null,
        price: null,
        manual: true,
      });
    }

    const price = await findPriceForDistance(distanceKm);

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
