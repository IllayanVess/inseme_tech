export function initializeMobileNavigation() {
  const menuButton = document.querySelector('.menu-toggle')
  const siteNav = document.querySelector('#site-nav')
  if (!menuButton || !siteNav) return

  const labels = document.documentElement.lang === 'en'
    ? { open: 'Open menu', close: 'Close menu' }
    : { open: 'Ouvrir le menu', close: 'Fermer le menu' }

  const closeMenu = ({ restoreFocus = false } = {}) => {
    menuButton.setAttribute('aria-expanded', 'false')
    menuButton.setAttribute('aria-label', labels.open)
    siteNav.classList.remove('is-open')
    if (restoreFocus) menuButton.focus()
  }

  menuButton.addEventListener('click', () => {
    const isExpanded = menuButton.getAttribute('aria-expanded') === 'true'
    if (isExpanded) {
      closeMenu()
      return
    }

    menuButton.setAttribute('aria-expanded', 'true')
    menuButton.setAttribute('aria-label', labels.close)
    siteNav.classList.add('is-open')
  })

  siteNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => closeMenu())
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
      closeMenu({ restoreFocus: true })
    }
  })

  document.addEventListener('click', (event) => {
    if (menuButton.getAttribute('aria-expanded') !== 'true') return
    if (siteNav.contains(event.target) || menuButton.contains(event.target)) return
    closeMenu()
  })
}
