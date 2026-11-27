const sourceList = [
  {
    id: 'openai',
    name: 'OpenAI News',
    url: 'https://openai.com/news/',
    feedUrl: 'https://openai.com/news/rss.xml',
  },
  {
    id: 'deepmind',
    name: 'Google DeepMind',
    url: 'https://deepmind.google/blog/',
    feedUrl: 'https://deepmind.google/blog/rss.xml',
  },
  {
    id: 'wired-ai',
    name: 'WIRED · Artificial Intelligence',
    url: 'https://www.wired.com/category/artificial-intelligence/',
    feedUrl: 'https://www.wired.com/feed/tag/ai/latest/rss',
  },
  {
    id: 'mit-tech-review',
    name: 'MIT Technology Review · AI',
    url: 'https://www.technologyreview.com/topic/artificial-intelligence/',
    feedUrl: 'https://www.technologyreview.com/topic/artificial-intelligence/feed',
  },
  {
    id: 'techcrunch',
    name: 'TechCrunch · AI',
    url: 'https://techcrunch.com/category/artificial-intelligence/',
    feedUrl: 'https://techcrunch.com/category/artificial-intelligence/feed/',
  },
  {
    id: 'hugging-face',
    name: 'Hugging Face Blog',
    url: 'https://huggingface.co/blog',
    feedUrl: 'https://huggingface.co/blog/feed.xml',
  },
  {
    id: 'le-monde',
    name: 'Le Monde · Intelligence artificielle',
    url: 'https://www.lemonde.fr/intelligence-artificielle/',
    feedUrl: 'https://www.lemonde.fr/intelligence-artificielle/rss_full.xml',
  },
]

const feedLimit = 18
const maxFeedLength = 1_500_000

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function readElement(block, tagNames) {
  for (const tagName of tagNames) {
    const tag = escapeRegExp(tagName)
    const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}\\s*>`, 'i'))
    if (match) return match[1]
  }
  return ''
}

function decodeEntities(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([\da-f]{1,6});/gi, (_match, digits) => String.fromCodePoint(Number.parseInt(digits, 16)))
    .replace(/&#(\d{1,7});/g, (_match, digits) => String.fromCodePoint(Number.parseInt(digits, 10)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp|ndash|mdash|rsquo|lsquo|rdquo|ldquo|hellip|copy);/gi, (_match, entity) => ({
      amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
      ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”',
      ldquo: '“', hellip: '…', copy: '©',
    })[entity.toLowerCase()])
}

function cleanText(value, limit = 320) {
  return decodeEntities(value)
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)
}

function readArticleLink(block) {
  const links = [...block.matchAll(/<(?:[\w.-]+:)?link\b([^>]*)\/?>/gi)]

  for (const link of links) {
    const attributes = link[1]
    const href = attributes.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2]
    const relation = attributes.match(/\brel\s*=\s*(["'])(.*?)\1/i)?.[2]
    if (href && (!relation || relation === 'alternate')) return decodeEntities(href)
  }

  return decodeEntities(readElement(block, ['link']))
}

function safeArticleUrl(value) {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

function canonicalArticleUrl(value) {
  const url = new URL(value)
  url.hash = ''
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key)) url.searchParams.delete(key)
  }
  return url.href
}

function parseEntries(xml, source) {
  const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1\s*>/gi)].map((match) => match[0])
  const entries = []

  for (const block of blocks.slice(0, feedLimit)) {
    const title = cleanText(readElement(block, ['title']), 240)
    const link = safeArticleUrl(readArticleLink(block))
    if (!title || !link) continue

    const publishedValue = decodeEntities(readElement(block, ['pubDate', 'published', 'updated', 'dc:date'])).trim()
    const publishedDate = publishedValue ? new Date(publishedValue) : null
    const publishedAt = publishedDate && !Number.isNaN(publishedDate.getTime())
      ? publishedDate.toISOString()
      : null
    const summary = cleanText(readElement(block, ['content:encoded', 'content', 'summary', 'description']), 320)

    entries.push({
      id: `${source.id}:${link}`,
      title,
      link,
      source: source.name,
      sourceUrl: source.url,
      publishedAt,
      summary,
    })
  }

  return entries
}

async function readSource(source) {
  const response = await fetch(source.feedUrl, {
    headers: {
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      'User-Agent': 'Inseme-Tech-AI-Watch/1.0',
    },
    signal: AbortSignal.timeout(7000),
  })

  if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}`)
  const contentLength = Number(response.headers.get('content-length') || 0)
  if (contentLength > maxFeedLength) throw new Error('Feed exceeded the size limit')

  const xml = await response.text()
  if (xml.length > maxFeedLength) throw new Error('Feed exceeded the size limit')
  return parseEntries(xml, source)
}

export async function fetchAiNews({ limit = 60 } = {}) {
  const results = await Promise.all(sourceList.map(async (source) => {
    try {
      return { sourceId: source.id, articles: await readSource(source) }
    } catch (error) {
      console.error('AI news feed unavailable', source.id, error instanceof Error ? error.message : 'Unknown error')
      return { sourceId: source.id, articles: null }
    }
  }))

  const availableSourceIds = results.filter((result) => result.articles).map((result) => result.sourceId)
  const byUrl = new Map()

  for (const result of results) {
    for (const article of result.articles ?? []) {
      let canonicalUrl
      try {
        canonicalUrl = canonicalArticleUrl(article.link)
      } catch {
        continue
      }

      if (!byUrl.has(canonicalUrl)) byUrl.set(canonicalUrl, article)
    }
  }

  const articles = [...byUrl.values()]
    .sort((left, right) => (Date.parse(right.publishedAt || '') || 0) - (Date.parse(left.publishedAt || '') || 0))
    .slice(0, Math.min(Math.max(Number(limit) || 60, 1), 60))

  return {
    articles,
    sources: sourceList.map(({ id, name, url }) => ({ id, name, url })),
    availableSourceIds,
    failedSourceIds: results.filter((result) => !result.articles).map((result) => result.sourceId),
  }
}
