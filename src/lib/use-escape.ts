import { useEffect } from 'react'

/**
 * Escape-to-dismiss for a modal overlay.
 *
 * A modal the keyboard cannot leave is a dead end: with a Bluetooth or hardware
 * keyboard on a phone, and for anyone driving the app by screen reader, Escape
 * is the reflex and the only way out that does not require hunting for the
 * close button. Every overlay in the app already closes on a backdrop tap, so
 * this only adds the key path and changes nothing about how one looks.
 *
 * It listens on the document rather than on the overlay element because the
 * overlay itself is not focused — nothing inside it holds focus until the user
 * taps — and a key event only reaches an ancestor of whatever *is* focused.
 *
 * Lives here rather than beside the overlays so it stays importable without
 * pulling in a component module, and so a file that exports components only
 * exports components.
 */
export function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])
}
