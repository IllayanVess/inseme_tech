import { isSupabaseConfigured } from '../../lib/supabase.js'
import {
  getPublishedAssociationMembers,
  getPublishedAssociationPage,
  getPublishedMemberProfile,
} from '../../services/association-content.js'

const isEnglish = document.documentElement.lang === 'en'
const locale = isEnglish ? 'en-GB' : 'fr-FR'
const pathMatch = window.location.pathname.match(/^\/(en\/)?associations\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/members(?:\/([a-z0-9]+(?:-[a-z0-9]+)*))?)?\/?$/)
const isMemberDirectory = Boolean(pathMatch && /\/members\/?$/.test(window.location.pathname))
const memberSlug = pathMatch?.[3]

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
      members: 'Our members',
      memberListEmpty: 'No members have chosen to publish a profile yet.',
      memberUnavailable: 'This member profile is not available.',
      backToAssociation: 'Back to association',
      backToMembers: 'Back to members',
      meetMembers: 'Meet our members',
      bio: 'About',
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
      members: 'Nos membres',
      memberListEmpty: 'Aucun membre n’a encore choisi de publier son profil.',
      memberUnavailable: 'Ce profil de membre est introuvable.',
      backToAssociation: 'Retour à l’association',
      backToMembers: 'Retour aux membres',
      meetMembers: 'Découvrir les membres',
      bio: 'Présentation',
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
  const { association, socialLinks, events } = data

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
  const mission = localized(association, 'mission')
  if (mission) {
    const section = page.querySelector('[data-association-mission-section]')
    appendText(section.querySelector('[data-association-mission]'), 'p', '', mission)
    section.hidden = false
  }

  const eventList = page.querySelector('[data-association-events]')
  if (events.length) events.forEach((event) => eventList.append(createEventCard(event)))
  else appendText(eventList, 'p', 'association-empty', copy.noEvents)

  const memberDirectoryPath = `${isEnglish ? '/en' : ''}/associations/${encodeURIComponent(association.slug)}/members/`
  const directoryLink = page.querySelector('[data-member-directory-link]')
  directoryLink.href = memberDirectoryPath
  directoryLink.textContent = copy.meetMembers
  const memberDirectorySection = page.querySelector('[data-member-directory-section]')
  memberDirectorySection.querySelector('[data-member-back-link]').href = `${isEnglish ? '/en' : ''}/associations/${encodeURIComponent(association.slug)}/`
  memberDirectorySection.querySelector('[data-member-back-link]').textContent = copy.backToAssociation
  const memberProfileSection = page.querySelector('[data-member-profile-section]')
  memberProfileSection.querySelector('[data-member-back-link]').href = memberDirectoryPath
  memberProfileSection.querySelector('[data-member-back-link]').textContent = copy.backToMembers

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
}

export function initializeAssociationPage() {
  const page = document.querySelector('[data-association-page]')
  if (!page) return

  const slug = pathMatch?.[2]
  if (slug) {
    const frenchPath = `${window.location.pathname.replace(/^\/en(?=\/)/, '').replace(/\/?$/, '/')}`
    const englishPath = `/en${frenchPath}`
    const languageLinks = page.querySelectorAll('[data-language-fr], [data-language-en]')
    languageLinks.forEach((link) => {
      link.href = link.dataset.languageFr !== undefined ? frenchPath : englishPath
    })
  }

  const status = page.querySelector('[data-association-status]')
  if (!pathMatch) {
    status.textContent = copy.localSlugError
    return
  }
  if (!isSupabaseConfigured) {
    status.textContent = copy.notConfigured
    return
  }

  const associationSlug = pathMatch[2]
  const loadPage = memberSlug
    ? getPublishedMemberProfile(associationSlug, memberSlug).then((result) => {
      renderAssociation(page, { association: result.association, socialLinks: [], events: [] })
      if (!result.association || !result.member) {
        status.hidden = false
        status.textContent = copy.memberUnavailable
        page.querySelector('[data-association-content]').hidden = true
        page.querySelector('[data-association-hero]').hidden = true
        return
      }

      page.querySelector('[data-association-overview]').hidden = true
      const section = page.querySelector('[data-member-profile-section]')
      section.hidden = false
      const name = result.member.display_name
      const bio = localized(result.member, 'bio')
      section.querySelector('[data-member-name]').textContent = name
      const description = bio || name
      document.title = `${name} — ${result.association.name} — PSTB Tech`
      document.querySelector('meta[name="description"]')?.setAttribute('content', description)
      if (bio) appendText(section.querySelector('[data-member-bio]'), 'p', '', bio)
    })
    : isMemberDirectory
      ? getPublishedAssociationMembers(associationSlug).then((result) => {
        renderAssociation(page, { association: result.association, socialLinks: [], events: [] })
        if (!result.association) return

        page.querySelector('[data-association-overview]').hidden = true
        const section = page.querySelector('[data-member-directory-section]')
        section.hidden = false
        document.title = `${copy.members} — ${result.association.name} — PSTB Tech`
        document.querySelector('meta[name="description"]')?.setAttribute('content', `${copy.members} — ${result.association.name}`)

        const list = page.querySelector('[data-member-list]')
        if (!result.members.length) {
          appendText(list, 'p', 'association-empty', copy.memberListEmpty)
          return
        }

        result.members.forEach((member) => {
          const card = document.createElement('article')
          card.className = 'association-member-card'
          const link = document.createElement('a')
          link.href = `${window.location.pathname.replace(/\/?$/, '/')}${encodeURIComponent(member.slug)}/`
          appendText(link, 'h3', '', member.display_name)
          const bio = localized(member, 'bio')
          if (bio) appendText(link, 'p', '', bio)
          card.append(link)
          list.append(card)
        })
      })
      : getPublishedAssociationPage(associationSlug).then((result) => renderAssociation(page, result))

  loadPage.catch(() => { status.textContent = copy.unavailable })
}
