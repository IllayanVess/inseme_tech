import { fetchTechEvents } from '../../services/tech-events.js'

const savedEventsKey = 'pstb-tech:saved-events:v1'
const refreshIntervalMs = 15 * 60 * 1000
const language = document.documentElement.lang === 'en' ? 'en' : 'fr'
const locale = language === 'en' ? 'en-GB' : 'fr-FR'

const text = language === 'en'
  ? {
      categories: { ai: 'AI & data', cloud: 'Cloud & DevOps', security: 'Cybersecurity', development: 'Development', technology: 'Technology' },
      allCategories: 'All topics',
      allMonths: 'Any month',
      upcoming: 'Upcoming events',
      saved: 'Saved events',
      searchLabel: 'Search events',
      searchPlaceholder: 'Title, city or topic',
      categoryLabel: 'Topic',
      monthLabel: 'Month',
      locationLabel: 'Location',
      allLocations: 'Everywhere',
      refresh: 'Refresh now',
      refreshing: 'Refreshing…',
      showUpcoming: 'Upcoming',
      showSaved: 'Saved',
      eventCount: (count) => `${count} ${count === 1 ? 'event' : 'events'}`,
      noUpcoming: 'No upcoming events match these filters.',
      noSaved: 'You have not saved any events on this device yet.',
      searchError: 'Could not load the event calendar. Try again shortly.',
      refreshedAt: (date) => `Feed checked ${date}`,
      autoRefresh: 'Page refreshes every 15 minutes · source calendar updates daily',
      save: 'Save event',
      unsave: 'Saved · remove',
      calendar: 'Add to calendar',
      details: 'Event details',
      source: 'Source: IP73',
      past: 'Past event',
      sourceLabel: 'Live source calendar',
      sourceDescription: 'This page reads a public iCalendar feed of technology conferences and meetups. The upstream agenda is updated daily; events leave the list after they end. Confirm dates and venue with the organiser before making plans.',
      savedNote: 'Saved events stay in this browser only.',
      sourceUnavailable: 'The event source is not responding right now. Your saved events remain on this device.',
    }
  : {
      categories: { ai: 'IA & data', cloud: 'Cloud & DevOps', security: 'Cybersécurité', development: 'Développement', technology: 'Technologie' },
      allCategories: 'Tous les thèmes',
      allMonths: 'Tous les mois',
      upcoming: 'Événements à venir',
      saved: 'Événements suivis',
      searchLabel: 'Rechercher des événements',
      searchPlaceholder: 'Titre, ville ou thème',
      categoryLabel: 'Thème',
      monthLabel: 'Mois',
      locationLabel: 'Lieu',
      allLocations: 'Partout',
      refresh: 'Actualiser',
      refreshing: 'Actualisation…',
      showUpcoming: 'À venir',
      showSaved: 'Suivis',
      eventCount: (count) => `${count} ${count === 1 ? 'événement' : 'événements'}`,
      noUpcoming: 'Aucun événement à venir ne correspond à ces filtres.',
      noSaved: 'Aucun événement n’est encore enregistré sur cet appareil.',
      searchError: 'Impossible de charger l’agenda. Réessayez dans un instant.',
      refreshedAt: (date) => `Agenda vérifié à ${date}`,
      autoRefresh: 'Actualisation toutes les 15 minutes · agenda source mis à jour chaque jour',
      save: 'Suivre cet événement',
      unsave: 'Suivi · retirer',
      calendar: 'Ajouter au calendrier',
      details: 'Détails de l’événement',
      source: 'Source : IP73',
      past: 'Événement passé',
      sourceLabel: 'Source en direct',
      sourceDescription: 'Cette page lit un flux iCalendar public de conférences et rencontres technologiques. L’agenda source est mis à jour chaque jour ; les événements disparaissent après leur date de fin. Vérifiez les dates et le lieu auprès de l’organisateur avant de vous déplacer.',
      savedNote: 'Les événements suivis restent enregistrés dans ce navigateur.',
      sourceUnavailable: 'La source des événements ne répond pas pour le moment. Vos suivis restent sur cet appareil.',
    }

function createElement(name, className, content) {
  const element = document.createElement(name)
  if (className) element.className = className
  if (content !== undefined) element.textContent = content
  return element
}

function safeText(value) {
  return typeof value === 'string' ? value : ''
}

function localDate(dateValue) {
  const [year, month, day] = dateValue.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function formatDateRange(event) {
  const formatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  const start = localDate(event.start)
  const end = localDate(event.end || event.start)
  if (event.start === (event.end || event.start)) return formatter.format(start)
  return `${formatter.format(start)} – ${formatter.format(end)}`
}

function formatUpdatedAt(dateValue) {
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function normalizeSearch(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase(locale).trim()
}

function loadSavedIds() {
  try {
    const value = JSON.parse(localStorage.getItem(savedEventsKey) || '[]')
    return new Set(Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [])
  } catch {
    return new Set()
  }
}

function saveIds(ids) {
  try {
    localStorage.setItem(savedEventsKey, JSON.stringify([...ids]))
  } catch {
    // Keep the current session usable if storage is unavailable.
  }
}

function icsEscape(value) {
  return safeText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function calendarDate(dateValue) {
  return dateValue.replaceAll('-', '')
}

function nextDate(dateValue) {
  const date = localDate(dateValue)
  date.setDate(date.getDate() + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function createCalendarFile(event) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const start = event.start
  const end = nextDate(event.end || event.start)
  const detailUrl = event.url || event.sourceUrl
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PSTB Tech//Event Tracker//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.id}@pstb-tech`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${calendarDate(start)}`,
    `DTEND;VALUE=DATE:${calendarDate(end)}`,
    `SUMMARY:${icsEscape(event.title)}`,
    `DESCRIPTION:${icsEscape(event.description || text.source)}`,
    `LOCATION:${icsEscape(event.location)}`,
    `URL:${detailUrl}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
}

function createActionButton(label, className, pressed) {
  const button = createElement('button', className, label)
  button.type = 'button'
  if (pressed !== undefined) button.setAttribute('aria-pressed', String(pressed))
  return button
}

function createEventCard(event, savedIds, onToggleSave, calendarObjectUrls) {
  const article = createElement('article', 'event-card')
  const dateBlock = createElement('div', 'event-date-block')
  dateBlock.setAttribute('aria-hidden', 'true')
  dateBlock.append(
    createElement('span', 'event-date-month', new Intl.DateTimeFormat(locale, { month: 'short' }).format(localDate(event.start)).replace('.', '')),
    createElement('span', 'event-date-day', String(localDate(event.start).getDate()).padStart(2, '0')),
    createElement('span', 'event-date-year', String(localDate(event.start).getFullYear())),
  )

  const body = createElement('div', 'event-card-body')
  const meta = createElement('div', 'event-card-meta')
  meta.append(
    createElement('span', 'event-category-chip', text.categories[event.category] || text.categories.technology),
    createElement('time', 'event-date-range', formatDateRange(event)),
  )

  const title = createElement('h3', 'event-card-title')
  const titleLink = createElement('a', '', safeText(event.title))
  titleLink.href = event.url || event.sourceUrl
  titleLink.target = '_blank'
  titleLink.rel = 'noopener noreferrer'
  title.append(titleLink)
  const location = createElement('p', 'event-location', safeText(event.location) || text.allLocations)
  const description = createElement('p', 'event-description', safeText(event.description))
  const attribution = createElement('p', 'event-attribution')
  attribution.append(document.createTextNode(language === 'en' ? 'Listed by ' : 'Référencé par '))
  const attributionLink = createElement('a', '', 'IP73')
  attributionLink.href = safeText(event.sourceUrl) || 'https://ip73.fr/evenements/'
  attributionLink.target = '_blank'
  attributionLink.rel = 'noopener noreferrer'
  attribution.append(attributionLink)

  const actions = createElement('div', 'event-card-actions')
  const isSaved = savedIds.has(event.id)
  const saveButton = createActionButton(isSaved ? text.unsave : text.save, 'event-save-button', isSaved)
  saveButton.addEventListener('click', () => onToggleSave(event.id))

  const calendarLink = createElement('a', 'event-calendar-link', text.calendar)
  const calendarUrl = URL.createObjectURL(createCalendarFile(event))
  calendarObjectUrls.push(calendarUrl)
  calendarLink.href = calendarUrl
  calendarLink.download = `${event.id}.ics`

  const detailsLink = createElement('a', 'event-details-link', `${text.details} ↗`)
  detailsLink.href = event.url || event.sourceUrl
  detailsLink.target = '_blank'
  detailsLink.rel = 'noopener noreferrer'

  actions.append(saveButton, calendarLink, detailsLink)
  body.append(meta, title, location)
  if (event.description) body.append(description)
  body.append(attribution, actions)
  article.append(dateBlock, body)
  return article
}

function populateSelect(select, entries, firstOption) {
  const previousValue = select.value
  select.replaceChildren()
  const first = document.createElement('option')
  first.value = 'all'
  first.textContent = firstOption
  select.append(first)
  for (const [value, label] of entries) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = label
    select.append(option)
  }
  if (entries.some(([value]) => value === previousValue)) select.value = previousValue
}

function getMonthOptions(events) {
  const months = new Map()
  for (const event of events) {
    const monthKey = event.start.slice(0, 7)
    if (months.has(monthKey)) continue
    const [year, month] = monthKey.split('-').map(Number)
    const label = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 15, 12))
    months.set(monthKey, label)
  }
  return [...months.entries()].sort(([left], [right]) => left.localeCompare(right))
}

export function initializeEventsPage() {
  const root = document.querySelector('[data-events-page]')
  if (!root) return

  const scope = root.dataset.eventScope === 'paris' ? 'paris' : 'world'
  const eventList = root.querySelector('[data-events-results]')
  const status = root.querySelector('[data-events-status]')
  const count = root.querySelector('[data-events-count]')
  const updatedAt = root.querySelector('[data-events-updated-at]')
  const refreshButton = root.querySelector('[data-events-refresh]')
  const searchInput = root.querySelector('[data-event-search]')
  const categoryFilter = root.querySelector('[data-event-category-filter]')
  const monthFilter = root.querySelector('[data-event-month-filter]')
  const locationFilter = root.querySelector('[data-event-location-filter]')
  const viewButtons = [...root.querySelectorAll('[data-event-view]')]
  let events = []
  let savedIds = loadSavedIds()
  let currentView = 'upcoming'
  let lastFetchedAt = null
  let requestController = null
  let isLoading = false
  let calendarObjectUrls = []

  function revokeCalendarObjectUrls() {
    for (const objectUrl of calendarObjectUrls) URL.revokeObjectURL(objectUrl)
    calendarObjectUrls = []
  }

  function updateViewButtons() {
    for (const button of viewButtons) {
      const active = button.dataset.eventView === currentView
      button.setAttribute('aria-pressed', String(active))
      button.classList.toggle('is-selected', active)
    }
  }

  function render() {
    const query = normalizeSearch(searchInput.value)
    const selectedCategory = categoryFilter.value
    const selectedMonth = monthFilter.value
    const selectedLocation = locationFilter?.value ?? 'all'
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const filtered = events.filter((event) => {
      const end = localDate(event.end || event.start)
      if (end < today) return false
      if (currentView === 'saved' && !savedIds.has(event.id)) return false
      if (selectedCategory !== 'all' && event.category !== selectedCategory) return false
      if (selectedMonth !== 'all' && event.start.slice(0, 7) !== selectedMonth) return false
      if (selectedLocation !== 'all' && event.location !== selectedLocation) return false
      const haystack = normalizeSearch(`${event.title} ${event.location} ${event.description} ${(event.categories || []).join(' ')}`)
      return !query || haystack.includes(query)
    })

    revokeCalendarObjectUrls()
    eventList.replaceChildren()
    if (filtered.length === 0) {
      const empty = createElement('p', 'events-empty-state', currentView === 'saved' ? text.noSaved : text.noUpcoming)
      eventList.append(empty)
    } else {
      const fragment = document.createDocumentFragment()
      for (const event of filtered) {
        fragment.append(createEventCard(event, savedIds, toggleSaved, calendarObjectUrls))
      }
      eventList.append(fragment)
    }

    count.textContent = text.eventCount(filtered.length)
    if (status.dataset.state !== 'error') status.textContent = text.eventCount(filtered.length)
    updateViewButtons()
  }

  function toggleSaved(id) {
    if (savedIds.has(id)) savedIds.delete(id)
    else savedIds.add(id)
    saveIds(savedIds)
    render()
  }

  async function refresh() {
    if (isLoading) return
    isLoading = true
    if (refreshButton) {
      refreshButton.disabled = true
      refreshButton.textContent = text.refreshing
    }
    if (!events.length) {
      status.removeAttribute('data-state')
      status.textContent = text.refreshing
    }

    requestController?.abort()
    requestController = new AbortController()
    try {
      const payload = await fetchTechEvents(scope, { signal: requestController.signal })
      events = Array.isArray(payload.events) ? payload.events : []
      lastFetchedAt = payload.fetchedAt
      status.removeAttribute('data-state')
      updatedAt.textContent = text.refreshedAt(formatUpdatedAt(lastFetchedAt))
      status.textContent = text.eventCount(events.length)
      populateSelect(categoryFilter, Object.entries(text.categories), text.allCategories)
      populateSelect(monthFilter, getMonthOptions(events), text.allMonths)
      if (locationFilter) {
        const locations = [...new Set(events.map((event) => safeText(event.location)).filter(Boolean))]
          .sort((left, right) => left.localeCompare(right, locale))
          .map((location) => [location, location])
        populateSelect(locationFilter, locations, text.allLocations)
      }
      render()
    } catch (error) {
      if (error.name !== 'AbortError') {
        status.dataset.state = 'error'
        status.textContent = events.length ? text.sourceUnavailable : text.searchError
        if (lastFetchedAt) updatedAt.textContent = text.refreshedAt(formatUpdatedAt(lastFetchedAt))
      }
    } finally {
      isLoading = false
      if (refreshButton) {
        refreshButton.disabled = false
        refreshButton.textContent = text.refresh
      }
    }
  }

  for (const button of viewButtons) {
    button.addEventListener('click', () => {
      currentView = button.dataset.eventView === 'saved' ? 'saved' : 'upcoming'
      render()
    })
  }
  searchInput.addEventListener('input', render)
  categoryFilter.addEventListener('change', render)
  monthFilter.addEventListener('change', render)
  locationFilter?.addEventListener('change', render)
  refreshButton?.addEventListener('click', refresh)
  window.addEventListener('storage', (event) => {
    if (event.key === savedEventsKey) {
      savedIds = loadSavedIds()
      render()
    }
  })

  updateViewButtons()
  window.addEventListener('pagehide', revokeCalendarObjectUrls, { once: true })
  refresh()
  window.setInterval(() => {
    if (document.visibilityState === 'visible') refresh()
  }, refreshIntervalMs)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (!lastFetchedAt || Date.now() - new Date(lastFetchedAt).getTime() >= refreshIntervalMs)) refresh()
  })
}
