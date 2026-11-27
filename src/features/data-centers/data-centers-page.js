import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import { fetchEuropeanDataCenters } from '../../services/data-centers.js'

const root = document.querySelector('[data-data-centers-page]')
const language = document.documentElement.lang === 'en' ? 'en' : 'fr'
const locale = language === 'en' ? 'en-GB' : 'fr-FR'
const countryNames = new Intl.DisplayNames([locale], { type: 'region' })
const refreshIntervalMs = 15 * 60 * 1000

const copy = language === 'en'
  ? {
      status: { operational: 'Operating', construction: 'Under construction', planned: 'Planned', completed: 'Completed · operation unconfirmed' },
      count: (n) => `${n.toLocaleString(locale)} sites`, empty: 'No data centres match these filters.',
      unavailable: 'Sites will appear here when the source can be reached.',
      loading: 'Loading the latest published data…', refreshing: 'Refreshing…', refresh: 'Refresh data',
      failed: 'Could not load the data-centre dataset. Try refreshing in a moment.',
      checked: (date) => `Checked ${date}`, published: (date) => `Dataset published ${date}`,
      selected: 'Selected site', choose: 'Choose a site', chooseHelp: 'Hover over a map marker to preview its status and reported power specifications. Select a marker or a site in the list for more details.',
      statusDate: 'Status reported', specifications: 'Power specifications', noneSpecs: 'No power specifications are published for this site.',
      noDate: 'No status date provided', source: 'Open source record', unknown: 'Unknown',
      reportedBy: 'Reported by', positionSource: 'Location attribution',
      projected: 'Projected / design estimate', reported: 'Reported value', low: 'Low', base: 'Base', high: 'High',
      locator: 'Location precision', locatorDetail: 'Map points are display anchors. Some identify only a town or region, not the facility itself.',
      project: 'Project', moreObservations: (n) => `+ ${n} more specification(s)`,
      powerCount: (n) => `${n} reported power specification(s)`,
      publishedUnknown: 'Publication date unavailable',
    }
  : {
      status: { operational: 'En exploitation', construction: 'En construction', planned: 'Projeté', completed: 'Terminé · exploitation non confirmée' },
      count: (n) => `${n.toLocaleString(locale)} sites`, empty: 'Aucun centre ne correspond à ces filtres.',
      unavailable: 'Les sites apparaîtront ici lorsque la source sera accessible.',
      loading: 'Chargement des dernières données publiées…', refreshing: 'Actualisation…', refresh: 'Actualiser les données',
      failed: 'Impossible de charger les données des centres. Réessayez dans un instant.',
      checked: (date) => `Vérifié à ${date}`, published: (date) => `Jeu de données publié le ${date}`,
      selected: 'Site sélectionné', choose: 'Choisir un site', chooseHelp: 'Survolez un repère pour voir son statut et les puissances publiées. Sélectionnez un repère ou un site de la liste pour plus de détails.',
      statusDate: 'Statut rapporté', specifications: 'Spécifications de puissance', noneSpecs: 'Aucune spécification de puissance n’est publiée pour ce site.',
      noDate: 'Date du statut indisponible', source: 'Ouvrir la fiche source', unknown: 'Inconnu',
      reportedBy: 'Source du statut', positionSource: 'Attribution de la localisation',
      projected: 'Estimation projetée / de conception', reported: 'Valeur rapportée', low: 'Bas', base: 'Central', high: 'Haut',
      locator: 'Précision de localisation', locatorDetail: 'Les repères indiquent une position de référence. Certains désignent une ville ou région, pas le centre lui-même.',
      project: 'Projet', moreObservations: (n) => `+ ${n} spécification(s) supplémentaire(s)`,
      powerCount: (n) => `${n} donnée(s) de puissance publiée(s)`,
      publishedUnknown: 'Date de publication indisponible',
    }

const projectedStages = new Set(['planned', 'design', 'requested', 'proposed', 'contracted', 'projected', 'forecast'])
const statusLabels = {
  operational: { en: 'operational', fr: 'en exploitation' },
  partially_operational: { en: 'partially operational', fr: 'partiellement en exploitation' },
  site_preparation: { en: 'site preparation', fr: 'préparation du site' },
  clearing: { en: 'clearing', fr: 'défrichage' },
  civil_works: { en: 'civil works', fr: 'gros œuvre' },
  foundations: { en: 'foundations', fr: 'fondations' },
  shell: { en: 'building shell', fr: 'structure du bâtiment' },
  mep_electrical: { en: 'electrical and mechanical works', fr: 'travaux électriques et mécaniques' },
  under_construction: { en: 'under construction', fr: 'en construction' },
  commissioning: { en: 'commissioning', fr: 'mise en service' },
  expansion: { en: 'expansion', fr: 'extension' },
  announced: { en: 'announced', fr: 'annoncé' },
  proposed: { en: 'proposed', fr: 'proposé' },
  site_control: { en: 'site control', fr: 'terrain sécurisé' },
  permitting: { en: 'permitting', fr: 'instruction administrative' },
  permitted: { en: 'permitted', fr: 'autorisé' },
  completed: { en: 'completed', fr: 'terminé' },
}
const metricLabels = {
  critical_it_mw: { en: 'Critical IT load', fr: 'Charge informatique critique' },
  gross_facility_mw: { en: 'Gross facility power', fr: 'Puissance totale du site' },
  grid_connection_mw: { en: 'Grid connection', fr: 'Raccordement au réseau' },
  utility_service_mw: { en: 'Utility service', fr: 'Puissance du fournisseur' },
  announced_power_mw: { en: 'Announced power', fr: 'Puissance annoncée' },
}

function createElement(tagName, className, text) {
  const element = document.createElement(tagName)
  if (className) element.className = className
  if (text !== undefined) element.textContent = text
  return element
}

function dateText(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return copy.noDate
  const date = new Date(`${value}T12:00:00Z`)
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}

function countryText(site) {
  const localized = countryNames.of(site.countryCode)
  return localized && localized !== site.countryCode ? localized : site.country
}

function stageText(value) {
  if (typeof value !== 'string' || !value.trim()) return copy.unknown
  return statusLabels[value]?.[language] || value.replaceAll('_', ' ')
}

function formatNumber(value) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)
}

function metricText(metric) {
  if (typeof metric !== 'string' || !metric.trim()) return language === 'en' ? 'Power' : 'Puissance'
  return metricLabels[metric]?.[language] || metric.replaceAll('_', ' ')
}

function powerValue(observation) {
  const parts = []
  const unit = typeof observation.unit === 'string' ? ` ${observation.unit}` : ''
  if (Number.isFinite(observation.base)) parts.push(`${copy.base}: ${formatNumber(observation.base)}${unit}`)
  if (Number.isFinite(observation.low) || Number.isFinite(observation.high)) {
    const low = Number.isFinite(observation.low) ? formatNumber(observation.low) : '…'
    const high = Number.isFinite(observation.high) ? formatNumber(observation.high) : '…'
    parts.push(`${copy.low}–${copy.high}: ${low}–${high}${unit}`)
  }
  if (!parts.length) return copy.unknown
  return parts.join(' · ')
}

function appendPowerList(container, observations, limit = 4) {
  if (!observations.length) {
    container.append(createElement('p', 'dc-no-specs', copy.noneSpecs))
    return
  }

  const list = createElement('ul', 'dc-power-list')
  observations.slice(0, limit).forEach((observation) => {
    const item = createElement('li', 'dc-power-item')
    const heading = createElement('strong', 'dc-power-name', metricText(observation.metric))
    const stage = observation.stage || ''
    const isProjected = projectedStages.has(stage)
    const value = createElement('span', 'dc-power-value', powerValue(observation))
    const type = createElement('span', isProjected ? 'dc-power-stage is-projected' : 'dc-power-stage', isProjected ? copy.projected : `${copy.reported} · ${stageText(stage)}`)
    item.append(heading, value, type)
    if (observation.as_of_date) item.append(createElement('span', 'dc-power-date', dateText(observation.as_of_date)))
    list.append(item)
  })
  container.append(list)
  if (observations.length > limit) container.append(createElement('p', 'dc-more-data', copy.moreObservations(observations.length - limit)))
}

function getProjectStatuses(site) {
  return site.projects.slice(0, 3).map((project) => ({
    name: typeof project.name === 'string' ? project.name : copy.project,
    status: stageText(project.status),
  }))
}

function buildMarkerTooltip(site) {
  const content = createElement('div', 'dc-map-tooltip')
  content.append(createElement('strong', 'dc-tooltip-title', site.name))
  content.append(createElement('span', 'dc-tooltip-location', countryText(site)))
  content.append(createElement('span', `dc-status-badge dc-status-${site.group}`, copy.status[site.group]))
  content.append(createElement('span', 'dc-tooltip-date', `${copy.statusDate} · ${dateText(site.newestStatusDate)}`))
  if (site.statusPublishers.length) content.append(createElement('span', 'dc-tooltip-date', `${copy.reportedBy}: ${site.statusPublishers.slice(0, 2).join(' · ')}`))

  const projects = getProjectStatuses(site)
  if (projects.length) {
    const list = createElement('ul', 'dc-tooltip-projects')
    projects.forEach((project) => {
      const item = createElement('li', '', `${project.name} · ${project.status}`)
      list.append(item)
    })
    content.append(list)
  }
  const powerHeading = createElement('strong', 'dc-tooltip-heading', copy.specifications)
  content.append(powerHeading)
  appendPowerList(content, site.observations, 3)
  return content
}

function buildMarkerIcon(group) {
  const pin = document.createElement('span')
  pin.className = `dc-map-pin dc-map-pin-${group}`
  pin.setAttribute('aria-hidden', 'true')
  return L.divIcon({
    className: 'dc-map-marker',
    html: pin,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    tooltipAnchor: [0, -9],
  })
}

function buildClusterIcon(cluster) {
  const count = cluster.getChildCount()
  const size = count < 10 ? 34 : count < 100 ? 40 : 46
  const label = createElement('span', `dc-cluster-count dc-cluster-${count < 10 ? 'small' : count < 100 ? 'medium' : 'large'}`, count.toLocaleString(locale))
  return L.divIcon({
    className: 'dc-cluster-shell',
    html: label,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function initializeMap(mapElement) {
  const map = L.map(mapElement, { scrollWheelZoom: false, preferCanvas: true })
  map.fitBounds([[35, -24], [71, 44]], { padding: [12, 12] })
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    minZoom: 3,
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
  }).addTo(map)
  return map
}

function createSiteCard(site, onSelect) {
  const item = createElement('li', 'dc-site-list-item')
  const button = createElement('button', 'dc-site-card')
  button.type = 'button'
  button.setAttribute('aria-label', `${site.name}, ${countryText(site)}, ${copy.status[site.group]}`)
  const top = createElement('span', 'dc-site-card-top')
  top.append(createElement('strong', 'dc-site-name', site.name), createElement('span', `dc-status-badge dc-status-${site.group}`, copy.status[site.group]))
  button.append(top, createElement('span', 'dc-site-location', `${countryText(site)} · ${dateText(site.newestStatusDate)}`))
  if (site.observations.length) button.append(createElement('span', 'dc-site-capacity', copy.powerCount(site.observations.length)))
  button.addEventListener('click', () => onSelect(site))
  item.append(button)
  return item
}

function renderSelectedSite(site, detailElement) {
  detailElement.replaceChildren()
  if (!site) {
    detailElement.append(createElement('p', 'eyebrow', copy.choose))
    detailElement.append(createElement('p', 'dc-detail-hint', copy.chooseHelp))
    return
  }

  detailElement.append(createElement('p', 'eyebrow', copy.selected))
  detailElement.append(createElement('h3', 'dc-selected-title', site.name))
  detailElement.append(createElement('span', `dc-status-badge dc-status-${site.group}`, copy.status[site.group]))
  detailElement.append(createElement('p', 'dc-detail-meta', `${countryText(site)} · ${copy.statusDate}: ${dateText(site.newestStatusDate)}`))
  if (site.statusPublishers.length) detailElement.append(createElement('p', 'dc-detail-meta', `${copy.reportedBy}: ${site.statusPublishers.join(' · ')}`))

  const projects = site.projects.slice(0, 5)
  if (projects.length) {
    detailElement.append(createElement('h4', 'dc-detail-heading', language === 'en' ? 'Reported projects' : 'Projets rapportés'))
    const projectList = createElement('ul', 'dc-project-list')
    projects.forEach((project) => {
      const label = `${typeof project.name === 'string' ? project.name : copy.project} · ${stageText(project.status)}`
      projectList.append(createElement('li', '', label))
    })
    detailElement.append(projectList)
  }

  detailElement.append(createElement('h4', 'dc-detail-heading', copy.specifications))
  appendPowerList(detailElement, site.observations, 8)
  detailElement.append(createElement('p', 'dc-location-caveat', `${copy.locator}: ${copy.locatorDetail}`))
  if (site.geometryAttributions.length) detailElement.append(createElement('p', 'dc-location-caveat', `${copy.positionSource}: ${site.geometryAttributions.join(' · ')}`))
  const source = createElement('a', 'dc-source-link', copy.source)
  source.href = site.sourceUrl
  source.target = '_blank'
  source.rel = 'noreferrer'
  detailElement.append(source)
}

export async function initializeDataCentersPage() {
  if (!root) return

  if (typeof L.markerClusterGroup !== 'function') {
    window.L = L
    await import('leaflet.markercluster')
  }

  const mapElement = root.querySelector('[data-dc-map]')
  const listElement = root.querySelector('[data-dc-list]')
  const detailElement = root.querySelector('[data-dc-detail]')
  const statusElement = root.querySelector('[data-dc-feed-status]')
  const countElement = root.querySelector('[data-dc-result-count]')
  const searchElement = root.querySelector('[data-dc-search]')
  const countryElement = root.querySelector('[data-dc-country]')
  const statusFilter = root.querySelector('[data-dc-status-filter]')
  const refreshButton = root.querySelector('[data-dc-refresh]')
  const publishedElement = root.querySelector('[data-dc-published]')
  const filtersForm = root.querySelector('.dc-filters')
  if (!mapElement || !listElement || !detailElement || !statusElement || !countElement || !searchElement || !countryElement || !statusFilter || !refreshButton) return

  const map = initializeMap(mapElement)
  const markers = L.markerClusterGroup({
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    spiderfyOnMaxZoom: true,
    disableClusteringAtZoom: 9,
    maxClusterRadius: 55,
    iconCreateFunction: buildClusterIcon,
  }).addTo(map)
  let allSites = []
  let selectedSite = null
  let lastPublishedAt = ''
  let refreshInProgress = false

  function setFeedStatus(message, state = 'info') {
    statusElement.textContent = message
    statusElement.dataset.state = state
  }

  function selectedByFilters() {
    const query = searchElement.value.trim().toLocaleLowerCase(locale)
    const selectedStatus = statusFilter.value
    const selectedCountry = countryElement.value
    return allSites.filter((site) => {
      if (selectedStatus && site.group !== selectedStatus) return false
      if (selectedCountry && site.countryCode !== selectedCountry) return false
      if (!query) return true
      const searchable = [site.name, site.country, countryText(site), ...site.projects.map((project) => project.name)].join(' ').toLocaleLowerCase(locale)
      return searchable.includes(query)
    })
  }

  function render() {
    const sites = selectedByFilters()
    markers.clearLayers()
    listElement.replaceChildren()
    countElement.textContent = copy.count(sites.length)

    sites.forEach((site) => {
      const marker = L.marker([site.latitude, site.longitude], {
        icon: buildMarkerIcon(site.group),
        keyboard: true,
        title: `${site.name} · ${copy.status[site.group]}`,
        alt: `${site.name}, ${countryText(site)}, ${copy.status[site.group]}`,
      })
      marker.bindTooltip(buildMarkerTooltip(site), { direction: 'top', opacity: 0.98, sticky: false, interactive: true })
      marker.on('click', () => {
        selectedSite = site
        renderSelectedSite(site, detailElement)
      })
      markers.addLayer(marker)
      listElement.append(createSiteCard(site, (selected) => {
        selectedSite = selected
        renderSelectedSite(selected, detailElement)
        markers.zoomToShowLayer(marker, () => {
          map.setView([selected.latitude, selected.longitude], Math.max(map.getZoom(), 11), { animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches })
          marker.openTooltip()
        })
      }))
    })

    if (!sites.length) listElement.append(createElement('li', 'dc-empty-state', copy.empty))
    if (selectedSite && !sites.some((site) => site.id === selectedSite.id)) {
      selectedSite = null
      renderSelectedSite(null, detailElement)
    }
  }

  function populateCountries() {
    const selected = countryElement.value
    const firstOption = countryElement.options[0]
    countryElement.replaceChildren(firstOption)
    const countries = [...new Map(allSites.map((site) => [site.countryCode, countryText(site)])).entries()]
      .sort((a, b) => a[1].localeCompare(b[1], locale))
    countries.forEach(([code, name]) => {
      const option = createElement('option', '', name)
      option.value = code
      countryElement.append(option)
    })
    countryElement.value = selected
  }

  async function refresh() {
    if (refreshInProgress) return
    refreshInProgress = true
    refreshButton.disabled = true
    setFeedStatus(allSites.length ? copy.refreshing : copy.loading)
    try {
      const data = await fetchEuropeanDataCenters()
      allSites = data.sites
      lastPublishedAt = data.publishedAt
      if (selectedSite) selectedSite = allSites.find((site) => site.id === selectedSite.id) || null
      renderSelectedSite(selectedSite, detailElement)
      populateCountries()
      if (publishedElement) publishedElement.textContent = lastPublishedAt ? copy.published(dateText(lastPublishedAt)) : copy.publishedUnknown
      render()
      const checkedAt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date())
      setFeedStatus(`${copy.checked(checkedAt)} · ${data.version || copy.publishedUnknown}`)
    } catch (error) {
      console.error('Data centre feed refresh failed:', error)
      if (!allSites.length) {
        countElement.textContent = copy.count(0)
        listElement.replaceChildren(createElement('li', 'dc-empty-state', copy.unavailable))
      }
      setFeedStatus(copy.failed, 'error')
    } finally {
      refreshInProgress = false
      refreshButton.disabled = false
    }
  }

  searchElement.addEventListener('input', render)
  countryElement.addEventListener('change', render)
  statusFilter.addEventListener('change', render)
  filtersForm?.addEventListener('submit', (event) => event.preventDefault())
  refreshButton.addEventListener('click', refresh)
  renderSelectedSite(null, detailElement)
  refresh()
  window.setInterval(refresh, refreshIntervalMs)
}
