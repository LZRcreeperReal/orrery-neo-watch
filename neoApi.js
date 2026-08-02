const KEY_STORAGE = 'orrery.nasaApiKey';

/** Returns the stored key, or null if none has been set yet. */
export function getApiKey() {
  return localStorage.getItem(KEY_STORAGE);
}

export function hasApiKey() {
  return !!getApiKey();
}

export function setApiKey(key) {
  const trimmed = (key || '').trim();
  if (trimmed) localStorage.setItem(KEY_STORAGE, trimmed);
  else localStorage.removeItem(KEY_STORAGE);
}

function requireApiKey() {
  const key = getApiKey();
  if (!key) {
    const err = new Error('No NASA API key set yet.');
    err.status = 401;
    throw err;
  }
  return key;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.error_message || body?.error?.message || '';
    } catch (_) { /* ignore parse failure */ }
    const err = new Error(detail || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/**
 * Fetch near-Earth objects whose close-approach date falls within [start, end]
 * (inclusive, max 7-day span per NASA's API limits). Returns a flat, sorted
 * array of simplified NEO records ready for the dashboard/table/charts.
 */
export async function fetchNeoFeed(startDate, endDate) {
  const key = requireApiKey();
  const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${startDate}&end_date=${endDate}&api_key=${encodeURIComponent(key)}`;
  const data = await fetchJson(url);

  const flat = [];
  const byDate = data.near_earth_objects || {};
  Object.keys(byDate).forEach((date) => {
    byDate[date].forEach((obj) => {
      const approach = obj.close_approach_data?.[0];
      const diaMin = obj.estimated_diameter?.meters?.estimated_diameter_min ?? 0;
      const diaMax = obj.estimated_diameter?.meters?.estimated_diameter_max ?? 0;
      flat.push({
        id: obj.id,
        name: obj.name.replace(/[()]/g, ''),
        date,
        hazardous: !!obj.is_potentially_hazardous_asteroid,
        diameterM: (diaMin + diaMax) / 2,
        diameterMinM: diaMin,
        diameterMaxM: diaMax,
        velocityKmS: approach ? parseFloat(approach.relative_velocity.kilometers_per_second) : 0,
        missDistanceKm: approach ? parseFloat(approach.miss_distance.kilometers) : 0,
        missDistanceLunar: approach ? parseFloat(approach.miss_distance.lunar) : 0,
        nasaJplUrl: obj.nasa_jpl_url,
        magnitude: obj.absolute_magnitude_h,
      });
    });
  });

  flat.sort((a, b) => a.missDistanceKm - b.missDistanceKm);
  return { list: flat, elementCount: data.element_count ?? flat.length };
}

/** Fetch NASA's Astronomy Picture of the Day. */
export async function fetchApod() {
  const key = requireApiKey();
  const url = `https://api.nasa.gov/planetary/apod?api_key=${encodeURIComponent(key)}`;
  return fetchJson(url);
}
