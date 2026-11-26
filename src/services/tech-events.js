export async function fetchTechEvents(scope, { signal } = {}) {
  const response = await fetch(`/api/tech-events?scope=${encodeURIComponent(scope)}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Event feed request failed.')
  return payload
}