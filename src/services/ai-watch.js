import { supabase } from '../lib/supabase.js'

const keywordLimit = 20

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

export async function getAiNewsFeed() {
  const response = await fetch('/api/ai-news', { headers: { Accept: 'application/json' } })
  const result = await response.json()
  if (!response.ok && !Array.isArray(result.sources)) throw new Error('AI news feed is unavailable.')
  return result
}

export async function getMyAiWatchKeywords(userId) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('ai_watch_keywords')
    .select('id,keyword,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(keywordLimit)

  if (error) throw error
  return data ?? []
}

export async function addAiWatchKeyword(userId, keyword) {
  const client = requireSupabase()
  const cleanKeyword = String(keyword ?? '').trim()
  if (cleanKeyword.length < 2 || cleanKeyword.length > 80) throw new Error('Invalid keyword.')

  const { data, error } = await client
    .from('ai_watch_keywords')
    .insert({ user_id: userId, keyword: cleanKeyword })
    .select('id,keyword,created_at')
    .single()

  if (error) throw error
  return data
}

export async function removeAiWatchKeyword(userId, keywordId) {
  const client = requireSupabase()
  const { error } = await client
    .from('ai_watch_keywords')
    .delete()
    .eq('id', keywordId)
    .eq('user_id', userId)

  if (error) throw error
}

export async function getWebPushPublicKey() {
  const response = await fetch('/api/push-key', { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('Push notifications are not configured.')
  const { publicKey } = await response.json()
  if (typeof publicKey !== 'string' || !publicKey) throw new Error('Push public key is missing.')
  return publicKey
}

export async function saveMyPushSubscription(userId, subscription) {
  const client = requireSupabase()
  const { data: existing, error: lookupError } = await client
    .from('ai_watch_subscriptions')
    .select('id')
    .eq('endpoint', subscription.endpoint)
    .maybeSingle()

  if (lookupError) throw lookupError
  if (existing) return existing

  const { data, error } = await client
    .from('ai_watch_subscriptions')
    .insert({ user_id: userId, ...subscription })
    .select('id')
    .single()

  if (error) throw error
  return data
}

export async function removeMyPushSubscription(userId, endpoint) {
  const client = requireSupabase()
  const { error } = await client
    .from('ai_watch_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint)

  if (error) throw error
}
