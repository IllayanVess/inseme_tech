export default async function pushKey() {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY?.trim()
  if (!publicKey) {
    return Response.json({ error: 'Push notifications are not configured.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  return Response.json({ publicKey }, {
    headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
  })
}

export const config = { path: '/api/push-key' }
