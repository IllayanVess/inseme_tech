import { createHash } from 'node:crypto'

const feedUrl = 'https://ip73.fr/evenements/evenements.ics'
const sourceUrl = 'https://ip73.fr/evenements/'
const maxFeedCharacters = 1_500_000
const maxReturnedEvents = 250

function jsonResponse(value, status = 200) {
  const headers = {
    'Cache-Control': status === 200 ? 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600' : 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  }
  return new Response(JSON.stringify(value), { status, headers })
}

function unfoldCalendarLines(calendarText) {
  return calendarText.replace(/\r?\n[ \t]/g, '')
}

function readCalendarProperty(line) {
  const separator = line.indexOf(':')
  if (separator < 0) return null

  const descriptor = line.slice(0, separator)
  const [rawName, ...rawParameters] = descriptor.split(';')
  const parameters = Object.fromEntries(rawParameters.map((part) => {
    const parameterSeparator = part.indexOf('=')
    if (parameterSeparator < 0) return [part.toLowerCase(), '']
    return [part.slice(0, parameterSeparator).toLowerCase(), part.slice(parameterSeparator + 1).replace(/^"|"$/g, '')]
  }))

  return {
    name: rawName.toUpperCase(),
    parameters,
    value: line.slice(separator + 1),
  }
}

function unescapeCalendarText(value) {
  return value
    .replace(/\\[nN]/g, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function dateFromCalendarValue(property) {
  if (!property) return null
  const match = property.value.match(/^(\d{4})(\d{2})(\d{2})/)
  if (!match) return null
  return `${match[1]}-${match[2]}-${match[3]}`
}

function shiftDate(dateValue, days) {
  const [year, month, day] = dateValue.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return shifted.toISOString().slice(0, 10)
}

function normalizeText(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function classifyEvent(categories, title, description) {
  const searchableText = normalizeText(`${categories.join(' ')} ${title} ${description}`)
  if (/\b(ai|ia)\b|artificial intelligence|intelligence artificielle|machine learning|deep learning|robotique|robotics|data science/.test(searchableText)) return 'ai'
  if (/cloud|devops|sre|kubernetes|infrastructure/.test(searchableText)) return 'cloud'
  if (/cyber|security|securite|infosec/.test(searchableText)) return 'security'
  if (/developer|developpement|development|programmation|software|web|python|java|wordpress|php|rust|golang|code/.test(searchableText)) return 'development'
  return 'technology'
}

function isParisEvent(event) {
  const place = normalizeText(`${event.location} ${event.title}`)
  return /\bparis\b|ile de france|puteaux|la defense|courbevoie|nanterre|versailles|saint denis|boulogne billancourt|issy les moulineaux|saclay|villejuif|montrouge|cachan/.test(place)
}

function toPublicUrl(value) {
  try {
    const url = new URL(value)
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) return null
    return url.href
  } catch {
    return null
  }
}

function parseCalendarEvent(properties) {
  const valuesFor = (name) => properties.filter((property) => property.name === name)
  const firstValue = (name) => valuesFor(name)[0]
  const title = unescapeCalendarText(firstValue('SUMMARY')?.value ?? '')
  const startProperty = firstValue('DTSTART')
  const endProperty = firstValue('DTEND')
  const start = dateFromCalendarValue(startProperty)
  let end = dateFromCalendarValue(endProperty) ?? start
  const isAllDayEnd = endProperty?.parameters.value?.toUpperCase() === 'DATE' || /^\d{8}$/.test(endProperty?.value ?? '')
  if (end && start && isAllDayEnd && end > start) end = shiftDate(end, -1)
  const description = unescapeCalendarText(firstValue('DESCRIPTION')?.value ?? '').slice(0, 700)
  const location = unescapeCalendarText(firstValue('LOCATION')?.value ?? '').slice(0, 240)
  const categories = valuesFor('CATEGORIES').flatMap((property) => property.value.split(',').map(unescapeCalendarText)).filter(Boolean)
  const status = firstValue('STATUS')?.value.toUpperCase()
  const idSource = firstValue('UID')?.value ?? `${title}|${start}|${location}`
  const id = createHash('sha256').update(idSource).digest('hex').slice(0, 24)

  if (!title || !start || status === 'CANCELLED') return null

  return {
    id,
    title,
    start,
    end,
    location,
    description,
    categories,
    category: classifyEvent(categories, title, description),
    url: toPublicUrl(firstValue('URL')?.value ?? ''),
    source: 'IP73',
    sourceUrl,
  }
}

function parseCalendar(calendarText) {
  const lines = unfoldCalendarLines(calendarText).split(/\r?\n/)
  const events = []
  let currentProperties = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      currentProperties = []
      continue
    }
    if (line === 'END:VEVENT') {
      if (currentProperties) {
        const event = parseCalendarEvent(currentProperties)
        if (event) events.push(event)
      }
      currentProperties = null
      continue
    }
    if (!currentProperties) continue
    const property = readCalendarProperty(line)
    if (property) currentProperties.push(property)
  }

  return events
}

export default async function techEvents(request) {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed.' }, 405)

  const scope = new URL(request.url).searchParams.get('scope') ?? 'world'
  if (scope !== 'paris' && scope !== 'world') return jsonResponse({ error: 'Unknown event scope.' }, 400)

  try {
    const response = await fetch(feedUrl, {
      headers: { Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.5' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error(`Upstream returned ${response.status}`)

    const calendarText = await response.text()
    if (calendarText.length > maxFeedCharacters) throw new Error('Upstream calendar exceeded the response limit.')
    if (!calendarText.trimStart().startsWith('BEGIN:VCALENDAR')) throw new Error('Upstream response was not an iCalendar feed.')

    const allEvents = parseCalendar(calendarText)
    const filteredEvents = scope === 'paris' ? allEvents.filter(isParisEvent) : allEvents
    const events = filteredEvents
      .filter((event) => event.start >= new Date().toISOString().slice(0, 10))
      .sort((left, right) => left.start.localeCompare(right.start) || left.title.localeCompare(right.title))
      .slice(0, maxReturnedEvents)

    return jsonResponse({
      events,
      scope,
      source: { name: 'IP73', url: sourceUrl, schedule: 'daily' },
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Tech event feed unavailable:', error instanceof Error ? error.message : 'Unknown error')
    return jsonResponse({ error: 'The event calendar is temporarily unavailable.' }, 503)
  }
}

export const config = { path: '/api/tech-events' }
