import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Writes a real service worker into `dist` with this build's hashed asset URLs
 * baked in as the precache list.
 *
 * A hand-written SW cannot know the hashed filenames, and a generic runtime
 * cache means the first offline launch is unreliable — the whole point of
 * installing the app. Doing it as a small local plugin keeps the project free
 * of extra dependencies while still producing a correct precache manifest.
 */
function serviceWorker(): Plugin {
  return {
    name: 'calisthenics-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      // Only precache real build output. Paths stay relative to the worker's
      // own URL (resolved at runtime in the SW) rather than the origin root, so
      // the app also works when hosted in a subdirectory without any `base`
      // configuration.
      const assets = Object.values(bundle)
        .filter((chunk) => chunk.type === 'asset' && chunk.fileName.endsWith('.css'))
        .map((chunk) => chunk.fileName)

      const scripts = Object.values(bundle)
        .filter((chunk) => chunk.type === 'chunk' && chunk.isEntry)
        .map((chunk) => chunk.fileName)

      // The icons the manifest points at. Chrome fetches them at install time,
      // but precaching them means a reinstall - or an install prompted while
      // already offline - still has everything it needs.
      const icons = [
        'icon-192.png',
        'icon-512.png',
        'icon-maskable-192.png',
        'icon-maskable-512.png',
        'apple-touch-icon.png',
        'favicon.svg',
      ]

      // The shell answers every navigation, so it is stored under each spelling
      // the browser might use to ask for it: the file, the directory, and the
      // bare origin. A launch must never depend on guessing which one matches.
      const precache = ['./', 'index.html', 'manifest.webmanifest', ...icons, ...assets, ...scripts]

      const template = readFileSync(join(process.cwd(), 'scripts', 'sw-template.js'), 'utf8')
      // Changes whenever the asset list or the app version changes, which is
      // what makes `activate` throw away the previous build's cache.
      const version = `${Date.now().toString(36)}-${assets.length}-${scripts.length}`

      const source = template
        .replaceAll('__CACHE_VERSION__', version)
        .replaceAll('__PRECACHE__', JSON.stringify(precache, null, 2))

      // A leftover placeholder means the template and this plugin have drifted.
      // Emitting a broken worker would silently disable every offline launch,
      // so fail the build instead.
      if (source.includes('__CACHE_VERSION__') || source.includes('__PRECACHE__')) {
        this.error('Service worker template still contains unsubstituted placeholders.')
      }

      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
    closeBundle() {
      // A service worker only controls pages under its own scope, and the
      // browser will not accept a script served with the wrong MIME type - it
      // fails registration outright and silently, which leaves an app that
      // works online and cannot open without a network.
      //
      // This file is the Netlify / Cloudflare Pages `_headers` convention, so
      // those hosts get it automatically. Vercel reads `vercel.json` from the
      // project root instead, which is why that file is checked in and not
      // generated here.
      const outDir = join(process.cwd(), 'dist')
      writeFileSync(
        join(outDir, '_headers'),
        [
          '/sw.js',
          '  Content-Type: text/javascript; charset=utf-8',
          '  Cache-Control: public, max-age=0, must-revalidate',
          '  Service-Worker-Allowed: /',
          '',
          '/manifest.webmanifest',
          '  Content-Type: application/manifest+json; charset=utf-8',
          '  Cache-Control: public, max-age=0, must-revalidate',
          '',
          '/index.html',
          '  Cache-Control: public, max-age=0, must-revalidate',
          '',
        ].join('\n'),
      )

      // An earlier build wrote a per-file `.headers.txt`, which no host reads.
      // Left in place it is dead weight in the deployed output, and misleading
      // to anyone who finds it and assumes it is doing something.
      const stale = join(outDir, 'sw.js.headers.txt')
      if (existsSync(stale)) rmSync(stale)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss(), serviceWorker()],
  // Relative asset URLs in the production build, so `dist` works at a domain
  // root *or* in a subdirectory (GitHub Pages project sites, /apps/..., a
  // corporate subfolder) and still installs as a PWA, with no `base` setting
  // to remember. The service worker, the manifest and the icon links are all
  // relative for the same reason.
  //
  // Dev stays on '/' because the Vite dev server's module graph is only wired
  // up for an absolute base, and the build is what actually gets installed.
  base: command === 'build' ? './' : '/',
  // The single bundle is dominated by the exercise database itself — 131
  // exercises with muscles, steps, progressions and animation poses. It is
  // shipped as data, not lazy-loaded, because the Library is the first screen
  // most people open and the app is offline-first with no server to fetch from.
  build: {
    chunkSizeWarningLimit: 700,
    target: 'es2020',
  },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
}))
