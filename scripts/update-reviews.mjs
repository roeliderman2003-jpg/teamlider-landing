// Fetches Team Lider's live Google rating + review count and writes reviews.json.
// Runs weekly in GitHub Actions (see .github/workflows/update-reviews.yml).
//
// Looks the business up BY NAME via the Google Places API (New) Text Search, so no
// Place ID is needed — only the API key. A location bias around Rosh HaAyin makes the
// match unambiguous.
//   POST https://places.googleapis.com/v1/places:searchText
//   headers: X-Goog-Api-Key, X-Goog-FieldMask
//
// Env: GOOGLE_PLACES_API_KEY (required). PLACE_QUERY (optional, overrides the search text).
import { writeFileSync, readFileSync } from 'node:fs';

const KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!KEY) {
  console.error('Missing GOOGLE_PLACES_API_KEY env var.');
  process.exit(1);
}

const query = process.env.PLACE_QUERY || 'אימוני כושר לילדים בראש העין - Team Lider';

const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': KEY,
    'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.formattedAddress,places.googleMapsUri',
  },
  body: JSON.stringify({
    textQuery: query,
    languageCode: 'he',
    // Team Lider's pin in Rosh HaAyin (גולדה מאיר 20 / פסגות אפק) — keeps the match unambiguous.
    locationBias: { circle: { center: { latitude: 32.0878692, longitude: 34.9734947 }, radius: 3000 } },
    maxResultCount: 1,
  }),
});

if (!res.ok) {
  const body = await res.text();
  console.error(`Places API HTTP ${res.status}: ${body.slice(0, 400)}`);
  process.exit(1);
}

const data = await res.json();
const place = data.places && data.places[0];

if (!place || place.rating == null) {
  console.error('No place/rating in response:', JSON.stringify(data).slice(0, 400));
  process.exit(1);
}

const ratingStr = Number(place.rating).toFixed(1);        // e.g. "4.7"
const countStr = String(place.userRatingCount ?? 0);      // e.g. "84"

let prev = {};
try { prev = JSON.parse(readFileSync('reviews.json', 'utf8')); } catch {}

const out = { rating: ratingStr, count: countStr, updated: new Date().toISOString().slice(0, 10) };
if (place.id) {
  out.placeId = place.id;
  // "write a review" deep link — used by the WhatsApp review-request template.
  out.reviewsUrl = `https://search.google.com/local/writereview?placeid=${place.id}`;
}
// Public Maps profile link — the on-site rating badges link here to show real reviews.
if (place.googleMapsUri) out.mapsUrl = place.googleMapsUri;

writeFileSync('reviews.json', JSON.stringify(out, null, 2) + '\n');

console.log(`Matched "${place.displayName && place.displayName.text || ''}" (${place.formattedAddress || ''}).`);
console.log(`placeId ${place.id || '?'} · mapsUrl ${place.googleMapsUri || '?'}`);
console.log(`reviews.json: rating ${prev.rating ?? '?'} -> ${ratingStr}, count ${prev.count ?? '?'} -> ${countStr}`);
