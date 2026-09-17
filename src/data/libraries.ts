export type Library = {
  id: string;
  name: string;
  street: string;
  city: string;
  lat: number;
  lng: number;
};

export const LIBRARIES: Library[] = [
  { id: "arcade", name: "Arcade Library", street: "2443 Marconi Ave", city: "Sacramento, CA 95821", lat: 38.6184549, lng: -121.4040969 },
  { id: "arden-dimick", name: "Arden-Dimick Library", street: "891 Watt Ave", city: "Sacramento, CA 95864", lat: 38.5807527, lng: -121.383564 },
  { id: "belle-cooledge", name: "Belle Cooledge Library", street: "5600 S Land Park Dr", city: "Sacramento, CA 95822", lat: 38.524027, lng: -121.5119323 },
  { id: "colonial-heights", name: "Colonial Heights Library", street: "4799 Stockton Blvd", city: "Sacramento, CA 95820", lat: 38.5325465, lng: -121.4453458 },
  { id: "fair-oaks", name: "Fair Oaks Library", street: "11601 Fair Oaks Blvd", city: "Fair Oaks, CA 95628", lat: 38.6626383, lng: -121.2631033 },
  { id: "north-natomas", name: "North Natomas Library", street: "4660 Via Ingoglia", city: "Sacramento, CA 95835", lat: 38.6575093, lng: -121.5180237 },
  { id: "rancho-cordova", name: "Rancho Cordova Library", street: "9845 Folsom Blvd", city: "Sacramento, CA 95827", lat: 38.5765343, lng: -121.3292247 },
  { id: "pocket-greenhaven", name: "Robbie Waters Pocket-Greenhaven Library", street: "7335 Gloria Dr", city: "Sacramento, CA 95831", lat: 38.4939114, lng: -121.5370108 },
  { id: "valley-hi", name: "Valley Hi-North Library", street: "7400 Imagination Pkwy", city: "Sacramento, CA 95823", lat: 38.451866, lng: -121.4170649 },
];

export const LIBRARY_IDS = LIBRARIES.map((l) => l.id);

export function fullAddress(l: Library) {
  return `${l.street}, ${l.city}`;
}

export function directionsUrl(l: Library) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${l.name}, ${fullAddress(l)}`)}`;
}

export const BRANCH_FINDER_URL = "https://www.saclibrary.org/visit-us";
