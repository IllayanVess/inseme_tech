import { supabase } from '../lib/supabase.js'

export async function getWorkspaceAssociations() {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('associations')
    .select('id,slug,name,visibility,published_at')
    .order('name', { ascending: true })
    .limit(100)

  if (error) throw error
  return data ?? []
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
    sections: sectionsResult.data ?? [],
    socialLinks: linksResult.data ?? [],
    positions: positionsResult.data ?? [],
    profiles: profilesResult.data ?? [],
    assignments: assignmentsResult.data ?? [],
  }
}

export async function saveAssociationProfile(associationId, values) {
  if (!supabase) throw new Error('Supabase is not configured.')

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
  if (!supabase) throw new Error('Supabase is not configured.')

  const { id, ...values } = link
  const query = id
    ? supabase.from('association_social_links').update(values).eq('id', id).eq('association_id', associationId)
    : supabase.from('association_social_links').insert({ ...values, association_id: associationId })
  const { data, error } = await query.select('id').single()
  if (error) throw error
  return data
}

export async function deleteAssociationSocialLink(associationId, id) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { error } = await supabase
    .from('association_social_links')
    .delete()
    .eq('id', id)
    .eq('association_id', associationId)
  if (error) throw error
}

export async function saveAssociationSection(associationId, section) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { data, error } = await supabase
    .from('association_page_sections')
    .upsert({ ...section, association_id: associationId }, { onConflict: 'association_id,section_key' })
    .select('id')
    .single()
  if (error) throw error
  return data
}

export async function deleteAssociationSection(associationId, id) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { error } = await supabase
    .from('association_page_sections')
    .delete()
    .eq('id', id)
    .eq('association_id', associationId)
  if (error) throw error
}

export async function saveAssociationPosition(associationId, position) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { id, ...values } = position
  const query = id
    ? supabase.from('association_positions').update(values).eq('id', id).eq('association_id', associationId)
    : supabase.from('association_positions').insert({ ...values, association_id: associationId })
  const { data, error } = await query.select('id').single()
  if (error) throw error
  return data
}

export async function assignMemberPosition(associationId, positionId, profileId) {
  if (!supabase) throw new Error('Supabase is not configured.')

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
  if (!supabase) throw new Error('Supabase is not configured.')

  const { error } = await supabase
    .from('member_position_assignments')
    .update({ ends_at: new Date().toISOString().slice(0, 10) })
    .eq('association_id', associationId)
    .eq('id', assignmentId)
    .is('ends_at', null)
  if (error) throw error
}

export async function uploadAssociationMedia(associationId, file) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
  const path = `${associationId}/identity/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage
    .from('association-media')
    .upload(path, file, { cacheControl: '3600', contentType: file.type, upsert: false })
  if (error) throw error
  return path
}

export async function removeAssociationMedia(path) {
  if (!supabase) throw new Error('Supabase is not configured.')
  if (!path) return

  const { error } = await supabase.storage.from('association-media').remove([path])
  if (error) throw error
}
