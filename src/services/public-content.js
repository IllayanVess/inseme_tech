import { supabase } from '../lib/supabase.js'

const getOne = async (buildQuery) => {
  if (!supabase) return null

  const { data, error } = await buildQuery(supabase)
  if (error) throw error
  return data
}

export async function getPublishedEvents({
  period = 'upcoming',
  category = 'all',
  status = 'all',
  dateFrom,
  dateTo,
  offset = 0,
  limit = 12,
  now = new Date().toISOString(),
} = {}) {
  if (!supabase) return { data: [], count: 0 }

  let query = supabase
    .from('events')
    .select('slug,category,title_fr,title_en,summary_fr,summary_en,description_fr,description_en,location_fr,location_en,starts_at,ends_at,event_status,registration_deadline,registration_capacity,published_at', { count: 'exact' })
    .eq('publication_status', 'published')
    .not('published_at', 'is', null)
    .lte('published_at', now)

  if (period === 'past') {
    query = query.lt('starts_at', now).order('starts_at', { ascending: false })
  } else {
    query = query.gte('starts_at', now).neq('event_status', 'cancelled').neq('event_status', 'completed')
      .order('starts_at', { ascending: true })
  }

  if (category !== 'all') query = query.eq('category', category)
  if (status !== 'all') query = query.eq('event_status', status)
  if (dateFrom) query = query.gte('starts_at', dateFrom)
  if (dateTo) query = query.lte('starts_at', dateTo)

  const { data, count, error } = await query.range(offset, offset + limit - 1)
  if (error) throw error
  return { data: data || [], count: count || 0 }
}

export function getUpcomingEvent(now = new Date().toISOString()) {
  return getOne(
    (client) => client
      .from('events')
      .select('title_fr,title_en,summary_fr,summary_en,description_fr,description_en,location_fr,location_en,starts_at,event_status')
      .eq('publication_status', 'published')
      .not('published_at', 'is', null)
      .lte('published_at', now)
      .gte('starts_at', now)
      .neq('event_status', 'cancelled')
      .neq('event_status', 'completed')
      .order('starts_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  )
}

export function getLatestProject(now = new Date().toISOString()) {
  return getOne(
    (client) => client
      .from('projects')
      .select('title_fr,title_en,summary_fr,summary_en,description_fr,description_en,project_status,published_at')
      .eq('publication_status', 'published')
      .not('published_at', 'is', null)
      .lte('published_at', now)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  )
}

export function getLatestAnnouncement(now = new Date().toISOString()) {
  return getOne(
    (client) => client
      .from('announcements')
      .select('title_fr,title_en,summary_fr,summary_en,body_fr,body_en,published_at')
      .eq('publication_status', 'published')
      .not('published_at', 'is', null)
      .lte('published_at', now)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  )
}
