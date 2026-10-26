import './style.css'

const menuButton = document.querySelector('.menu-toggle')
const siteNav = document.querySelector('#site-nav')

menuButton?.addEventListener('click', () => {
  const isExpanded = menuButton.getAttribute('aria-expanded') === 'true'
  menuButton.setAttribute('aria-expanded', String(!isExpanded))
  menuButton.setAttribute('aria-label', isExpanded ? 'Ouvrir le menu' : 'Fermer le menu')
  siteNav?.classList.toggle('is-open', !isExpanded)
})

siteNav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    menuButton?.setAttribute('aria-expanded', 'false')
    menuButton?.setAttribute('aria-label', 'Ouvrir le menu')
    siteNav.classList.remove('is-open')
  })
})
