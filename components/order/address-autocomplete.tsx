"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Autocomplete,
  useJsApiLoader,
} from "@react-google-maps/api";
import { Loader2, MapPin } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { extractCityFromComponents } from "@/lib/geo";
import { cn } from "@/lib/utils";
import type { AddressComponent } from "@/types/google-places";

const libraries: ("places")[] = ["places"];

export type SelectedAddress = {
  address: string;
  city: string;
  lat: number;
  lng: number;
};

type AddressAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  onAddressSelected: (address: SelectedAddress | null) => void;
  serviceAvailable: boolean | null;
  checkingService: boolean;
  cityName?: string | null;
  disabled?: boolean;
  error?: string;
};

function readLatLng(location: google.maps.LatLng | google.maps.LatLngLiteral) {
  if (typeof (location as google.maps.LatLng).lat === "function") {
    const ll = location as google.maps.LatLng;
    return { lat: ll.lat(), lng: ll.lng() };
  }
  const literal = location as google.maps.LatLngLiteral;
  return { lat: literal.lat, lng: literal.lng };
}

export function AddressAutocomplete({
  value,
  onChange,
  onAddressSelected,
  serviceAvailable,
  checkingService,
  cityName,
  disabled,
  error,
}: AddressAutocompleteProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries,
    language: "he",
    region: "IL",
  });

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const applyPlace = useCallback(
    (place: {
      formatted_address?: string;
      address_components?: AddressComponent[];
      geometry?: { location?: google.maps.LatLng | google.maps.LatLngLiteral };
    }) => {
      const address = place.formatted_address;
      const location = place.geometry?.location;
      if (!address || !location) {
        onAddressSelected(null);
        return;
      }

      const { lat, lng } = readLatLng(location);
      const city = extractCityFromComponents(place.address_components);
      if (!city) {
        onAddressSelected(null);
        setGeoError("לא הצלחנו לזהות את העיר מהכתובת. נסו לבחור כתובת אחרת.");
        return;
      }

      setGeoError(null);
      onChange(address);
      onAddressSelected({ address, city, lat, lng });
    },
    [onAddressSelected, onChange]
  );

  const onPlaceChanged = () => {
    const place = autocompleteRef.current?.getPlace();
    if (!place) return;
    applyPlace(place as Parameters<typeof applyPlace>[0]);
  };

  const useCurrentLocation = () => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("הדפדפן לא תומך באיתור מיקום.");
      return;
    }
    if (!isLoaded || !window.google) {
      setGeoError("מפות Google עדיין נטענות. נסו שוב בעוד רגע.");
      return;
    }

    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode(
          { location: { lat: latitude, lng: longitude }, language: "he" },
          (results, status) => {
            setGeoLoading(false);
            if (status !== "OK" || !results?.[0]) {
              setGeoError("לא הצלחנו להמיר את המיקום לכתובת.");
              return;
            }
            applyPlace(results[0] as Parameters<typeof applyPlace>[0]);
          }
        );
      },
      () => {
        setGeoLoading(false);
        setGeoError("לא הצלחנו לקבל את המיקום. בדקו הרשאות מיקום בדפדפן.");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  useEffect(() => {
    if (!apiKey) {
      setGeoError("חסר מפתח Google Maps (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).");
    }
  }, [apiKey]);

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>שגיאה בטעינת מפות Google.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="dropoff_address" className="text-base text-brand-dark">
        כתובת למשלוח <span className="text-brand-error">*</span>
      </Label>

      {!isLoaded ? (
        <div className="flex h-12 items-center gap-2 rounded-lg border border-input px-3 text-brand-muted">
          <Loader2 className="size-4 animate-spin" />
          טוען מפות...
        </div>
      ) : (
        <Autocomplete
          onLoad={(ac) => {
            autocompleteRef.current = ac;
            ac.setComponentRestrictions({ country: ["il"] });
            ac.setFields([
              "formatted_address",
              "address_components",
              "geometry",
            ]);
          }}
          onPlaceChanged={onPlaceChanged}
          options={{
            componentRestrictions: { country: "il" },
            fields: ["formatted_address", "address_components", "geometry"],
          }}
        >
          <Input
            id="dropoff_address"
            value={value}
            disabled={disabled}
            onChange={(e) => {
              onChange(e.target.value);
              onAddressSelected(null);
            }}
            placeholder="הקלידו כתובת בישראל..."
            className="h-12 text-base"
            aria-invalid={Boolean(error)}
            autoComplete="off"
          />
        </Autocomplete>
      )}

      <Button
        type="button"
        variant="outline"
        disabled={disabled || geoLoading || !isLoaded}
        onClick={useCurrentLocation}
        className="h-11 w-full justify-center gap-2 text-sm sm:w-auto"
      >
        {geoLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <MapPin className="size-4" />
        )}
        📍 השתמש במיקום הנוכחי שלי
      </Button>

      {checkingService && (
        <p className="flex items-center gap-2 text-sm text-brand-muted">
          <Loader2 className="size-3.5 animate-spin" />
          בודקים זמינות באזור...
        </p>
      )}

      {serviceAvailable === true && (
        <p className={cn("text-sm font-medium text-brand-success")}>
          ✓ הכתובת באזור השירות
        </p>
      )}

      {serviceAvailable === false && value && (
        <Alert
          variant="destructive"
          className="border-brand-error/40 bg-brand-error/5"
        >
          <AlertDescription className="text-brand-error">
            {`מצטערים, השירות עדיין לא זמין ב${cityName || "אזור זה"} כרגע. אנחנו כרגע פועלים באזור תל אביב-יפו.`}
          </AlertDescription>
        </Alert>
      )}

      {(error || geoError) && (
        <p className="text-sm text-brand-error">{error || geoError}</p>
      )}
    </div>
  );
}
