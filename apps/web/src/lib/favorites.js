export const LIKED_PROJECTS_KEY = 'touchstone-liked-projects'
export const FABLE5_FAVORITES_KEY = 'touchstone-fable5-favorites'
export const FAVORITES_CHANGED_EVENT = 'touchstone:favorites-changed'

export function readFavoriteSet(key) {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'))
  } catch {
    return new Set()
  }
}

export function writeFavoriteSet(key, set) {
  localStorage.setItem(key, JSON.stringify([...set]))
  window.dispatchEvent(new CustomEvent(FAVORITES_CHANGED_EVENT, { detail: { key } }))
}
