"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { Loader2, MapPin } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { extractCityCandidates, extractCityFromComponents } from "@/lib/geo";
import { cn } from "@/lib/utils";
import type { AddressComponent } from "@/types/google-places";

const libraries: ("places")[] = ["places"];

const PLACE_FIELDS = [
  "place_id",
  "formatted_address",
  "address_components",
  "geometry",
] as const;

export type SelectedAddress = {
  address: string;
  city: string;
  cityCandidates: string[];
  lat: number;
  lng: number;
};

type AddressAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  onAddressSelected: (address: SelectedAddress | null) => void;
  /** When false, skip service-area UI/checks. Default true. */
  checkServiceArea?: boolean;
  serviceAvailable?: boolean | null;
  checkingService?: boolean;
  cityName?: string | null;
  disabled?: boolean;
  error?: string;
  inputId?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  showGeolocation?: boolean;
};

type PlaceLike = {
  place_id?: string;
  formatted_address?: string;
  address_components?: AddressComponent[];
  geometry?: { location?: google.maps.LatLng | google.maps.LatLngLiteral };
};

function readLatLng(location: google.maps.LatLng | google.maps.LatLngLiteral) {
  if (typeof (location as google.maps.LatLng).lat === "function") {
    const ll = location as google.maps.LatLng;
    return { lat: ll.lat(), lng: ll.lng() };
  }
  const literal = location as google.maps.LatLngLiteral;
  return { lat: literal.lat, lng: literal.lng };
}

function AddressAutocompleteComponent({
  value,
  onChange,
  onAddressSelected,
  checkServiceArea = true,
  serviceAvailable = null,
  checkingService = false,
  cityName,
  disabled,
  error,
  inputId = "dropoff_address",
  label = "כתובת למשלוח",
  placeholder = "הקלידו כתובת בישראל...",
  required = true,
  showGeolocation = true,
}: AddressAutocompleteProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "nishlach-google-maps-he",
    googleMapsApiKey: apiKey,
    libraries,
    language: "he",
    region: "IL",
  });

  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(
    null
  );
  const placesHostRef = useRef<HTMLDivElement | null>(null);
  const hadSelectionRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const onAddressSelectedRef = useRef(onAddressSelected);
  const checkServiceAreaRef = useRef(checkServiceArea);

  const [text, setText] = useState(value);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
    onAddressSelectedRef.current = onAddressSelected;
    checkServiceAreaRef.current = checkServiceArea;
  }, [onChange, onAddressSelected, checkServiceArea]);

  useEffect(() => {
    setText(value);
  }, [value]);

  const applyPlace = useCallback((place: PlaceLike) => {
    const address = place.formatted_address;
    const location = place.geometry?.location;
    if (!address || !location) {
      hadSelectionRef.current = false;
      onAddressSelectedRef.current(null);
      return;
    }

    const { lat, lng } = readLatLng(location);
    const cityCandidates = extractCityCandidates(
      place.address_components,
      address
    );
    const city =
      extractCityFromComponents(place.address_components, address) ?? "";

    // TEMP: verify Google Hebrew city extraction — remove once confirmed
    console.log("Extracted city:", city);
    console.log("City candidates:", cityCandidates);

    if (checkServiceAreaRef.current && !city) {
      hadSelectionRef.current = false;
      onAddressSelectedRef.current(null);
      setGeoError("לא הצלחנו לזהות את העיר מהכתובת. נסו לבחור כתובת אחרת.");
      return;
    }

    setGeoError(null);
    hadSelectionRef.current = true;
    setText(address);
    onChangeRef.current(address);
    onAddressSelectedRef.current({
      address,
      city,
      cityCandidates,
      lat,
      lng,
    });
  }, []);

  const resolvePlaceDetails = useCallback(
    (place: PlaceLike) => {
      if (place.place_id && placesServiceRef.current) {
        placesServiceRef.current.getDetails(
          {
            placeId: place.place_id,
            fields: [...PLACE_FIELDS],
            language: "he",
          },
          (details, status) => {
            if (
              status === google.maps.places.PlacesServiceStatus.OK &&
              details
            ) {
              applyPlace(details as PlaceLike);
              return;
            }
            applyPlace(place);
          }
        );
        return;
      }
      applyPlace(place);
    },
    [applyPlace]
  );

  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return;
    if (!window.google?.maps?.places) return;

    if (placesHostRef.current && !placesServiceRef.current) {
      placesServiceRef.current = new google.maps.places.PlacesService(
        placesHostRef.current
      );
    }

    const ac = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: ["il"] },
      fields: [...PLACE_FIELDS],
    });

    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (!place) return;
      resolvePlaceDetails(place as PlaceLike);
    });

    autocompleteRef.current = ac;

    return () => {
      listener.remove();
      google.maps.event.clearInstanceListeners(ac);
      autocompleteRef.current = null;
    };
  }, [isLoaded, resolvePlaceDetails]);

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setText(next);
    onChangeRef.current(next);

    if (hadSelectionRef.current) {
      hadSelectionRef.current = false;
      onAddressSelectedRef.current(null);
    }
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
            applyPlace(results[0] as PlaceLike);
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
      <Label htmlFor={inputId} className="text-base text-brand-dark">
        {label}
        {required && <span className="text-brand-error"> *</span>}
      </Label>

      <div ref={placesHostRef} className="hidden" aria-hidden />

      {!isLoaded ? (
        <div className="flex h-12 items-center gap-2 rounded-lg border border-input px-3 text-brand-muted">
          <Loader2 className="size-4 animate-spin" />
          טוען מפות...
        </div>
      ) : null}

      <input
        ref={inputRef}
        id={inputId}
        type="text"
        value={text}
        disabled={disabled || !isLoaded}
        onChange={onInputChange}
        placeholder={placeholder}
        className={cn(
          "h-12 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive",
          !isLoaded && "hidden"
        )}
        aria-invalid={Boolean(error)}
        autoComplete="off"
        suppressHydrationWarning
      />

      {showGeolocation && (
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
      )}

      {checkServiceArea && checkingService && (
        <p className="flex items-center gap-2 text-sm text-brand-muted">
          <Loader2 className="size-3.5 animate-spin" />
          בודקים זמינות באזור...
        </p>
      )}

      {checkServiceArea && serviceAvailable === true && (
        <p className={cn("text-sm font-medium text-brand-success")}>
          ✓ הכתובת באזור השירות
        </p>
      )}

      {checkServiceArea && serviceAvailable === false && text && (
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

export const AddressAutocomplete = memo(AddressAutocompleteComponent);
