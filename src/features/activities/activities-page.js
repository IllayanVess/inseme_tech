import { isSupabaseConfigured } from '../../lib/supabase.js'
import { getPublishedEvents } from '../../services/public-content.js'

const isEnglish = document.documentElement.lang === 'en'

const copy = isEnglish
  ? {
      locale: 'en-GB',
      upcoming: 'Upcoming',
      past: 'Past',
      loading: 'Loading activities…',
      unavailable: 'Activities are temporarily unavailable. Please try again later.',
      notConfigured: 'The activity list is not configured yet.',
      noEvents: 'No published activities for this period yet.',
      noResults: 'No activities match these filters.',
      results: (count) => `${count} ${count === 1 ? 'activity' : 'activities'}`,
      more: 'Load more',
      date: 'Date',
      location: 'Location',
      capacity: 'Places',
      deadline: 'Registration deadline',
      eventStatus: {
        planned: 'Planned',
        open: 'Registration open',
        full: 'Full',
        cancelled: 'Cancelled',
        completed: 'Completed',
      },
      categories: {
        programming: 'Programming',
        data_ai: 'Data and AI',
        robotics: 'Robotics',
        creative_technology: 'Creative technology',
        professional_development: 'Professional development',
        community: 'Community',
      },
    }
  : {
      locale: 'fr-FR',
      upcoming: 'À venir',
      past: 'Passées',
      loading: 'Chargement des activités…',
      unavailable: 'Les activités sont momentanément indisponibles. Réessayez plus tard.',
      notConfigured: 'La liste des activités n’est pas encore configurée.',
      noEvents: 'Aucune activité publiée pour cette période.',
      noResults: 'Aucune activité ne correspond à ces filtres.',
      results: (count) => `${count} ${count > 1 ? 'activités' : 'activité'}`,
      more: 'Afficher plus',
      date: 'Date',
      location: 'Lieu',
      capacity: 'Places',
      deadline: 'Date limite d’inscription',
      eventStatus: {
        planned: 'Prévu',
        open: 'Inscriptions ouvertes',
        full: 'Complet',
        cancelled: 'Annulé',
        completed: 'Terminé',
      },
      categories: {
        programming: 'Programmation',
        data_ai: 'Data et IA',
        robotics: 'Robotique',
        creative_technology: 'Technologies créatives',
        professional_development: 'Ouverture professionnelle',
        community: 'Vie étudiante',
      },
    }

const pageSize = 12

const formatDate = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(copy.locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const toDateBoundary = (value, endOfDay = false) => {
  if (!value) return undefined

  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}`)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

const appendText = (parent, tagName, className, value) => {
  if (!value) return null

  const element = document.createElement(tagName)
  element.className = className
  element.textContent = value
  parent.append(element)
  return element
}

const createEventCard = (event) => {
  const card = document.createElement('article')
  card.className = 'activity-card'

  const topLine = document.createElement('div')
  topLine.className = 'activity-card-topline'
  appendText(topLine, 'span', 'activity-category', copy.categories[event.category] || event.category)
  appendText(topLine, 'span', 'activity-status', copy.eventStatus[event.event_status] || event.event_status)
  card.append(topLine)

  appendText(card, 'h2', 'activity-title', isEnglish ? event.title_en : event.title_fr)
  appendText(card, 'p', 'activity-summary', isEnglish
    ? event.summary_en || event.description_en
    : event.summary_fr || event.description_fr)

  const metadata = document.createElement('dl')
  metadata.className = 'activity-metadata'
  const addMetadata = (label, value, dateValue = null) => {
    if (!value) return
    const group = document.createElement('div')
    const term = document.createElement('dt')
    term.textContent = label
    const description = document.createElement('dd')
    if (dateValue) {
      const time = document.createElement('time')
      time.dateTime = dateValue
      time.textContent = value
      description.append(time)
    } else {
      description.textContent = value
    }
    group.append(term, description)
    metadata.append(group)
  }

  const endDate = event.ends_at ? ` — ${formatDate(event.ends_at)}` : ''
  addMetadata(copy.date, `${formatDate(event.starts_at)}${endDate}`, event.starts_at)
  addMetadata(copy.location, isEnglish ? event.location_en : event.location_fr)
  if (event.registration_capacity) addMetadata(copy.capacity, String(event.registration_capacity))
  if (event.registration_deadline) {
    addMetadata(copy.deadline, formatDate(event.registration_deadline), event.registration_deadline)
  }
  if (metadata.childElementCount) card.append(metadata)

  return card
}

export function initializeActivitiesPage() {
  const page = document.querySelector('[data-activities-page]')
  if (!page) return

  const filterForm = page.querySelector('[data-activities-filter]')
  const results = page.querySelector('[data-activities-results]')
  const status = page.querySelector('[data-activities-status]')
  const loadMoreButton = page.querySelector('[data-activities-more]')
  const periodButtons = [...page.querySelectorAll('[data-activities-period]')]
  if (!filterForm || !results || !status || !loadMoreButton || !periodButtons.length) return

  if (!isSupabaseConfigured) {
    status.textContent = copy.notConfigured
    periodButtons.forEach((button) => { button.disabled = true })
    filterForm.querySelectorAll('select, input, button').forEach((control) => { control.disabled = true })
    loadMoreButton.hidden = true
    return
  }

  const state = { period: 'upcoming', offset: 0, count: 0, loading: false }
  let requestId = 0

  const setLoading = (loading) => {
    state.loading = loading
    periodButtons.forEach((button) => { button.disabled = loading })
    filterForm.querySelectorAll('select, input, button').forEach((control) => { control.disabled = loading })
    loadMoreButton.disabled = loading
  }

  const updatePeriodButtons = () => {
    periodButtons.forEach((button) => {
      const selected = button.dataset.activitiesPeriod === state.period
      button.setAttribute('aria-pressed', String(selected))
    })
  }

  const loadPage = async (reset = false) => {
    if (state.loading) return
    if (reset) {
      state.offset = 0
      results.replaceChildren()
    }

    const currentRequestId = ++requestId
    const formData = new FormData(filterForm)
    const dateFrom = toDateBoundary(formData.get('dateFrom'))
    const dateTo = toDateBoundary(formData.get('dateTo'), true)

    setLoading(true)
    status.textContent = copy.loading

    try {
      const result = await getPublishedEvents({
        period: state.period,
        category: formData.get('category'),
        status: formData.get('status'),
        dateFrom,
        dateTo,
        offset: state.offset,
        limit: pageSize,
      })

      if (currentRequestId !== requestId) return

      state.count = result.count
      if (!result.data.length && state.offset === 0) {
        const filtersActive = formData.get('category') !== 'all'
          || formData.get('status') !== 'all'
          || Boolean(formData.get('dateFrom'))
          || Boolean(formData.get('dateTo'))
        status.textContent = filtersActive ? copy.noResults : copy.noEvents
      } else {
        result.data.forEach((event) => results.append(createEventCard(event)))
        state.offset += result.data.length
        status.textContent = copy.results(state.count)
      }

      loadMoreButton.hidden = state.offset >= state.count
    } catch {
      if (currentRequestId === requestId) {
        status.textContent = copy.unavailable
        loadMoreButton.hidden = true
      }
    } finally {
      setLoading(false)
    }
  }

  filterForm.addEventListener('submit', (event) => {
    event.preventDefault()
    const formData = new FormData(filterForm)
    const dateFrom = formData.get('dateFrom')
    const dateTo = formData.get('dateTo')
    if (dateFrom && dateTo && dateFrom > dateTo) {
      filterForm.querySelector('[data-date-error]').textContent = isEnglish
        ? 'The start date must be before the end date.'
        : 'La date de début doit précéder la date de fin.'
      return
    }
    filterForm.querySelector('[data-date-error]').textContent = ''
    loadPage(true)
  })

  filterForm.addEventListener('reset', () => {
    requestAnimationFrame(() => {
      filterForm.querySelector('[data-date-error]').textContent = ''
      loadPage(true)
    })
  })

  periodButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (state.period === button.dataset.activitiesPeriod) return
      state.period = button.dataset.activitiesPeriod
      updatePeriodButtons()
      loadPage(true)
    })
  })

  loadMoreButton.addEventListener('click', () => loadPage())
  updatePeriodButtons()
  loadPage(true)
}
