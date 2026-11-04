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
    .select('id,association_id,permission_role,created_at,association:associations!inner(id,slug,name,introduction_fr,introduction_en,mission_fr,mission_en,public_email,public_phone,website_url,theme_accent,visibility,published_at)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(20)

  if (error) throw error
  return data || []
}

export async function updateAssociationPage(associationId, values) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { data, error } = await supabase
    .from('associations')
    .update(values)
    .eq('id', associationId)
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Association page was not updated.')
  return data
}

export async function getAssociationEvents(associationId) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { data, error } = await supabase
    .from('events')
    .select('id,association_id,slug,category,title_fr,title_en,summary_fr,summary_en,description_fr,description_en,location_fr,location_en,starts_at,ends_at,timezone_name,event_status,registration_deadline,registration_capacity,publication_status,published_at')
    .eq('association_id', associationId)
    .order('starts_at', { ascending: true })
    .limit(100)

  if (error) throw error
  return data ?? []
}

export async function createAssociationEvent(associationId, values) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { data, error } = await supabase
    .from('events')
    .insert({ association_id: associationId, ...values })
    .select('id')
    .single()

  if (error) throw error
  return data
}

export async function updateAssociationEvent(associationId, eventId, values) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { data, error } = await supabase
    .from('events')
    .update(values)
    .eq('association_id', associationId)
    .eq('id', eventId)
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Event was not updated.')
  return data
}

export async function getMyMemberProfiles() {
  if (!supabase) return null

  const { data: sessionResult, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  const userId = sessionResult.session?.user?.id
  if (!userId) return []

  const { data: memberships, error: membershipError } = await supabase
    .from('association_memberships')
    .select('id,association_id,association:associations!inner(slug,name)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(50)

  if (membershipError) throw membershipError
  if (!memberships?.length) return []

  const { data: profiles, error: profileError } = await supabase
    .from('member_profiles')
    .select('id,association_id,membership_id,slug,display_name,bio_fr,bio_en,is_public,consented_at')
    .in('membership_id', memberships.map((membership) => membership.id))
    .limit(50)

  if (profileError) throw profileError
  const membershipsById = new Map(memberships.map((membership) => [membership.id, membership]))
  return (profiles ?? []).map((profile) => ({
    ...profile,
    association: membershipsById.get(profile.membership_id)?.association,
  }))
}

export async function updateMyMemberProfile(profileId, values) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { data, error } = await supabase
    .from('member_profiles')
    .update(values)
    .eq('id', profileId)
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Member profile was not updated.')
  return data
}

async function getPublishedAssociation(slug, now) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('associations')
    .select('id,slug,name,introduction_fr,introduction_en,mission_fr,mission_en,visibility,published_at')
    .eq('slug', slug)
    .eq('visibility', 'published')
    .not('published_at', 'is', null)
    .lte('published_at', now)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function getPublishedAssociationMembers(associationSlug, now = new Date().toISOString()) {
  const association = await getPublishedAssociation(associationSlug, now)
  if (!association) return { association: null, members: [] }

  const { data, error } = await supabase
    .from('member_profiles')
    .select('slug,display_name,bio_fr,bio_en')
    .eq('association_id', association.id)
    .eq('is_public', true)
    .not('consented_at', 'is', null)
    .lte('consented_at', now)
    .order('display_name', { ascending: true })
    .limit(100)

  if (error) throw error
  return { association, members: data ?? [] }
}

export async function getPublishedMemberProfile(associationSlug, memberSlug, now = new Date().toISOString()) {
  const association = await getPublishedAssociation(associationSlug, now)
  if (!association) return { association: null, member: null }

  const { data, error } = await supabase
    .from('member_profiles')
    .select('slug,display_name,bio_fr,bio_en')
    .eq('association_id', association.id)
    .eq('slug', memberSlug)
    .eq('is_public', true)
    .not('consented_at', 'is', null)
    .lte('consented_at', now)
    .maybeSingle()

  if (error) throw error
  return { association, member: data }
}
