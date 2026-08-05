"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import {
  AddressAutocomplete,
  type SelectedAddress,
} from "@/components/order/address-autocomplete";
import { ProofUpload } from "@/components/order/proof-upload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  orderFormSchema,
  type OrderFormValues,
} from "@/lib/validations/order";
import { cn } from "@/lib/utils";

type PricingState = {
  distance_km: number | null;
  price: number | null;
  manual: boolean;
};

export function OrderForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(
    null
  );
  const [checkingService, setCheckingService] = useState(false);
  const [pricing, setPricing] = useState<PricingState | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      customer_name: "",
      customer_phone: "",
      pickup_location: "",
      tracking_number: "",
      proof_image_url: "",
      dropoff_address: "",
      dropoff_city: "",
      house_number: "",
      entrance_number: "",
      entry_code: "",
      note: "",
      dropoff_lat: undefined,
      dropoff_lng: undefined,
      distance_km: null,
      price: null,
    },
    mode: "onBlur",
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const dropoffAddress = watch("dropoff_address");
  const pickupLocation = watch("pickup_location");
  const dropoffLat = watch("dropoff_lat");
  const dropoffLng = watch("dropoff_lng");
  const addressSelected =
    Boolean(dropoffLat) && Boolean(dropoffLng) && Boolean(dropoffAddress);
  const formLocked = serviceAvailable === false;

  const checkServiceArea = async (city: string) => {
    setCheckingService(true);
    setServiceAvailable(null);
    try {
      const res = await fetch("/api/service-area", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city_name: city }),
      });
      const data = (await res.json()) as { available?: boolean };
      const available = Boolean(data.available);
      setServiceAvailable(available);
      if (!available) {
        setPricing(null);
        setValue("distance_km", null);
        setValue("price", null);
      }
      return available;
    } catch {
      setServiceAvailable(false);
      return false;
    } finally {
      setCheckingService(false);
    }
  };

  const onAddressSelected = async (selected: SelectedAddress | null) => {
    if (!selected) {
      setSelectedCity(null);
      setServiceAvailable(null);
      setPricing(null);
      setValue("dropoff_city", "");
      setValue("dropoff_lat", undefined as unknown as number);
      setValue("dropoff_lng", undefined as unknown as number);
      setValue("distance_km", null);
      setValue("price", null);
      return;
    }

    setSelectedCity(selected.city);
    setValue("dropoff_address", selected.address, { shouldValidate: true });
    setValue("dropoff_city", selected.city, { shouldValidate: true });
    setValue("dropoff_lat", selected.lat, { shouldValidate: true });
    setValue("dropoff_lng", selected.lng, { shouldValidate: true });

    await checkServiceArea(selected.city);
  };

  useEffect(() => {
    if (
      serviceAvailable !== true ||
      dropoffLat == null ||
      dropoffLng == null ||
      !pickupLocation?.trim()
    ) {
      return;
    }

    let cancelled = false;
    const run = async () => {
      setPricingLoading(true);
      try {
        const res = await fetch("/api/pricing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: dropoffLat, lng: dropoffLng }),
        });
        const data = (await res.json()) as PricingState & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setPricing({ distance_km: null, price: null, manual: true });
          setValue("distance_km", null);
          setValue("price", null);
          return;
        }
        setPricing({
          distance_km: data.distance_km,
          price: data.price,
          manual: data.manual,
        });
        setValue("distance_km", data.distance_km);
        setValue("price", data.price);
      } catch {
        if (!cancelled) {
          setPricing({ distance_km: null, price: null, manual: true });
        }
      } finally {
        if (!cancelled) setPricingLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [serviceAvailable, dropoffLat, dropoffLng, pickupLocation, setValue]);

  const onSubmit = (values: OrderFormValues) => {
    setSubmitError(null);

    if (serviceAvailable !== true) {
      setSubmitError(
        selectedCity
          ? `מצטערים, השירות עדיין לא זמין ב${selectedCity} כרגע. אנחנו כרגע פועלים באזור תל אביב-יפו.`
          : "נא לבחור כתובת באזור השירות."
      );
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...values,
            service_area_ok: true,
          }),
        });
        const data = (await res.json()) as {
          order_number?: string;
          error?: string;
        };

        if (!res.ok || !data.order_number) {
          setSubmitError(data.error || "שגיאה בשליחת ההזמנה.");
          if (data.error?.includes("לא זמין")) {
            setServiceAvailable(false);
          }
          return;
        }

        router.push(`/order/${data.order_number}`);
      } catch {
        setSubmitError("שגיאת רשת. בדקו את החיבור ונסו שוב.");
      }
    });
  };

  const fieldClass = "h-12 text-base";
  const labelClass = "text-base text-brand-dark";

  return (
    <Card className="w-full border-0 bg-white shadow-sm ring-1 ring-black/5">
      <CardHeader className="gap-1.5 pb-2">
        <CardTitle className="text-xl font-bold text-brand-dark sm:text-2xl">
          הזמנת משלוח
        </CardTitle>
        <CardDescription className="text-base text-brand-muted">
          מלאו את הפרטים ונחזור אליכם בהקדם לתיאום האיסוף והתשלום.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-5"
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="customer_name" className={labelClass}>
              שם מלא <span className="text-brand-error">*</span>
            </Label>
            <Input
              id="customer_name"
              className={fieldClass}
              autoComplete="name"
              aria-invalid={Boolean(errors.customer_name)}
              {...register("customer_name")}
            />
            {errors.customer_name && (
              <p className="text-sm text-brand-error">
                {errors.customer_name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_phone" className={labelClass}>
              טלפון <span className="text-brand-error">*</span>
            </Label>
            <Input
              id="customer_phone"
              type="tel"
              inputMode="numeric"
              placeholder="05XXXXXXXX"
              className={fieldClass}
              autoComplete="tel"
              aria-invalid={Boolean(errors.customer_phone)}
              {...register("customer_phone")}
            />
            {errors.customer_phone && (
              <p className="text-sm text-brand-error">
                {errors.customer_phone.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pickup_location" className={labelClass}>
              מאיפה לאסוף <span className="text-brand-error">*</span>
            </Label>
            <Input
              id="pickup_location"
              placeholder="סניף דואר / שם החנות"
              className={fieldClass}
              aria-invalid={Boolean(errors.pickup_location)}
              {...register("pickup_location")}
            />
            {errors.pickup_location && (
              <p className="text-sm text-brand-error">
                {errors.pickup_location.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tracking_number" className={labelClass}>
              מספר מעקב{" "}
              <span className="font-normal text-brand-muted">(אופציונלי)</span>
            </Label>
            <Input
              id="tracking_number"
              className={fieldClass}
              {...register("tracking_number")}
            />
          </div>

          <ProofUpload
            value={watch("proof_image_url") || ""}
            onChange={(url) =>
              setValue("proof_image_url", url, { shouldValidate: true })
            }
          />

          <AddressAutocomplete
            value={dropoffAddress || ""}
            onChange={(v) => setValue("dropoff_address", v)}
            onAddressSelected={onAddressSelected}
            serviceAvailable={serviceAvailable}
            checkingService={checkingService}
            cityName={selectedCity}
            error={
              errors.dropoff_address?.message ||
              errors.dropoff_city?.message ||
              errors.dropoff_lat?.message
            }
          />

          {addressSelected && (
            <fieldset
              disabled={formLocked}
              className={cn(
                "flex flex-col gap-5",
                formLocked && "opacity-50"
              )}
            >
              <div className="space-y-2">
                <Label htmlFor="house_number" className={labelClass}>
                  מספר בית{" "}
                  <span className="font-normal text-brand-muted">
                    (אופציונלי)
                  </span>
                </Label>
                <Input
                  id="house_number"
                  className={fieldClass}
                  {...register("house_number")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="entrance_number" className={labelClass}>
                  מספר כניסה{" "}
                  <span className="font-normal text-brand-muted">
                    (אופציונלי)
                  </span>
                </Label>
                <Input
                  id="entrance_number"
                  className={fieldClass}
                  {...register("entrance_number")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="entry_code" className={labelClass}>
                  קוד כניסה{" "}
                  <span className="font-normal text-brand-muted">
                    (אופציונלי)
                  </span>
                </Label>
                <Input
                  id="entry_code"
                  className={fieldClass}
                  {...register("entry_code")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="note" className={labelClass}>
                  הערה{" "}
                  <span className="font-normal text-brand-muted">
                    (אופציונלי)
                  </span>
                </Label>
                <Textarea
                  id="note"
                  rows={3}
                  className="min-h-24 resize-y text-base"
                  {...register("note")}
                />
              </div>
            </fieldset>
          )}

          <div className="rounded-xl bg-brand-bgLight p-4 ring-1 ring-black/5">
            <p className="text-sm text-brand-muted">מחיר משוער</p>
            {pricingLoading ? (
              <p className="mt-1 flex items-center gap-2 text-lg font-bold text-brand-dark">
                <Loader2 className="size-4 animate-spin" />
                מחשבים מחיר...
              </p>
            ) : pricing?.price != null ? (
              <p className="mt-1 text-3xl font-bold tracking-tight text-brand-dark">
                ₪{pricing.price}
              </p>
            ) : serviceAvailable === true && pickupLocation?.trim() ? (
              <p className="mt-1 text-lg font-semibold text-brand-dark">
                מחיר: יחושב ידנית
              </p>
            ) : (
              <p className="mt-1 text-base text-brand-muted">
                בחרו כתובת ומלאו מאיפה לאסוף כדי לחשב מחיר
              </p>
            )}
            {pricing?.distance_km != null && (
              <p className="mt-1 text-sm text-brand-muted">
                מרחק משוער: {pricing.distance_km} ק״מ
              </p>
            )}
          </div>

          {submitError && (
            <Alert
              variant="destructive"
              className="border-brand-error/40 bg-brand-error/5"
            >
              <AlertDescription className="text-brand-error">
                {submitError}
              </AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={isPending || formLocked || checkingService}
            className="h-14 w-full bg-brand-yellow text-base font-bold text-brand-dark hover:bg-brand-yellowHover disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                שולחים הזמנה...
              </>
            ) : (
              "שליחת הזמנה"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
