import { supabase } from '../lib/supabase.js'

const pageSize = 6

export async function getPublishedAssociationPage(slug, now = new Date().toISOString()) {
  if (!supabase) return null

  const { data: association, error: associationError } = await supabase
    .from('associations')
    .select('id,slug,name,introduction_fr,introduction_en,mission_fr,mission_en,logo_path,logo_alt_fr,logo_alt_en,cover_path,cover_alt_fr,cover_alt_en,public_email,public_phone,website_url,theme_accent,published_at')
    .eq('slug', slug)
    .eq('visibility', 'published')
    .not('published_at', 'is', null)
    .lte('published_at', now)
    .maybeSingle()

  if (associationError) throw associationError
  if (!association) return { association: null, socialLinks: [], events: [], sections: [], team: [] }

  const [linksResult, eventsResult, sectionsResult] = await Promise.all([
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
    supabase
      .from('association_page_sections')
      .select('id,section_type,section_key,content_fr,content_en,display_order')
      .eq('association_id', association.id)
      .eq('publication_status', 'published')
      .not('published_at', 'is', null)
      .lte('published_at', now)
      .order('display_order', { ascending: true })
      .limit(30),
  ])

  if (linksResult.error) throw linksResult.error
  if (eventsResult.error) throw eventsResult.error
  if (sectionsResult.error) throw sectionsResult.error

  const [positionsResult, profilesResult, assignmentsResult] = await Promise.all([
    supabase
      .from('association_positions')
      .select('id,title_fr,title_en,responsibility_fr,responsibility_en,tasks_fr,tasks_en')
      .eq('association_id', association.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .limit(50),
    supabase
      .from('member_profiles')
      .select('id,display_name,slug')
      .eq('association_id', association.id)
      .eq('is_public', true)
      .limit(100),
    supabase
      .from('member_position_assignments')
      .select('position_id,member_profile_id,display_order')
      .eq('association_id', association.id)
      .is('ends_at', null)
      .order('display_order', { ascending: true })
      .limit(100),
  ])
  if (positionsResult.error) throw positionsResult.error
  if (profilesResult.error) throw profilesResult.error
  if (assignmentsResult.error) throw assignmentsResult.error

  const positions = new Map((positionsResult.data || []).map((position) => [position.id, position]))
  const profiles = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]))
  const team = (assignmentsResult.data || []).flatMap((assignment) => {
    const position = positions.get(assignment.position_id)
    const profile = profiles.get(assignment.member_profile_id)
    return position && profile ? [{ ...assignment, position, profile }] : []
  })

  const signedAsset = async (path) => {
    if (!path) return null
    const { data, error } = await supabase.storage
      .from('association-media')
      .createSignedUrl(path, 3600)
    if (error) throw error
    return data.signedUrl
  }
  const [logoUrl, coverUrl] = await Promise.all([
    signedAsset(association.logo_path),
    signedAsset(association.cover_path),
  ])

  return {
    association: { ...association, logo_url: logoUrl, cover_url: coverUrl },
    socialLinks: linksResult.data || [],
    events: eventsResult.data || [],
    sections: sectionsResult.data || [],
    team,
  }
}

export async function getPublishedAssociations(now = new Date().toISOString()) {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('associations')
    .select('id,slug,name,introduction_fr,introduction_en,theme_accent,published_at')
    .eq('visibility', 'published')
    .not('published_at', 'is', null)
    .lte('published_at', now)
    .order('name', { ascending: true })
    .limit(100)

  if (error) throw error
  return data || []
}

export async function getMyActiveAssociationMemberships() {
  if (!supabase) return null

  const { data: sessionResult, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  const userId = sessionResult.session?.user?.id
  if (!userId) return []

  const { data, error } = await supabase
    .from('association_memberships')
    .select('id,association_id,permission_role,created_at,association:associations!inner(id,slug,name,introduction_fr,introduction_en,mission_fr,mission_en,logo_path,logo_alt_fr,logo_alt_en,cover_path,cover_alt_fr,cover_alt_en,public_email,public_phone,website_url,theme_accent,visibility,published_at)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(20)

  if (error) throw error
  return data || []
}

export async function getWorkspaceAssociations() {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('associations')
    .select('id,slug,name,visibility,published_at')
    .order('name', { ascending: true })
    .limit(100)

  if (error) throw error
  return data || []
}

export async function getWorkspaceEditorData(associationId) {
  if (!supabase) return null

  const [associationResult, sectionsResult, linksResult, positionsResult, profilesResult, assignmentsResult] = await Promise.all([
    supabase
      .from('associations')
      .select('id,slug,name,introduction_fr,introduction_en,mission_fr,mission_en,logo_path,logo_alt_fr,logo_alt_en,cover_path,cover_alt_fr,cover_alt_en,theme_accent,public_email,public_phone,website_url,visibility,published_at')
      .eq('id', associationId)
      .single(),
    supabase
      .from('association_page_sections')
      .select('id,section_type,section_key,content_fr,content_en,display_order,publication_status,published_at')
      .eq('association_id', associationId)
      .order('display_order', { ascending: true })
      .limit(30),
    supabase
      .from('association_social_links')
      .select('id,platform,url,label_fr,label_en,display_order,publication_status')
      .eq('association_id', associationId)
      .order('display_order', { ascending: true })
      .limit(20),
    supabase
      .from('association_positions')
      .select('id,slug,title_fr,title_en,responsibility_fr,responsibility_en,tasks_fr,tasks_en,display_order,is_active')
      .eq('association_id', associationId)
      .order('display_order', { ascending: true })
      .limit(50),
    supabase
      .from('member_profiles')
      .select('id,display_name,slug')
      .eq('association_id', associationId)
      .eq('is_public', true)
      .order('display_name', { ascending: true })
      .limit(100),
    supabase
      .from('member_position_assignments')
      .select('id,position_id,member_profile_id,display_order,ends_at')
      .eq('association_id', associationId)
      .is('ends_at', null)
      .order('display_order', { ascending: true })
      .limit(100),
  ])

  for (const result of [associationResult, sectionsResult, linksResult, positionsResult, profilesResult, assignmentsResult]) {
    if (result.error) throw result.error
  }

  const signedAsset = async (path) => {
    if (!path) return null
    const { data, error } = await supabase.storage
      .from('association-media')
      .createSignedUrl(path, 3600)
    if (error) throw error
    return data.signedUrl
  }
  const [logoUrl, coverUrl] = await Promise.all([
    signedAsset(associationResult.data.logo_path),
    signedAsset(associationResult.data.cover_path),
  ])

  return {
    association: { ...associationResult.data, logo_url: logoUrl, cover_url: coverUrl },
    sections: sectionsResult.data || [],
    socialLinks: linksResult.data || [],
    positions: positionsResult.data || [],
    profiles: profilesResult.data || [],
    assignments: assignmentsResult.data || [],
  }
}

export async function saveAssociationProfile(associationId, values) {
  const { data, error } = await supabase
    .from('associations')
    .update(values)
    .eq('id', associationId)
    .select('id')
    .single()

  if (error) throw error
  return data
}

export async function saveAssociationSocialLink(associationId, link) {
  const { id, ...values } = link
  const query = id
    ? supabase.from('association_social_links').update(values).eq('id', id).eq('association_id', associationId)
    : supabase.from('association_social_links').insert({ ...values, association_id: associationId })
  const { data, error } = await query.select('id').single()
  if (error) throw error
  return data
}

export async function deleteAssociationSocialLink(associationId, id) {
  const { error } = await supabase
    .from('association_social_links')
    .delete()
    .eq('id', id)
    .eq('association_id', associationId)
  if (error) throw error
}

export async function saveAssociationSection(associationId, section) {
  const { data, error } = await supabase
    .from('association_page_sections')
    .upsert({ ...section, association_id: associationId }, { onConflict: 'association_id,section_key' })
    .select('id')
    .single()
  if (error) throw error
  return data
}

export async function deleteAssociationSection(associationId, id) {
  const { error } = await supabase
    .from('association_page_sections')
    .delete()
    .eq('id', id)
    .eq('association_id', associationId)
  if (error) throw error
}

export async function saveAssociationPosition(associationId, position) {
  const { id, ...values } = position
  const query = id
    ? supabase.from('association_positions').update(values).eq('id', id).eq('association_id', associationId)
    : supabase.from('association_positions').insert({ ...values, association_id: associationId })
  const { data, error } = await query.select('id').single()
  if (error) throw error
  return data
}

export async function assignMemberPosition(associationId, positionId, profileId) {
  const { data, error } = await supabase
    .from('member_position_assignments')
    .insert({
      association_id: associationId,
      position_id: positionId,
      member_profile_id: profileId,
      display_order: 0,
    })
    .select('id')
    .single()
  if (error) throw error
  return data
}

export async function endMemberPosition(associationId, assignmentId) {
  const { error } = await supabase
    .from('member_position_assignments')
    .update({ ends_at: new Date().toISOString().slice(0, 10) })
    .eq('association_id', associationId)
    .eq('id', assignmentId)
    .is('ends_at', null)
  if (error) throw error
}

export async function uploadAssociationMedia(associationId, file) {
  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
  const path = `${associationId}/identity/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage
    .from('association-media')
    .upload(path, file, { cacheControl: '3600', contentType: file.type, upsert: false })
  if (error) throw error
  return path
}

export async function removeAssociationMedia(path) {
  if (!path) return
  const { error } = await supabase.storage.from('association-media').remove([path])
  if (error) throw error
}
