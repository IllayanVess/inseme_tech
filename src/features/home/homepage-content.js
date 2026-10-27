import { isSupabaseConfigured } from '../../lib/supabase.js'
import {
  getLatestAnnouncement,
  getLatestProject,
  getUpcomingEvent,
} from '../../services/public-content.js'

const isEnglish = document.documentElement.lang === 'en'

const fields = isEnglish
  ? { title: 'title_en', summary: 'summary_en', description: 'description_en', location: 'location_en', body: 'body_en' }
  : { title: 'title_fr', summary: 'summary_fr', description: 'description_fr', location: 'location_fr', body: 'body_fr' }

const labels = isEnglish
  ? {
      event: 'UPCOMING EVENT',
      project: 'STUDENT PROJECT',
      announcement: 'LATEST ANNOUNCEMENT',
      unavailable: 'Content is temporarily unavailable.',
      unavailableStatus: 'TEMPORARILY UNAVAILABLE',
      locale: 'en-GB',
    }
  : {
      event: 'PROCHAIN ÉVÉNEMENT',
      project: 'PROJET ÉTUDIANT',
      announcement: 'DERNIÈRE ANNONCE',
      unavailable: 'Le contenu est momentanément indisponible.',
      unavailableStatus: 'INDISPONIBLE POUR LE MOMENT',
      locale: 'fr-FR',
    }

const formatDate = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(labels.locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const appendText = (parent, tagName, className, value) => {
  if (!value) return

  const element = document.createElement(tagName)
  element.className = className
  element.textContent = value
  parent.append(element)
}

const showUnavailable = (card) => {
  const body = card.querySelector('[data-home-content-body]')
  const status = card.querySelector('[data-home-content-status]')
  if (!body || !status) return

  body.replaceChildren()
  appendText(body, 'p', 'update-copy', labels.unavailable)
  status.textContent = labels.unavailableStatus
}

const showPublishedItem = (card, item, options) => {
  const body = card.querySelector('[data-home-content-body]')
  const status = card.querySelector('[data-home-content-status]')
  if (!body || !status) return

  body.replaceChildren()
  appendText(body, 'h4', 'content-title', item[fields.title])
  appendText(body, 'p', 'update-copy', options.summary || '')

  if (options.date) {
    const time = document.createElement('time')
    time.className = 'content-meta'
    time.dateTime = options.date
    time.textContent = formatDate(options.date)
    body.append(time)
  }

  appendText(body, 'p', 'content-meta', options.location)
  status.textContent = options.status
}

const contentCards = [
  {
    selector: '[data-home-content="event"]',
    load: getUpcomingEvent,
    options: (event) => ({
      summary: event[fields.summary] || event[fields.description],
      date: event.starts_at,
      location: event[fields.location],
      status: labels.event,
    }),
  },
  {
    selector: '[data-home-content="project"]',
    load: getLatestProject,
    options: (project) => ({
      summary: project[fields.summary] || project[fields.description],
      status: labels.project,
    }),
  },
  {
    selector: '[data-home-content="announcement"]',
    load: getLatestAnnouncement,
    options: (announcement) => ({
      summary: announcement[fields.summary] || announcement[fields.body],
      status: labels.announcement,
    }),
  },
]

export async function initializeHomepageContent() {
  if (!isSupabaseConfigured) return

  const now = new Date().toISOString()
  await Promise.all(contentCards.map(async ({ selector, load, options }) => {
    const card = document.querySelector(selector)
    if (!card) return

    try {
      const item = await load(now)
      if (item) showPublishedItem(card, item, options(item))
    } catch {
      showUnavailable(card)
    }
  }))
}
