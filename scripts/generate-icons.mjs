/**
 * Generates the PWA icon set and the vector marks from one description of the
 * logo, with no image dependencies.
 *
 * The mark is the lightning bolt traced out of the source artwork: its nine
 * edges were recovered from sub-pixel scanline crossings, least-squares fitted,
 * and then refined against the original alpha channel until the polygon
 * rasterised back to IoU 0.980 against the source, so what is drawn here is the
 * same shape rather than a lookalike. The fill is the purple-to-blue ramp
 * measured from the same artwork, whose axis is 8.72 degrees off horizontal and
 * whose blue channel is constant.
 *
 * Geometry below is therefore expressed in the source artwork's own pixel
 * coordinates (x right, y down) and mapped onto whatever canvas is being drawn,
 * which keeps the marks identical at every size instead of re-derived per size.
 *
 * The artwork is rasterised in plain JS with 4x supersampling, which is what
 * gives the edges their anti-aliasing. PNG encoding is done by hand
 * (IHDR/IDAT/IEND + CRC32) on top of Node's built-in zlib.
 *
 * Run with:  node scripts/generate-icons.mjs
 */

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const SS = 4 // supersampling factor

/* ── The artwork ──────────────────────────────────────────────────────────── */

/*
 * The bolt, clockwise from the top-left corner, in source-artwork pixels. The
 * source image crops the mark tightly, which is why the bounds run slightly
 * outside 0..32 / 0..31: the left tip and the flat top sit on the crop edge.
 */
const BOLT = [
  [6.5079, -0.5], // flat top, left end
  [27.5103, -0.5], // flat top, right end
  [20.1254, 10.2107], // down the upper right slant to the step
  [31.9966, 10.2107], // right along the step to the lower right corner
  [15.4317, 31.3911], // down the long right edge to the tip
  [15.3206, 20.8181], // up the tail's flank
  [4.9418, 20.8181], // left along the underside
  [12.1342, 10.2107], // up the lower left slant to the step
  [-1.1312, 10.2107], // left along the step to the left corner
]

const BOLT_MIN_X = Math.min(...BOLT.map((p) => p[0]))
const BOLT_MAX_X = Math.max(...BOLT.map((p) => p[0]))
const BOLT_MIN_Y = Math.min(...BOLT.map((p) => p[1]))
const BOLT_MAX_Y = Math.max(...BOLT.map((p) => p[1]))

/*
 * The fill. `axis` is the unit direction the ramp runs along, measured by
 * regressing every colour channel against that projection and keeping the
 * direction with the least error; `from`/`to` are the colours at `tFrom`/`tTo`,
 * so the ramp between them is linear and identical to the two stops the SVG
 * marks use. Outside that span the ends hold.
 */
const FILL = {
  axis: [0.9885, 0.15163], // 8.72 degrees below horizontal
  from: [0xa5, 0x3a, 0xff], // #a53aff, purple
  to: [0x74, 0x6e, 0xff], // #746eff, blue
  tFrom: 2.36,
  tTo: 31.32,
}

const tOf = (x, y) => x * FILL.axis[0] + y * FILL.axis[1]

/** The bolt's fill colour at a point, matching the SVG gradient exactly. */
function fillAt(x, y) {
  const f = Math.min(1, Math.max(0, (tOf(x, y) - FILL.tFrom) / (FILL.tTo - FILL.tFrom)))
  return [0, 1, 2].map((c) => FILL.from[c] + (FILL.to[c] - FILL.from[c]) * f)
}

/* ── Tiny raster helpers (operate on a float RGBA buffer) ─────────────────── */

function createCanvas(size) {
  return { size, data: new Float64Array(size * size * 4) }
}

function blend(canvas, x, y, [r, g, b], alpha) {
  if (alpha <= 0) return
  const i = (y * canvas.size + x) * 4
  const d = canvas.data
  const inv = 1 - alpha
  d[i] = d[i] * inv + r * alpha
  d[i + 1] = d[i + 1] * inv + g * alpha
  d[i + 2] = d[i + 2] * inv + b * alpha
  d[i + 3] = d[i + 3] * inv + 255 * alpha
}

/** Coverage of a pixel by a rounded rect, sampled 3x3 inside the pixel. */
function roundedRectCoverage(px, py, x0, y0, w, h, r) {
  let hits = 0
  for (let sy = 0; sy < 3; sy++) {
    for (let sx = 0; sx < 3; sx++) {
      const x = px + (sx + 0.5) / 3
      const y = py + (sy + 0.5) / 3
      if (x < x0 || x > x0 + w || y < y0 || y > y0 + h) continue
      // Inside the straight edges?
      const cx = Math.min(Math.max(x, x0 + r), x0 + w - r)
      const cy = Math.min(Math.max(y, y0 + r), y0 + h - r)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) hits++
    }
  }
  return hits / 9
}

function pointInPolygon(x, y) {
  let inside = false
  for (let i = 0, j = BOLT.length - 1; i < BOLT.length; j = i++) {
    const [xi, yi] = BOLT[i]
    const [xj, yj] = BOLT[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Coverage of a pixel by the bolt, sampled on an NxN grid inside the pixel. */
function boltCoverage(px, py, layout, n = 4) {
  const { scale, tx, ty } = layout
  let hits = 0
  for (let sy = 0; sy < n; sy++) {
    for (let sx = 0; sx < n; sx++) {
      const x = (px + (sx + 0.5) / n - tx) / scale
      const y = (py + (sy + 0.5) / n - ty) / scale
      if (pointInPolygon(x, y)) hits++
    }
  }
  return hits / (n * n)
}

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v)

/* ── Layout ──────────────────────────────────────────────────────────────── */

/*
 * The mark is authored against a 512 grid, and `fit` is the share of that grid
 * the bolt's bounding box takes up.
 *
 * Maskable icons are cropped by the launcher, so their artwork has to stay
 * inside the central 80% circle: a box of side s centred on the icon has its
 * corners at s * sqrt(1 + (h/w)^2) / 2, which for this bolt's 33.13 x 31.89
 * proportions means s <= 0.575 of the canvas. Anything larger loses the tips of
 * the bolt to the mask.
 */
const GRID = 512
const FIT = { any: 0.8, maskable: 0.575, apple: 0.7 }
const TILE_RADIUS = 112

/** Maps source-artwork coordinates onto the 512 grid for a given `fit`. */
function layout(fit) {
  const scale = (GRID * fit) / (BOLT_MAX_X - BOLT_MIN_X)
  return {
    scale,
    tx: (GRID - (BOLT_MAX_X - BOLT_MIN_X) * scale) / 2 - BOLT_MIN_X * scale,
    ty: (GRID - (BOLT_MAX_Y - BOLT_MIN_Y) * scale) / 2 - BOLT_MIN_Y * scale,
  }
}

/** The same point, in the mark's own 512-grid coordinates. */
function inGrid(x, y, l) {
  return [l.scale * x + l.tx, l.scale * y + l.ty]
}

/** `fit` as a fraction of the grid, for callers drawing at other sizes. */
function layoutFor(size, fit) {
  const l = layout(fit)
  const k = size / GRID
  return { scale: l.scale * k, tx: l.tx * k, ty: l.ty * k }
}

/* ── Raster icon ──────────────────────────────────────────────────────────── */

/**
 * Draws the mark on a white tile. `rounded` keeps the app's existing rounded
 * square silhouette; maskable icons must fill the whole square so their corners
 * stay square and only the bolt is inset.
 */
function drawIcon(size, { fit = FIT.any, rounded = true } = {}) {
  const canvas = createCanvas(size)
  const k = size / GRID
  const l = layoutFor(size, fit)
  const white = [0xff, 0xff, 0xff]

  // The white ground first, so the bolt composites over it and its own edge is
  // the edge that gets anti-aliased.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = rounded ? roundedRectCoverage(x, y, 0, 0, size, size, TILE_RADIUS * k) : 1
      blend(canvas, x, y, white, a)
    }
  }

  // The bolt, colour sampled per pixel so the gradient stays smooth at 512.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = boltCoverage(x, y, l)
      if (a > 0) {
        blend(canvas, x, y, fillAt((x + 0.5 - l.tx) / l.scale, (y + 0.5 - l.ty) / l.scale), a)
      }
    }
  }

  return canvas
}

/* ── Downsample + PNG encode ──────────────────────────────────────────────── */

function downsample(canvas, factor) {
  const out = createCanvas(canvas.size / factor)
  for (let y = 0; y < out.size; y++) {
    for (let x = 0; x < out.size; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < factor; sy++) {
        for (let sx = 0; sx < factor; sx++) {
          const i = ((y * factor + sy) * canvas.size + (x * factor + sx)) * 4
          const alpha = canvas.data[i + 3] / 255
          r += canvas.data[i] * alpha
          g += canvas.data[i + 1] * alpha
          b += canvas.data[i + 2] * alpha
          a += alpha
        }
      }
      const n = factor * factor
      const o = (y * out.size + x) * 4
      out.data[o] = a > 0 ? r / a : 0
      out.data[o + 1] = a > 0 ? g / a : 0
      out.data[o + 2] = a > 0 ? b / a : 0
      out.data[o + 3] = (a / n) * 255
    }
  }
  return out
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePng(canvas) {
  const { size, data } = canvas
  // One filter byte (0 = None) per scanline, then RGBA.
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1)
    raw[rowStart] = 0
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const o = rowStart + 1 + x * 4
      raw[o] = Math.round(clamp255(data[i]))
      raw[o + 1] = Math.round(clamp255(data[i + 1]))
      raw[o + 2] = Math.round(clamp255(data[i + 2]))
      raw[o + 3] = Math.round(clamp255(data[i + 3]))
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  ihdr[10] = 0 // deflate
  ihdr[11] = 0 // adaptive filtering
  ihdr[12] = 0 // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ── Vector marks ─────────────────────────────────────────────────────────── */

const hex = (v) => Math.round(clamp255(v)).toString(16).padStart(2, '0')
const rgb = (c) => '#' + c.map(hex).join('')

/**
 * The shared body of the SVG marks: a white tile and the bolt on it, both
 * described in the 512 grid.
 */
function markSvgBody({ id, rounded }) {
  const l = layout(FIT.any)
  const [x1, y1] = inGrid(FILL.tFrom * FILL.axis[0], FILL.tFrom * FILL.axis[1], l)
  const [x2, y2] = inGrid(FILL.tTo * FILL.axis[0], FILL.tTo * FILL.axis[1], l)
  const path = BOLT.map(([x, y], i) => {
    const [px, py] = inGrid(x, y, l)
    return `${i === 0 ? 'M' : 'L'}${px.toFixed(2)} ${py.toFixed(2)}`
  }).join('')
  return `  <defs>
    <linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}">
      <stop offset="0" stop-color="${rgb(FILL.from)}" />
      <stop offset="1" stop-color="${rgb(FILL.to)}" />
    </linearGradient>
  </defs>

  ${rounded ? `<rect width="${GRID}" height="${GRID}" rx="${TILE_RADIUS}" fill="#ffffff" />` : `<rect width="${GRID}" height="${GRID}" fill="#ffffff" />`}

  <!-- The lightning bolt, traced from the source artwork. -->
  <path fill="url(#${id})" d="${path}Z" />`
}

function iconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" width="${GRID}" height="${GRID}">
${markSvgBody({ id: 'bolt', rounded: true })}
</svg>
`
}

function faviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}">
${markSvgBody({ id: 'bolt', rounded: true })}
</svg>
`
}

/* ── Write the set ────────────────────────────────────────────────────────── */

mkdirSync(OUT_DIR, { recursive: true })

writeFileSync(join(OUT_DIR, 'icon.svg'), iconSvg())
writeFileSync(join(OUT_DIR, 'favicon.svg'), faviconSvg())
console.log('icon.svg, favicon.svg')

const targets = [
  { file: 'icon-192.png', size: 192, fit: FIT.any, rounded: true },
  { file: 'icon-512.png', size: 512, fit: FIT.any, rounded: true },
  { file: 'icon-maskable-192.png', size: 192, fit: FIT.maskable, rounded: false },
  { file: 'icon-maskable-512.png', size: 512, fit: FIT.maskable, rounded: false },
  { file: 'apple-touch-icon.png', size: 180, fit: FIT.apple, rounded: false },
]

for (const { file, size, fit, rounded } of targets) {
  const canvas = downsample(drawIcon(size * SS, { fit, rounded }), SS)
  const png = encodePng(canvas)
  writeFileSync(join(OUT_DIR, file), png)
  console.log(`${file.padEnd(26)} ${size}x${size}  ${(png.length / 1024).toFixed(1)} kB`)
}

console.log('\nWrote', targets.length + 2, 'files to public/')