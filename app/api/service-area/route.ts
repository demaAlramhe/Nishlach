import { NextResponse } from "next/server";
import { z } from "zod";
import { isActiveServiceArea } from "@/lib/orders/server";

const bodySchema = z.object({
  city_name: z.string().trim().min(1),
  city_candidates: z
    .array(
      z.union([
        z.string().trim().min(1),
        z.object({
          name: z.string().trim().min(1),
          source: z.string().trim().min(1),
        }),
      ])
    )
    .optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "עיר חסרה" }, { status: 400 });
    }

    const { available, matchedCity } = await isActiveServiceArea(
      parsed.data.city_name,
      (parsed.data.city_candidates ?? []) as Array<
        string | { name: string; source: string }
      >
    );

    return NextResponse.json({
      available,
      city_name: parsed.data.city_name,
      matched_city: matchedCity,
    });
  } catch (error) {
    console.error("POST /api/service-area", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
