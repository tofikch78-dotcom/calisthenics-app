/**
 * Fitting a value read back out of storage into the shape the app expects.
 *
 * All of this app's data lives on the device and nowhere else, so a value that
 * does not fit its expected shape is not a cosmetic problem: there is no server
 * copy to fall back to and no account to re-sync from, and the usual result is
 * an unhandled render error and a blank window the user cannot get out of. Real
 * ways that happens:
 *
 *   - a build that adds a field, and a profile written by the build before it
 *   - an imported or hand-edited backup file
 *   - a half-written value from another tab
 *
 * Arrays are held to actually being arrays, objects get the defaults filled in
 * underneath whatever was stored, and a scalar has to keep its type. Anything
 * unrecognisable falls back to the default, so the app always starts.
 *
 * It lives in its own module because it has no dependencies at all, and because
 * getting it wrong is silent: a key that reads back empty looks exactly like a
 * key that was never written, so the only defence is a test.
 */
export function reconcile<T>(stored: unknown, fallback: T): T {
  if (Array.isArray(fallback)) return (Array.isArray(stored) ? stored : fallback) as T

  const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

  if (isPlainObject(fallback)) {
    // A non-object stored value (null, an array, a stray number) carries no
    // usable fields, so the defaults are better than whatever it claimed.
    return (isPlainObject(stored) ? { ...fallback, ...stored } : fallback) as T
  }

  /*
   * `null` means "nothing stored yet", not "a value of type object".
   *
   * `typeof null` is 'object', so comparing types against a null fallback
   * rejects every scalar that was actually written — including the active
   * session id, which is the entire reason that key exists. The id came back as
   * null on every mount, the persist effect then rewrote the good value as the
   * string "null", and reopening the app lost the pointer for good. A stored
   * value of any type is therefore accepted against a null fallback.
   */
  if (fallback === null) return (stored ?? null) as T

  return (typeof stored === typeof fallback ? (stored as T) : fallback)
}