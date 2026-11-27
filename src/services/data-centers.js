const atlasApi = 'https://kiankyars.github.io/datacenter-atlas/api/v1'

const europeanCountries = new Set([
  'AD', 'AL', 'AM', 'AT', 'AX', 'AZ', 'BA', 'BE', 'BG', 'BY', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FO', 'FR', 'GB',
  'GE', 'GG', 'GI', 'GR', 'HR', 'HU', 'IE', 'IM', 'IS', 'IT', 'JE', 'LI', 'LT', 'LU', 'LV', 'MC', 'MD', 'ME', 'MK', 'MT', 'NL',
  'NO', 'PL', 'PT', 'RO', 'RS', 'RU', 'SE', 'SI', 'SJ', 'SK', 'SM', 'TR', 'UA', 'VA', 'XK',
])

const statusGroups = {
  operational: new Set(['operational', 'partially_operational']),
  construction: new Set(['site_preparation', 'clearing', 'civil_works', 'foundations', 'shell', 'mep_electrical', 'under_construction', 'commissioning', 'expansion']),
  planned: new Set(['announced', 'proposed', 'site_control', 'permitting', 'permitted']),
  completed: new Set(['completed']),
}

function getStatusGroup(statuses) {
  for (const group of ['operational', 'construction', 'planned', 'completed']) {
    if (statuses.some((status) => statusGroups[group].has(status))) return group
  }
  return null
}

function normalizeSite(site) {
  if (!site || typeof site !== 'object') return null

  const latitude = Number(site.latitude)
  const longitude = Number(site.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < 34 || latitude > 72 || longitude < -25 || longitude > 45) return null
  if (!europeanCountries.has(String(site.country_iso_a2 || '').toUpperCase())) return null

  const projects = Array.isArray(site.projects) ? site.projects.filter((project) => project && typeof project === 'object') : []
  const statuses = [...new Set([
    ...(Array.isArray(site.statuses) ? site.statuses : []),
    ...projects.map((project) => project.status),
  ].filter((status) => typeof status === 'string'))]
  const group = getStatusGroup(statuses)
  if (!group) return null

  return {
    id: typeof site.site_id === 'string' ? site.site_id : `${site.name}-${latitude}-${longitude}`,
    name: typeof site.name === 'string' && site.name.trim() ? site.name : 'Unnamed data centre',
    country: typeof site.country === 'string' ? site.country : '',
    countryCode: String(site.country_iso_a2 || '').toUpperCase(),
    latitude,
    longitude,
    group,
    statuses,
    projects,
    observations: Array.isArray(site.power_observations) ? site.power_observations.filter((observation) => observation && typeof observation === 'object') : [],
    statusPublishers: Array.isArray(site.status_publishers) ? site.status_publishers.filter((publisher) => typeof publisher === 'string' && publisher.trim()) : [],
    geometryAttributions: Array.isArray(site.geometry_attributions) ? site.geometry_attributions.filter((attribution) => typeof attribution === 'string' && attribution.trim()) : [],
    newestStatusDate: typeof site.newest_status_as_of === 'string' ? site.newest_status_as_of : '',
    locatorScopes: Array.isArray(site.locator_scopes) ? site.locator_scopes : [],
    sourceUrl: typeof site.url === 'string' ? site.url : 'https://kiankyars.github.io/datacenter-atlas/',
  }
}

async function readJson(response) {
  if (!response.ok) throw new Error(`Data Center Atlas returned HTTP ${response.status}`)
  return response.json()
}

export async function fetchEuropeanDataCenters({ signal } = {}) {
  const [metadataResponse, sitesResponse] = await Promise.all([
    fetch(`${atlasApi}/index.json`, { signal }),
    fetch(`${atlasApi}/sites.json`, { signal }),
  ])
  const [metadata, rawSites] = await Promise.all([readJson(metadataResponse), readJson(sitesResponse)])
  if (!Array.isArray(rawSites)) throw new Error('The data-centre source returned an unexpected response.')

  const sites = rawSites.map(normalizeSite).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))
  return {
    sites,
    publishedAt: metadata?.dataset?.updated_at || metadata?.dataset?.checkpoint_date || '',
    version: metadata?.dataset?.label || '',
  }
}
