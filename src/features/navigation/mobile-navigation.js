export function initializeMobileNavigation() {
  const menuButton = document.querySelector('.menu-toggle')
  const siteNav = document.querySelector('#site-nav')
  if (!menuButton || !siteNav) return

  const labels = document.documentElement.lang === 'en'
    ? { open: 'Open menu', close: 'Close menu' }
    : { open: 'Ouvrir le menu', close: 'Fermer le menu' }

  menuButton.addEventListener('click', () => {
    const isExpanded = menuButton.getAttribute('aria-expanded') === 'true'
    menuButton.setAttribute('aria-expanded', String(!isExpanded))
    menuButton.setAttribute('aria-label', isExpanded ? labels.open : labels.close)
    siteNav.classList.toggle('is-open', !isExpanded)
  })

  siteNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menuButton.setAttribute('aria-expanded', 'false')
      menuButton.setAttribute('aria-label', labels.open)
      siteNav.classList.remove('is-open')
    })
  })
}
