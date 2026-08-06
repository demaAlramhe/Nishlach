import { z } from "zod";

const israeliPhoneRegex = /^05\d{8}$/;

export const orderFormSchema = z.object({
  customer_name: z
    .string()
    .trim()
    .min(2, "נא להזין שם מלא"),
  customer_phone: z
    .string()
    .trim()
    .regex(israeliPhoneRegex, "נא להזין מספר נייד תקין (05XXXXXXXX)"),
  pickup_location: z
    .string()
    .trim()
    .min(3, "נא לבחור נקודת איסוף מהרשימה"),
  pickup_city: z.string().trim().min(1, "לא זוהתה עיר בנקודת האיסוף"),
  pickup_lat: z.number({ error: "נא לבחור נקודת איסוף מהרשימה" }),
  pickup_lng: z.number({ error: "נא לבחור נקודת איסוף מהרשימה" }),
  tracking_number: z.string().trim().optional().or(z.literal("")),
  proof_text: z.string().trim().optional().or(z.literal("")),
  dropoff_address: z
    .string()
    .trim()
    .min(3, "נא לבחור כתובת מהרשימה"),
  dropoff_city: z.string().trim().min(1, "לא זוהתה עיר בכתובת"),
  house_number: z.string().trim().min(1, "נא להזין מספר בית"),
  entrance_number: z.string().trim().optional().or(z.literal("")),
  entry_code: z.string().trim().optional().or(z.literal("")),
  note: z.string().trim().optional().or(z.literal("")),
  dropoff_lat: z.number({ error: "נא לבחור כתובת תקינה" }),
  dropoff_lng: z.number({ error: "נא לבחור כתובת תקינה" }),
  distance_km: z.number().nullable().optional(),
  price: z.number().nullable().optional(),
});

export type OrderFormValues = z.infer<typeof orderFormSchema>;

export const createOrderSchema = orderFormSchema.extend({
  service_area_ok: z.literal(true, {
    error: "השירות אינו זמין באזור שנבחר",
  }),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
