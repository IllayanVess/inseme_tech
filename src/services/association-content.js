import { supabase } from '../lib/supabase.js'

const pageSize = 6

export async function getPublishedAssociationPage(slug, now = new Date().toISOString()) {
  if (!supabase) return null

  const { data: association, error: associationError } = await supabase
    .from('associations')
    .select('id,slug,name,introduction_fr,introduction_en,mission_fr,mission_en,public_email,public_phone,website_url,theme_accent,published_at')
    .eq('slug', slug)
    .eq('visibility', 'published')
    .not('published_at', 'is', null)
    .lte('published_at', now)
    .maybeSingle()

  if (associationError) throw associationError
  if (!association) return { association: null, socialLinks: [], events: [] }

  const [linksResult, eventsResult] = await Promise.all([
    supabase
      .from('association_social_links')
      .select('platform,url,label_fr,label_en,display_order')
      .eq('association_id', association.id)
      .eq('publication_status', 'published')
      .order('display_order', { ascending: true })
      .limit(12),
    supabase
      .from('events')
      .select('slug,category,title_fr,title_en,summary_fr,summary_en,starts_at,event_status')
      .eq('association_id', association.id)
      .eq('publication_status', 'published')
      .not('published_at', 'is', null)
      .lte('published_at', now)
      .gte('starts_at', now)
      .neq('event_status', 'cancelled')
      .neq('event_status', 'completed')
      .order('starts_at', { ascending: true })
      .limit(pageSize),
  ])

  if (linksResult.error) throw linksResult.error
  if (eventsResult.error) throw eventsResult.error

  return {
    association,
    socialLinks: linksResult.data || [],
    events: eventsResult.data || [],
  }
}

export async function getMyActiveAssociationMemberships() {
  if (!supabase) return null

  const { data: sessionResult, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  const userId = sessionResult.session?.user?.id
  if (!userId) return []

  const { data, error } = await supabase
    .from('association_memberships')
    .select('id,association_id,permission_role,created_at,association:associations!inner(slug,name,visibility,published_at)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(20)

  if (error) throw error
  return data || []
}
