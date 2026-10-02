/**
 * Generates the PWA icon set as real PNGs, with no image dependencies.
 *
 * The artwork is rasterised in plain JS — rounded rects, circles and thick
 * lines — at 4x and then box-downsampled, which is what gives the edges their
 * anti-aliasing. PNG encoding is done by hand (IHDR/IDAT/IEND + CRC32) on top
 * of Node's built-in zlib.
 *
 * Run with:  node scripts/generate-icons.mjs
 */

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const SS = 4 // supersampling factor

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

function circleCoverage(px, py, cx, cy, r) {
  let hits = 0
  for (let sy = 0; sy < 3; sy++) {
    for (let sx = 0; sx < 3; sx++) {
      const dx = px + (sx + 0.5) / 3 - cx
      const dy = py + (sy + 0.5) / 3 - cy
      if (dx * dx + dy * dy <= r * r) hits++
    }
  }
  return hits / 9
}

function segmentCoverage(px, py, x1, y1, x2, y2, halfWidth) {
  let hits = 0
  for (let sy = 0; sy < 3; sy++) {
    for (let sx = 0; sx < 3; sx++) {
      const x = px + (sx + 0.5) / 3
      const y = py + (sy + 0.5) / 3
      const vx = x2 - x1
      const vy = y2 - y1
      const t = Math.max(0, Math.min(1, ((x - x1) * vx + (y - y1) * vy) / (vx * vx + vy * vy)))
      const dx = x - (x1 + t * vx)
      const dy = y - (y1 + t * vy)
      if (dx * dx + dy * dy <= halfWidth * halfWidth) hits++
    }
  }
  return hits / 9
}

function lerp(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]
}

/* ── The artwork ──────────────────────────────────────────────────────────── */

const TOP = [0x16, 0x1b, 0x28]
const BOTTOM = [0x07, 0x09, 0x0f]
const BAR_TOP = [0x38, 0xbd, 0xf8]
const BAR_BOTTOM = [0x22, 0xd3, 0xee]
const STEEL = [0x2b, 0x34, 0x46]
const BODY = [0xe8, 0xee, 0xf8]

/**
 * `inset` shrinks the foreground relative to the full-bleed background, which
 * is what Android's maskable icon safe zone needs — an adaptive icon crops the
 * square, so artwork has to stay inside the middle 80%.
 */
function drawIcon(size, { maskable = false } = {}) {
  const canvas = createCanvas(size)
  const s = size / 512 // artwork is authored against a 512 grid
  const k = maskable ? 0.8 : 1
  const c = 256 * s // centre, in device pixels

  // Background: full-bleed rounded square. Maskable icons must fill the whole
  // square, so the corners stay square for them and get rounded for the rest.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const bg = lerp(TOP, BOTTOM, y / size)
      if (maskable) {
        blend(canvas, x, y, bg, 1)
      } else {
        const a = roundedRectCoverage(x, y, 0, 0, size, size, 112 * s)
        blend(canvas, x, y, bg, a)
      }
    }
  }

  const barY = c - 138 * s * k
  const barHalf = 150 * s * k
  const barHalfH = 11 * s * k

  // Ground line.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = roundedRectCoverage(x, y, c - barHalf, c + 118 * s * k, barHalf * 2, 5 * s * k, 2.5 * s * k)
      blend(canvas, x, y, STEEL, a)
    }
  }

  // Vertical posts.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = roundedRectCoverage(x, y, c - 130 * s * k, barY, 8 * s * k, 70 * s * k, 4 * s * k)
      blend(canvas, x, y, STEEL, a)
      blend(canvas, x, y, STEEL, roundedRectCoverage(x, y, c + 122 * s * k, barY, 8 * s * k, 70 * s * k, 4 * s * k))
    }
  }

  // Horizontal bar.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = roundedRectCoverage(x, y, c - barHalf, barY - barHalfH, barHalf * 2, barHalfH * 2, barHalfH)
      if (a > 0) blend(canvas, x, y, lerp(BAR_TOP, BAR_BOTTOM, (y - (barY - barHalfH)) / (barHalfH * 2)), a)
    }
  }

  // Head.
  const headR = 24 * s * k
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      blend(canvas, x, y, BAR_TOP, circleCoverage(x, y, c, barY - 30 * s * k, headR))
    }
  }

  // Figure: arms up to the bar, shoulders, torso, legs.
  const armTop = barY - 2 * s * k
  const shoulderY = barY + 32 * s * k
  const hipY = barY + 84 * s * k
  const footY = barY + 146 * s * k
  const stroke = 10 * s * k
  const strokes = [
    [c - 50 * s * k, armTop, c - 50 * s * k, shoulderY],
    [c + 50 * s * k, armTop, c + 50 * s * k, shoulderY],
    [c - 50 * s * k, shoulderY, c + 50 * s * k, shoulderY],
    [c, barY - 6 * s * k, c, hipY],
    [c, hipY, c - 44 * s * k, footY],
    [c, hipY, c + 44 * s * k, footY],
  ]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      for (const [x1, y1, x2, y2] of strokes) {
        blend(canvas, x, y, BODY, segmentCoverage(x, y, x1, y1, x2, y2, stroke))
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
      raw[o] = Math.round(Math.min(255, Math.max(0, data[i])))
      raw[o + 1] = Math.round(Math.min(255, Math.max(0, data[i + 1])))
      raw[o + 2] = Math.round(Math.min(255, Math.max(0, data[i + 2])))
      raw[o + 3] = Math.round(Math.min(255, Math.max(0, data[i + 3])))
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

/* ── Write the set ────────────────────────────────────────────────────────── */

mkdirSync(OUT_DIR, { recursive: true })

const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-192.png', size: 192, maskable: true },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: false },
]

for (const { file, size, maskable } of targets) {
  const canvas = downsample(drawIcon(size * SS, { maskable }), SS)
  const png = encodePng(canvas)
  writeFileSync(join(OUT_DIR, file), png)
  console.log(`${file.padEnd(26)} ${size}x${size}  ${(png.length / 1024).toFixed(1)} kB`)
}

console.log('\nWrote', targets.length, 'icons to public/')
