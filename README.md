# Orrery — Near-Earth Object Watch

A mobile- and desktop-friendly space dashboard built on NASA's open APIs:

- **Solar System** — a true-to-scale, real-time 3D orrery (Three.js) showing all
  eight planets on their actual Keplerian orbits, with play/pause, speed
  control, and a "jump to today" reset. Tap any planet for live telemetry
  (distance from Sun, eccentricity, inclination, orbital period).
- **NEO Analytics** — pulls NASA's Near Earth Object Web Service (NeoWs) feed
  for any 7-day window and turns it into stat cards, charts (objects/day,
  diameter vs. miss distance, hazard split), and a sortable table.
- **Sky Snapshot** — today's NASA Astronomy Picture of the Day (APOD).

No build step, no framework, no bundler — just static HTML/CSS/JS, so it
deploys anywhere in minutes.

## Data sources

| Source | Used for |
|---|---|
| [NASA NeoWs `feed`](https://api.nasa.gov) | Near-Earth object analytics |
| [NASA APOD](https://api.nasa.gov) | Sky Snapshot tab |
| JPL low-precision Keplerian elements | Planet orbits & positions (computed client-side, no API call) |

On first load, the app shows a lock screen: paste in a NASA API key and hit
**Unlock console** (it's verified live against NASA before the key is
accepted). No key yet? The **Get a free API key →** button on that same
screen opens **https://api.nasa.gov** (instant, email only) in a new tab —
copy the key back in and unlock. The key is stored only in your browser's
`localStorage`, never sent anywhere but NASA's own servers, and you can swap
it later from the Settings drawer (gear icon, top right) if it ever gets
rate-limited.

## Run it locally

Because the app uses ES modules (`import`/`export`), you need to serve it
over HTTP — opening `index.html` directly via `file://` won't work in most
browsers. Any static server works:

```bash
# Option A — no install needed
npx serve .

# Option B
python3 -m http.server 8080
```

Then open the printed local URL (e.g. `http://localhost:3000`).

## Deploy to GitHub

```bash
cd orrery-neo-watch
git init
git add .
git commit -m "Initial commit"
gh repo create orrery-neo-watch --public --source=. --push
# or, without the GitHub CLI:
# git remote add origin https://github.com/<you>/orrery-neo-watch.git
# git branch -M main
# git push -u origin main
```

## Deploy to Vercel

**Via dashboard:** go to [vercel.com/new](https://vercel.com/new), import the
GitHub repo you just pushed, and click **Deploy**. No configuration needed —
Vercel detects it as a static site (framework preset "Other") since there's
no build step.

**Via CLI:**

```bash
npm i -g vercel
vercel        # first deploy, follow the prompts
vercel --prod # promote to production
```

`vercel.json` is already included with a couple of sane defaults (clean URLs,
a security header) — nothing else to configure.

## Project structure

```
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── orbitalElements.js   # Keplerian orbit math (no API calls)
│   ├── solarSystem.js       # Three.js scene, time controls, picking
│   ├── neoApi.js            # NASA NeoWs + APOD fetch wrappers
│   ├── neoDashboard.js      # Stats, Chart.js charts, sortable table
│   └── main.js              # Tabs, clock, settings drawer, APOD wiring
├── vercel.json
└── LICENSE
```

## Notes on accuracy

- Planet **orbits and positions** are computed from real orbital elements and
  are to scale relative to each other (1 AU = 22 scene units).
- Planet **sizes** are deliberately exaggerated (a true-to-scale Earth next to
  a true-to-scale orbit would be an invisible speck) — order of magnitude is
  preserved, absolute scale is not.
- The small dots that appear near Earth after loading NEO data are an
  **illustrative** overlay (color-coded by hazard status), not a to-scale
  plot of real trajectories.

## License

MIT — see [LICENSE](./LICENSE).
