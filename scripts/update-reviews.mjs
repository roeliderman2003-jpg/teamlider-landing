// Fetches Team Lider's live Google rating + review count and writes reviews.json.
// Runs weekly in GitHub Actions (see .github/workflows/update-reviews.yml).
// Requires env: GOOGLE_PLACES_API_KEY, PLACE_ID.
//
// Uses the Google Places API (New) v1 Place Details endpoint:
//   GET https://places.googleapis.com/v1/places/{PLACE_ID}
//   headers: X-Goog-Api-Key, X-Goog-FieldMask: rating,userRatingCount
import { writeFileSync, readFileSync } from 'node:fs';

const KEY = process.env.GOOGLE_PLACES_API_KEY;
const PLACE_ID = process.env.PLACE_ID;

if (!KEY || !PLACE_ID) {
  console.error('Missing GOOGLE_PLACES_API_KEY or PLACE_ID env var.');
  process.exit(1);
}

const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(PLACE_ID)}`, {
  headers: {
    'X-Goog-Api-Key': KEY,
    'X-Goog-FieldMask': 'rating,userRatingCount',
  },
});

if (!res.ok) {
  const body = await res.text();
  console.error(`Places API HTTP ${res.status}: ${body.slice(0, 300)}`);
  process.exit(1);
}

const data = await res.json();
const rating = data.rating;               // e.g. 4.7
const count = data.userRatingCount;       // e.g. 84

if (rating == null || count == null) {
  console.error('Places API response missing rating/userRatingCount:', JSON.stringify(data).slice(0, 300));
  process.exit(1);
}

// Keep one decimal for the rating (Google returns e.g. 4.7). Guard against 5.0 -> "5".
const ratingStr = Number(rating).toFixed(1);
const countStr = String(count);

let prev = {};
try { prev = JSON.parse(readFileSync('reviews.json', 'utf8')); } catch {}

const out = { rating: ratingStr, count: countStr, updated: new Date().toISOString().slice(0, 10) };
writeFileSync('reviews.json', JSON.stringify(out, null, 2) + '\n');

console.log(`reviews.json: rating ${prev.rating ?? '?'} -> ${ratingStr}, count ${prev.count ?? '?'} -> ${countStr}`);
