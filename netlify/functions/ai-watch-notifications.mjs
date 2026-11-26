import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { sendNotification, setVapidDetails } from 'web-push'
import { findMatchingKeywords } from '../../src/features/watch/match-keywords.js'
import { fetchAiNews } from '../lib/ai-news-core.mjs'

const recentArticleWindowMs = 45 * 60 * 1000

function jsonResponse(value, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } })
}

function getServerConfig() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim()
  const supabaseKey = process.env.SUPABASE_SECRET_KEY?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY?.trim()
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim()
  const subject = process.env.WEB_PUSH_SUBJECT?.trim()

  if (!supabaseUrl || !supabaseKey || !publicKey || !privateKey || !subject) return null
  return { supabaseUrl, supabaseKey, publicKey, privateKey, subject }
}

function isAllowedPushEndpoint(value) {
  try {
    const endpoint = new URL(value)
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.port) return false

    const host = endpoint.hostname.toLowerCase()
    return host === 'fcm.googleapis.com'
      || host === 'updates.push.services.mozilla.com'
      || host.endsWith('.push.services.mozilla.com')
      || host === 'web.push.apple.com'
      || host.endsWith('.push.apple.com')
      || host.endsWith('.notify.windows.com')
  } catch {
    return false
  }
}

function getArticleKey(link) {
  return createHash('sha256').update(link).digest('hex')
}

async function claimDelivery(supabase, subscription, articleKey) {
  const { data, error } = await supabase
    .from('ai_watch_deliveries')
    .upsert({
      user_id: subscription.user_id,
      subscription_id: subscription.id,
      article_key: articleKey,
    }, {
      onConflict: 'user_id,subscription_id,article_key',
      ignoreDuplicates: true,
    })
    .select('article_key')

  if (error) throw error
  return data.length > 0
}

async function deleteDelivery(supabase, subscription, articleKey) {
  await supabase
    .from('ai_watch_deliveries')
    .delete()
    .eq('user_id', subscription.user_id)
    .eq('subscription_id', subscription.id)
    .eq('article_key', articleKey)
}

async function removeSubscription(supabase, subscription) {
  await supabase
    .from('ai_watch_subscriptions')
    .delete()
    .eq('id', subscription.id)
    .eq('user_id', subscription.user_id)
}

async function sendToSubscription(supabase, subscription, article, matchedKeywords, articleKey) {
  if (!isAllowedPushEndpoint(subscription.endpoint)) {
    await removeSubscription(supabase, subscription)
    return { sent: false, removed: true }
  }

  const claimed = await claimDelivery(supabase, subscription, articleKey)
  if (!claimed) return { sent: false, duplicate: true }

  const payload = JSON.stringify({
    title: article.title.slice(0, 120),
    body: `${article.source} · ${matchedKeywords.join(', ')}`.slice(0, 180),
    url: article.link,
    tag: `ai-news-${articleKey}`,
  })

  try {
    await sendNotification({
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    }, payload, { TTL: 60 * 60 * 24 })
    return { sent: true }
  } catch (error) {
    const statusCode = Number(error?.statusCode)
    if (statusCode === 404 || statusCode === 410) {
      await removeSubscription(supabase, subscription)
      return { sent: false, removed: true }
    }

    await deleteDelivery(supabase, subscription, articleKey)
    console.error('AI watch push delivery failed', {
      subscriptionId: subscription.id,
      statusCode: Number.isFinite(statusCode) ? statusCode : null,
    })
    return { sent: false, failed: true }
  }
}

async function runWithConcurrency(items, limit, task) {
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      await task(items[index])
    }
  })
  await Promise.all(workers)
}

export default async function notifyAiWatchers() {
  const config = getServerConfig()
  if (!config) return jsonResponse({ error: 'AI watch server configuration is incomplete.' }, 503)

  const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  setVapidDetails(config.subject, config.publicKey, config.privateKey)

  const now = new Date()
  if (now.getUTCHours() === 2 && now.getUTCMinutes() < 15) {
    await supabase
      .from('ai_watch_deliveries')
      .delete()
      .lt('delivered_at', new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString())
  }

  const [keywordsResult, subscriptionsResult, feedResult] = await Promise.all([
    supabase
      .from('ai_watch_keywords')
      .select('id,user_id,keyword,created_at')
      .order('created_at', { ascending: true })
      .limit(1000),
    supabase
      .from('ai_watch_subscriptions')
      .select('id,user_id,endpoint,p256dh,auth')
      .order('created_at', { ascending: true })
      .limit(1000),
    fetchAiNews({ limit: 60 }),
  ])

  if (keywordsResult.error || subscriptionsResult.error) {
    console.error('AI watch data could not be loaded', {
      keywords: Boolean(keywordsResult.error),
      subscriptions: Boolean(subscriptionsResult.error),
    })
    return jsonResponse({ error: 'AI watch data could not be loaded.' }, 500)
  }

  if (feedResult.availableSourceIds.length === 0) {
    return jsonResponse({ error: 'No news source is available right now.' }, 502)
  }

  const keywordsByUser = new Map()
  for (const keyword of keywordsResult.data ?? []) {
    if (!keywordsByUser.has(keyword.user_id)) keywordsByUser.set(keyword.user_id, [])
    keywordsByUser.get(keyword.user_id).push(keyword)
  }

  const subscriptionsByUser = new Map()
  for (const subscription of subscriptionsResult.data ?? []) {
    if (!subscriptionsByUser.has(subscription.user_id)) subscriptionsByUser.set(subscription.user_id, [])
    subscriptionsByUser.get(subscription.user_id).push(subscription)
  }

  const oldestArticleTime = now.getTime() - recentArticleWindowMs
  const jobs = []
  for (const article of feedResult.articles) {
    const publishedTime = Date.parse(article.publishedAt ?? '')
    if (!Number.isFinite(publishedTime)
      || publishedTime < oldestArticleTime
      || publishedTime > now.getTime() + 5 * 60 * 1000) continue

    for (const [userId, userKeywords] of keywordsByUser) {
      const recentKeywords = userKeywords.filter((keyword) => Date.parse(keyword.created_at) <= publishedTime)
      if (!recentKeywords.length) continue

      const matchedKeywords = findMatchingKeywords(`${article.title} ${article.summary}`, recentKeywords)
      if (!matchedKeywords.length) continue

      for (const subscription of subscriptionsByUser.get(userId) ?? []) {
        jobs.push({ subscription, article, matchedKeywords, articleKey: getArticleKey(article.link) })
      }
    }
  }

  let sent = 0
  let failed = 0
  await runWithConcurrency(jobs, 12, async (job) => {
    try {
      const result = await sendToSubscription(
        supabase,
        job.subscription,
        job.article,
        job.matchedKeywords,
        job.articleKey,
      )
      if (result.sent) sent += 1
      if (result.failed) failed += 1
    } catch (error) {
      failed += 1
      console.error('AI watch push job failed', {
        subscriptionId: job.subscription.id,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      })
    }
  })

  return jsonResponse({
    articlesRead: feedResult.articles.length,
    activeWatchers: keywordsByUser.size,
    subscriptions: subscriptionsResult.data?.length ?? 0,
    notificationsSent: sent,
    notificationsFailed: failed,
    sourcesAvailable: feedResult.availableSourceIds.length,
  })
}

export const config = { schedule: '*/15 * * * *' }
