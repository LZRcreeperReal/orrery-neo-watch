// ============================================================================
// Keplerian orbital elements for the eight major planets, valid for the epoch
// range ~1800-2050 CE. Source: JPL Solar System Dynamics "Keplerian Elements
// for Approximate Positions of the Major Planets" (Standish/JPL, low-precision
// ephemeris). Angles in degrees, lengths in AU, rates are per Julian century.
//
// a  = semi-major axis
// e  = eccentricity
// i  = inclination to the ecliptic
// L  = mean longitude
// wBar = longitude of perihelion
// Om = longitude of ascending node
// ----------------------------------------------------------------------------

export const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0); // JD 2451545.0

export const PLANETS = [
  {
    key: 'mercury', name: 'Mercury', color: '#b8ada0', radiusKm: 2439.7,
    el:  { a: 0.38709927,  e: 0.20563593,  i: 7.00497902,   L: 252.25032350,  wBar: 77.45779628,  Om: 48.33076593 },
    rate:{ a: 0.00000037,  e: 0.00001906,  i: -0.00594749,  L: 149472.67411175, wBar: 0.16047689,  Om: -0.12534081 },
  },
  {
    key: 'venus', name: 'Venus', color: '#e3c48b', radiusKm: 6051.8,
    el:  { a: 0.72333566,  e: 0.00677672,  i: 3.39467605,   L: 181.97909950,  wBar: 131.60246718, Om: 76.67984255 },
    rate:{ a: 0.00000390,  e: -0.00004107, i: -0.00078890,  L: 58517.81538729,  wBar: 0.00268329,  Om: -0.27769418 },
  },
  {
    key: 'earth', name: 'Earth', color: '#4fb0c6', radiusKm: 6371.0,
    el:  { a: 1.00000261,  e: 0.01671123,  i: -0.00001531,  L: 100.46457166,  wBar: 102.93768193, Om: 0.0 },
    rate:{ a: 0.00000562,  e: -0.00004392, i: -0.01294668,  L: 35999.37244981,  wBar: 0.32327364,  Om: 0.0 },
  },
  {
    key: 'mars', name: 'Mars', color: '#c1552c', radiusKm: 3389.5,
    el:  { a: 1.52371034,  e: 0.09339410,  i: 1.84969142,   L: -4.55343205,   wBar: -23.94362959, Om: 49.55953891 },
    rate:{ a: 0.00001847,  e: 0.00007882,  i: -0.00813131,  L: 19140.30268499,  wBar: 0.44441088,  Om: -0.29257343 },
  },
  {
    key: 'jupiter', name: 'Jupiter', color: '#d8ab74', radiusKm: 69911,
    el:  { a: 5.20288700,  e: 0.04838624,  i: 1.30439695,   L: 34.39644051,   wBar: 14.72847983,  Om: 100.47390909 },
    rate:{ a: -0.00011607, e: -0.00013253, i: -0.00183714,  L: 3034.74612775,   wBar: 0.21252668,  Om: 0.20469106 },
  },
  {
    key: 'saturn', name: 'Saturn', color: '#e3c98a', radiusKm: 58232,
    el:  { a: 9.53667594,  e: 0.05386179,  i: 2.48599187,   L: 49.95424423,   wBar: 92.59887831,  Om: 113.66242448 },
    rate:{ a: -0.00125060, e: -0.00050991, i: 0.00193609,   L: 1222.49362201,   wBar: -0.41897216, Om: -0.28867794 },
  },
  {
    key: 'uranus', name: 'Uranus', color: '#9fd4d8', radiusKm: 25362,
    el:  { a: 19.18916464, e: 0.04725744,  i: 0.77263783,   L: 313.23810451,  wBar: 170.95427630, Om: 74.01692503 },
    rate:{ a: -0.00196176, e: -0.00004397, i: -0.00242939,  L: 428.48202785,    wBar: 0.40805281,  Om: 0.04240589 },
  },
  {
    key: 'neptune', name: 'Neptune', color: '#5b7fe8', radiusKm: 24622,
    el:  { a: 30.06992276, e: 0.00859048,  i: 1.77004347,   L: -55.12002969,  wBar: 44.96476227,  Om: 131.78422574 },
    rate:{ a: 0.00026291,  e: 0.00005105,  i: 0.00035372,   L: 218.45945325,    wBar: -0.32241464, Om: -0.00508664 },
  },
];

const DEG2RAD = Math.PI / 180;

function normalizeDeg(deg) {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

// Solve Kepler's equation M = E - e*sin(E) for eccentric anomaly E, via Newton's method.
function solveKepler(Mdeg, e) {
  const M = Mdeg * DEG2RAD;
  let E = e > 0.8 ? Math.PI : M;
  for (let i = 0; i < 12; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-9) break;
  }
  return E; // radians
}

/**
 * Compute heliocentric ecliptic position of a planet at a given Date.
 * Returns { x, y, z } in AU, ecliptic coordinates (x toward reference
 * equinox, z toward north ecliptic pole), plus derived scalars.
 */
export function heliocentricPosition(planet, date) {
  const T = (date.getTime() - J2000) / (36525 * 86400000); // Julian centuries since J2000

  const a = planet.el.a + planet.rate.a * T;
  const e = planet.el.e + planet.rate.e * T;
  const i = planet.el.i + planet.rate.i * T;
  const L = planet.el.L + planet.rate.L * T;
  const wBar = planet.el.wBar + planet.rate.wBar * T;
  const Om = planet.el.Om + planet.rate.Om * T;

  const w = wBar - Om;              // argument of perihelion
  const M = normalizeDeg(L - wBar); // mean anomaly

  const E = solveKepler(M, e); // eccentric anomaly, radians

  // position in orbital plane
  const xOrb = a * (Math.cos(E) - e);
  const yOrb = a * Math.sqrt(1 - e * e) * Math.sin(E);

  const wRad = w * DEG2RAD;
  const OmRad = Om * DEG2RAD;
  const iRad = i * DEG2RAD;

  const cosW = Math.cos(wRad), sinW = Math.sin(wRad);
  const cosOm = Math.cos(OmRad), sinOm = Math.sin(OmRad);
  const cosI = Math.cos(iRad), sinI = Math.sin(iRad);

  // rotate by argument of perihelion, inclination, longitude of ascending node
  const xEcl = (cosW * cosOm - sinW * sinOm * cosI) * xOrb + (-sinW * cosOm - cosW * sinOm * cosI) * yOrb;
  const yEcl = (cosW * sinOm + sinW * cosOm * cosI) * xOrb + (-sinW * sinOm + cosW * cosOm * cosI) * yOrb;
  const zEcl = (sinW * sinI) * xOrb + (cosW * sinI) * yOrb;

  const distanceAu = Math.sqrt(xEcl * xEcl + yEcl * yEcl + zEcl * zEcl);
  const periodDays = 365.25 * Math.pow(a, 1.5);

  return { x: xEcl, y: yEcl, z: zEcl, distanceAu, a, e, i, periodDays };
}

/** Sample an orbit ellipse as an array of {x,y,z} points (AU) for drawing. */
export function orbitPath(planet, date, segments = 256) {
  const T = (date.getTime() - J2000) / (36525 * 86400000);
  const a = planet.el.a + planet.rate.a * T;
  const e = planet.el.e + planet.rate.e * T;
  const i = (planet.el.i + planet.rate.i * T) * DEG2RAD;
  const wBar = planet.el.wBar + planet.rate.wBar * T;
  const Om = planet.el.Om + planet.rate.Om * T;
  const w = (wBar - Om) * DEG2RAD;
  const OmRad = Om * DEG2RAD;

  const cosW = Math.cos(w), sinW = Math.sin(w);
  const cosOm = Math.cos(OmRad), sinOm = Math.sin(OmRad);
  const cosI = Math.cos(i), sinI = Math.sin(i);

  const pts = [];
  for (let s = 0; s <= segments; s++) {
    const E = (s / segments) * 2 * Math.PI;
    const xOrb = a * (Math.cos(E) - e);
    const yOrb = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const x = (cosW * cosOm - sinW * sinOm * cosI) * xOrb + (-sinW * cosOm - cosW * sinOm * cosI) * yOrb;
    const y = (cosW * sinOm + sinW * cosOm * cosI) * xOrb + (-sinW * sinOm + cosW * cosOm * cosI) * yOrb;
    const z = (sinW * sinI) * xOrb + (cosW * sinI) * yOrb;
    pts.push({ x, y, z });
  }
  return pts;
}

// ----------------------------------------------------------------------------
// Zodiac lookup — maps an ecliptic longitude (tropical, referenced to the
// J2000 equinox used throughout this module) to one of the 12 traditional
// 30°-wide zodiac constellations. Purely descriptive/illustrative, no
// precession correction applied.
// ----------------------------------------------------------------------------
export const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

export function zodiacForLongitude(lonDeg) {
  const norm = ((lonDeg % 360) + 360) % 360;
  return ZODIAC_SIGNS[Math.floor(norm / 30)];
}

// ----------------------------------------------------------------------------
// Static reference facts shown alongside the live-computed orbital telemetry.
// Approximate, widely-cited values — moon counts in particular are revised
// periodically as new surveys confirm additional small satellites.
// ----------------------------------------------------------------------------
export const PLANET_FACTS = {
  mercury: { moons: '0', gravity: '3.7 m/s²', dayLength: '58.6 Earth days', avgTemp: '167°C' },
  venus: { moons: '0', gravity: '8.87 m/s²', dayLength: '243 Earth days (retrograde)', avgTemp: '464°C' },
  earth: { moons: '1', gravity: '9.81 m/s²', dayLength: '23h 56m', avgTemp: '15°C' },
  mars: { moons: '2', gravity: '3.71 m/s²', dayLength: '24h 37m', avgTemp: '-65°C' },
  jupiter: { moons: '95 known', gravity: '24.79 m/s²', dayLength: '9h 56m', avgTemp: '-110°C' },
  saturn: { moons: '146 known', gravity: '10.44 m/s²', dayLength: '10h 42m', avgTemp: '-140°C' },
  uranus: { moons: '28', gravity: '8.69 m/s²', dayLength: '17h 14m (retrograde)', avgTemp: '-195°C' },
  neptune: { moons: '16', gravity: '11.15 m/s²', dayLength: '16h 6m', avgTemp: '-200°C' },
};
