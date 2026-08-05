export type AddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

export type GeocoderResultLike = {
  formatted_address: string;
  address_components: AddressComponent[];
  geometry: {
    location: {
      lat: number | (() => number);
      lng: number | (() => number);
    };
  };
};
