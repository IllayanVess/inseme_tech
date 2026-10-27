const headingSelector = 'h1, h2, h3, h4, h5, h6'

function focusHashTarget(page) {
  const encodedId = window.location.hash.slice(1)
  if (!encodedId) return

  let id
  try {
    id = decodeURIComponent(encodedId)
  } catch {
    return
  }

  const section = document.getElementById(id)
  if (!section || !page.contains(section)) return

  const target = section.matches(headingSelector)
    ? section
    : section.querySelector(headingSelector) || section

  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
}

export function initializeAboutPage() {
  const page = document.querySelector('.about-page')
  if (!page) return

  window.addEventListener('hashchange', () => focusHashTarget(page))

  if (window.location.hash) {
    requestAnimationFrame(() => focusHashTarget(page))
  }
}
