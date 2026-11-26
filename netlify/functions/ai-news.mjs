import { fetchAiNews } from '../lib/ai-news-core.mjs'

export default async function aiNews() {
  const result = await fetchAiNews()
  if (result.availableSourceIds.length === 0) {
    return Response.json({ ...result, error: 'No news source is available right now.' }, {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  return Response.json(result, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=300',
    },
  })
}

export const config = { path: '/api/ai-news' }
