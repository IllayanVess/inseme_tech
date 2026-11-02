import { isSupabaseConfigured } from '../../lib/supabase.js'
import { getPublishedAssociationPage, getPublishedAssociations } from '../../services/association-content.js'

const isEnglish = document.documentElement.lang === 'en'
const locale = isEnglish ? 'en-GB' : 'fr-FR'
const pathMatch = window.location.pathname.match(/^\/(en\/)?associations\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/)

const copy = isEnglish
  ? {
      loading: 'Loading association…',
      unavailable: 'This association page is temporarily unavailable. Please try again later.',
      notConfigured: 'Association pages are not configured yet.',
      notFound: 'This association page is not available.',
      intro: 'About',
      mission: 'Our mission',
      events: 'Upcoming events',
      noEvents: 'No upcoming events have been published yet.',
      directoryTitle: 'Associations',
      directoryDescription: 'Discover the associations sharing projects, skills, and opportunities.',
      directoryUnavailable: 'The association directory is temporarily unavailable.',
      directoryEmpty: 'No association pages have been published yet.',
      team: 'Our team',
      sectionContent: 'Learn more',
      links: 'Follow and learn more',
      contact: 'Contact',
      date: 'Date',
      eventStatus: { planned: 'Planned', open: 'Registration open', full: 'Full' },
      eventCategory: {
        programming: 'Programming', data_ai: 'Data and AI', robotics: 'Robotics',
        creative_technology: 'Creative technology', professional_development: 'Professional development',
        community: 'Community',
      },
      home: 'Home', about: 'About us', activities: 'Activities', account: 'My account',
      languageLabel: 'Choose language',
      localSlugError: 'The association address is invalid.',
    }
  : {
      loading: 'Chargement de l’association…',
      unavailable: 'Cette page est momentanément indisponible. Réessayez plus tard.',
      notConfigured: 'Les pages des associations ne sont pas encore configurées.',
      notFound: 'Cette page d’association est introuvable.',
      intro: 'Présentation',
      mission: 'Notre mission',
      events: 'Événements à venir',
      noEvents: 'Aucun événement à venir n’a été publié.',
      directoryTitle: 'Associations',
      directoryDescription: 'Découvrez les associations qui partagent projets, compétences et opportunités.',
      directoryUnavailable: 'L’annuaire des associations est momentanément indisponible.',
      directoryEmpty: 'Aucune page d’association n’a encore été publiée.',
      team: 'Notre équipe',
      sectionContent: 'En savoir plus',
      links: 'Suivre et en savoir plus',
      contact: 'Contact',
      date: 'Date',
      eventStatus: { planned: 'Prévu', open: 'Inscriptions ouvertes', full: 'Complet' },
      eventCategory: {
        programming: 'Programmation', data_ai: 'Data et IA', robotics: 'Robotique',
        creative_technology: 'Technologies créatives', professional_development: 'Ouverture professionnelle',
        community: 'Vie étudiante',
      },
      home: 'Accueil', about: 'Qui sommes-nous ?', activities: 'Nos activités', account: 'Mon compte',
      languageLabel: 'Choisir la langue',
      localSlugError: 'L’adresse de cette association est invalide.',
    }

const appendText = (parent, tag, className, value) => {
  if (!value) return null
  const element = document.createElement(tag)
  if (className) element.className = className
  element.textContent = value
  parent.append(element)
  return element
}

const localized = (record, field) => record[`${field}_${isEnglish ? 'en' : 'fr'}`]

const safeHttpsUrl = (value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

const formatDate = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(date)
}

const createEventCard = (event) => {
  const card = document.createElement('article')
  card.className = 'association-event-card'
  const detail = document.createElement('div')
  detail.className = 'association-event-detail'
  appendText(detail, 'span', 'eyebrow', copy.eventCategory[event.category] || event.category)
  appendText(detail, 'h3', '', localized(event, 'title'))
  appendText(detail, 'p', '', localized(event, 'summary'))
  card.append(detail)

  const metadata = document.createElement('p')
  metadata.className = 'association-event-meta'
  const status = copy.eventStatus[event.event_status] || event.event_status
  const date = formatDate(event.starts_at)
  metadata.textContent = [date, status].filter(Boolean).join(' · ')
  card.append(metadata)
  return card
}

const renderAssociation = (page, data) => {
  const status = page.querySelector('[data-association-status]')
  const content = page.querySelector('[data-association-content]')
  const { association, socialLinks, events, sections, team } = data

  if (!association) {
    status.textContent = copy.notFound
    return
  }

  document.title = `${association.name} — PSTB Tech`
  const description = localized(association, 'introduction') || association.name
  document.querySelector('meta[name="description"]')?.setAttribute('content', description)
  const accent = ['indigo', 'cyan', 'violet', 'blue'].includes(association.theme_accent)
    ? association.theme_accent
    : 'indigo'
  content.dataset.accent = accent
  status.hidden = true
  content.hidden = false
  page.querySelector('[data-association-hero]').hidden = false

  const nameHeading = page.querySelector('[data-association-name]')
  nameHeading.replaceChildren()
  appendText(nameHeading, 'span', '', association.name)
  appendText(page.querySelector('[data-association-introduction]'), 'p', '', description)
  const media = page.querySelector('[data-association-brand-media]')
  if (association.logo_url) {
    const logo = document.createElement('img')
    logo.className = 'association-logo'
    logo.src = association.logo_url
    logo.alt = localized(association, 'logo_alt') || association.name
    media.append(logo)
  }
  if (association.cover_url) {
    const cover = document.createElement('img')
    cover.className = 'association-cover'
    cover.src = association.cover_url
    cover.alt = localized(association, 'cover_alt') || ''
    media.append(cover)
  }

  const mission = localized(association, 'mission')
  if (mission) {
    const section = page.querySelector('[data-association-mission-section]')
    appendText(section.querySelector('[data-association-mission]'), 'p', '', mission)
    section.hidden = false
  }

  ;(sections || []).forEach((section) => {
    const localizedContent = isEnglish ? section.content_en : section.content_fr
    const block = document.createElement('section')
    block.className = 'association-section wrap association-custom-section'
    block.dataset.sectionType = section.section_type
    const title = localizedContent?.title
    if (typeof title === 'string' && title.trim()) {
      appendText(block, 'p', 'eyebrow', copy.sectionContent)
      appendText(block, 'h2', '', title)
    }
    const body = localizedContent?.body
    if (typeof body === 'string' && body.trim()) appendText(block, 'p', 'association-section-copy', body)
    content.insertBefore(block, page.querySelector('[data-association-events-heading]').closest('section'))
  })

  const eventList = page.querySelector('[data-association-events]')
  if (events.length) events.forEach((event) => eventList.append(createEventCard(event)))
  else appendText(eventList, 'p', 'association-empty', copy.noEvents)

  const linksList = page.querySelector('[data-association-links]')
  socialLinks.forEach((link) => {
    const href = safeHttpsUrl(link.url)
    if (!href) return
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.rel = 'noopener noreferrer'
    anchor.textContent = localized(link, 'label') || link.platform
    linksList.append(anchor)
  })
  if (association.website_url) {
    const href = safeHttpsUrl(association.website_url)
    if (href) {
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.rel = 'noopener noreferrer'
      anchor.textContent = isEnglish ? 'Website' : 'Site web'
      linksList.prepend(anchor)
    }
  }
  if (linksList.childElementCount) page.querySelector('[data-association-links-section]').hidden = false

  const contacts = page.querySelector('[data-association-contact]')
  if (association.public_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(association.public_email)) {
    const email = document.createElement('a')
    email.href = `mailto:${association.public_email}`
    email.textContent = association.public_email
    contacts.append(email)
  }
  if (association.public_phone) {
    appendText(contacts, 'span', '', association.public_phone)
    const phone = association.public_phone.replace(/[^\d+]/g, '')
    if (/^\+?\d{6,15}$/.test(phone)) {
      const link = document.createElement('a')
      link.href = `tel:${phone}`
      link.textContent = isEnglish ? 'Call' : 'Appeler'
      contacts.append(link)
    }
  }
  if (contacts.childElementCount) page.querySelector('[data-association-contact-section]').hidden = false

  const teamList = page.querySelector('[data-association-team]')
  ;(team || []).forEach(({ position, profile }) => {
    const card = document.createElement('article')
    card.className = 'association-team-card'
    appendText(card, 'h3', '', localized(position, 'title'))
    appendText(card, 'p', 'association-team-name', profile.display_name)
    const responsibility = localized(position, 'responsibility')
    const tasks = localized(position, 'tasks')
    if (responsibility) appendText(card, 'p', '', responsibility)
    if (tasks) appendText(card, 'p', 'association-team-tasks', tasks)
    teamList.append(card)
  })
  if (teamList.childElementCount) page.querySelector('[data-association-team-section]').hidden = false
}

function renderDirectory(page, associations) {
  const status = page.querySelector('[data-association-status]')
  const directory = page.querySelector('[data-association-directory]')
  const list = page.querySelector('[data-association-directory-list]')
  document.title = `${copy.directoryTitle} — PSTB Tech`
  document.querySelector('meta[name="description"]')?.setAttribute('content', copy.directoryDescription)
  status.hidden = true
  directory.hidden = false

  if (!associations.length) {
    appendText(list, 'p', 'association-empty', copy.directoryEmpty)
    return
  }

  associations.forEach((association) => {
    const card = document.createElement('article')
    card.className = 'association-directory-card'
    const link = document.createElement('a')
    link.href = `${isEnglish ? '/en' : ''}/associations/${encodeURIComponent(association.slug)}/`
    appendText(link, 'h2', '', association.name)
    appendText(link, 'p', '', localized(association, 'introduction') || '')
    const accent = ['indigo', 'cyan', 'violet', 'blue'].includes(association.theme_accent)
      ? association.theme_accent
      : 'indigo'
    link.dataset.accent = accent
    card.append(link)
    list.append(card)
  })
}

export function initializeAssociationPage() {
  const page = document.querySelector('[data-association-page]')
  if (!page) return

  const slug = pathMatch?.[2]
  if (slug) {
    const frenchPath = `/associations/${slug}/`
    const englishPath = `/en${frenchPath}`
    const languageLinks = page.querySelectorAll('[data-language-fr], [data-language-en]')
    languageLinks.forEach((link) => {
      link.href = link.dataset.languageFr !== undefined ? frenchPath : englishPath
    })
  }

  const status = page.querySelector('[data-association-status]')
  if (!pathMatch) {
    if (!/^\/(en\/)?associations\/?$/.test(window.location.pathname)) {
      status.textContent = copy.localSlugError
      return
    }
    if (!isSupabaseConfigured) {
      status.textContent = copy.notConfigured
      return
    }
    status.textContent = copy.loading
    getPublishedAssociations()
      .then((associations) => renderDirectory(page, associations || []))
      .catch((error) => {
        console.error('Association directory could not be loaded:', error)
        status.textContent = copy.directoryUnavailable
      })
    return
  }
  if (!isSupabaseConfigured) {
    status.textContent = copy.notConfigured
    return
  }

  const slugValue = pathMatch[2]
  getPublishedAssociationPage(slugValue)
    .then((result) => renderAssociation(page, result))
    .catch((error) => {
      console.error('Association page could not be loaded:', error)
      status.textContent = copy.unavailable
    })
}
