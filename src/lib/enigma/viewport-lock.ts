/**
 * Keep the Roleta on one mobile viewport, without changing scrolling on other
 * screens. Dialogs still own their internal scrolling.
 */
export const WHEEL_VIEWPORT_LOCK = "enigma-roleta-viewport-locked";

export function lockWheelViewport(doc: Document): () => void {
  const { documentElement, body } = doc;
  documentElement.classList.add(WHEEL_VIEWPORT_LOCK);
  body.classList.add(WHEEL_VIEWPORT_LOCK);

  return () => {
    documentElement.classList.remove(WHEEL_VIEWPORT_LOCK);
    body.classList.remove(WHEEL_VIEWPORT_LOCK);
  };
}
