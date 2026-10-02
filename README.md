# Calisthenics Tracker

An offline-first calisthenics training tracker. 131 exercises across every push, pull,
leg, static and skill movement, plus workouts, session logging, personal records, skills
ladders, nutrition and progress tracking.

Everything is stored on the device (`localStorage`). There is no account, no server and
no network call — after the first load the app works with the phone in airplane mode.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # -> dist/
npm run preview    # serves dist/ on http://localhost:4173
```

`npm run check` is the full gate: exercise-database checks (progression links, skill
ladders, difficulty ordering), lint, and a production build. It should be green
before you ship. `npm run icons` regenerates the icon set from the mark described in
`scripts/generate-icons.mjs` — only needed when the logo changes.

## Installing on an Android phone

The app is a PWA: once served over **HTTPS** (or `localhost`) it can be added to the home
screen and launches like a normal app.

1. Build and host `dist/` on any static host. It must be **HTTPS** — Chrome refuses to
   install a service worker over plain HTTP on a LAN IP, which is the one thing that will
   silently stop this working. Free options: GitHub Pages, Netlify, Cloudflare Pages, Vercel.

`dist` works at a domain root *or* in a subdirectory — every URL in the build is
relative, so a GitHub Pages project site (`user.github.io/calisthenics/`) or any
`/apps/…` path installs exactly the same, with nothing to configure.
2. Open the site in Chrome on the phone.
3. Either tap the **Install** banner that appears in the app, or use the manual route in
   ⚙️ Profile → *Install on this phone* → ⋮ → **Add to Home screen**.
4. Launch it from the home screen. There is no browser bar, and it opens offline.

The manifest also defines four long-press shortcuts (Workout, Exercises, Nutrition,
Progress) which deep-link via `/?tab=…`.

### Host requirements

`dist/sw.js` needs three headers, recorded in `dist/sw.js.headers.txt` after every build:

| Header               | Why                                                          |
| -------------------- | ------------------------------------------------------------ |
| `Content-Type: text/javascript` | Some hosts serve `.js` as `application/octet-stream`, and the worker will refuse to install. |
| `Service-Worker-Allowed: /`     | Only needed if the worker is served from a subdirectory.     |
| `Cache-Control: no-cache`       | Otherwise a stale `sw.js` can be served and updates never land. |

Everything must be same-origin for the app to work offline. There are no third-party
requests at all.

## How the offline layer works

There is no `vite-plugin-pwa` dependency. Instead:

- `scripts/sw-template.js` is the service worker source, with two build-time placeholders
  for the cache name and the precache list.
- A small local plugin in `vite.config.ts` fills those in with the real hashed asset URLs
  and emits `dist/sw.js`. The build **fails** if a placeholder survives substitution, so a
  template/plugin drift can never ship a worker that throws on startup.
- `src/lib/pwa.ts` registers it (production builds only) and surfaces the install and
  update-ready events. Registration uses `updateViaCache: 'none'`, without which the HTTP cache
  is allowed to serve a stale `sw.js` and a new build's worker is never fetched.
- `src/components/InstallBanner.tsx` shows the install prompt / update prompt.
- `src/components/InstallCard.tsx` is the manual fallback for browsers that never fire
  `beforeinstallprompt`.

Strategy: precache the whole shell on install, then serve everything from the cache.

**A launch never waits on the network.** Navigations are answered from the cache first, and
revalidation happens in the background afterwards. This is the part that actually matters on a
phone: a device with no connection can still resolve the hostname — local DNS, Private DNS, a
cached record — and in that case `fetch()` does not fail, it sits in a TCP connect timeout for
tens of seconds. A network-first handler leaves the launch sitting on a blank screen for the
whole of it, because the HTML itself never arrives. Freshness is not lost: every build ships a
new worker with a new cache name, which calls `skipWaiting` and reloads the page, so a new shell
is picked up atomically.

**Nothing that is not the app is ever stored.** `response.ok` is nowhere near enough. A captive
portal, a hotel or airport Wi-Fi login, a corporate gateway or a misconfigured proxy all answer
with a genuine HTTP 200 and a page of somebody else's HTML. Caching that over a good copy does
not just fail to help — the app keeps working while the network is up, and the next cold launch
is a blank page with no way for the user to recover. So an HTML document is only ever stored
where an HTML document was asked for, and the shell must additionally carry the
`calisthenics-shell` marker from `index.html`. Content-hashed assets are never revalidated at
all: a rebuild renames them, so there is nothing to refresh and every refresh is an opportunity
to overwrite something good.

**A partial or poisoned cache repairs itself.** Install retries, activation re-checks, and each
launch looks for entries that are missing *or* holding the wrong kind of content. The check is
local — headers only, no network — and the refetch is rate limited so a launch never turns into
a burst of requests.

`src/lib/pwa.ts` also guarantees the page is genuinely controlled. An uncontrolled page has
nothing intercepting its requests, so nothing it loads is stored and that whole session silently
cannot go offline. `workerStatus()` asks the worker to confirm both that it is in charge and
that the precache is complete, which is the only way to tell "offline will work" from "offline
will not" while the network is still up; the Profile screen reports it on an installed app.

## Icons

`public/icon-*.png` and `apple-touch-icon.png` are generated by
`node scripts/generate-icons.mjs`, a dependency-free PNG encoder built on Node's `zlib`.
That script owns the artwork: it holds the lightning bolt's traced outline and its measured
purple-to-blue ramp, and writes `public/icon.svg`, `public/favicon.svg` and every PNG from
those numbers, so the marks cannot drift apart. The same outline and gradient are inlined in
the header (`src/components/Logo.tsx`) and in the splash screen (`index.html`); copy the
numbers from the script if you change the mark.

## Layout notes

- Mobile-first, `dvh` units and `env(safe-area-inset-*)` padding, with `viewport-fit=cover`
  in `index.html`. The inline splash in `index.html` paints on the first frame so a cold
  start never flashes white, including offline.
- All interactive targets are at least 44×44 CSS px, which is the comfortable one-handed
  minimum. The only exceptions are intentionally decorative, non-interactive elements.
