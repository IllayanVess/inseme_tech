import { createClient, type User } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
})

function getDefaultKey(value: string | undefined, legacyValue: string | undefined) {
  if (value) {
    try {
      const keys = JSON.parse(value)
      if (typeof keys.default === 'string') return keys.default
    } catch {
      // Fall back to the legacy key while projects finish migrating API keys.
    }
  }
  return legacyValue
}

function normalizeEmail(email: string | undefined) {
  return email?.trim().toLocaleLowerCase('en-US') ?? ''
}

async function countAdministrators(admin: ReturnType<typeof createClient>) {
  const perPage = 1000
  let count = 0

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error('Could not verify administrator accounts.')
    count += data.users.filter((user) => user.app_metadata?.role === 'admin').length
    if (data.users.length < perPage) return count
  }

  throw new Error('The user list is too large to verify safely.')
}

async function findUser(admin: ReturnType<typeof createClient>, id: string) {
  const { data, error } = await admin.auth.admin.getUserById(id)
  if (error || !data.user) throw new Error('Account not found.')
  return data.user
}

async function findUserByEmail(admin: ReturnType<typeof createClient>, email: string) {
  const expectedEmail = normalizeEmail(email)
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error('Could not verify the selected account.')
    const match = data.users.find((user) => normalizeEmail(user.email) === expectedEmail)
    if (match) return match
    if (data.users.length < 1000) return null
  }
  throw new Error('The user list is too large to search safely.')
}

async function getUserEmails(admin: ReturnType<typeof createClient>, userIds: Set<string>) {
  const emails = new Map<string, string>()
  if (!userIds.size) return emails

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error('Could not load association presidents.')
    data.users.forEach((user) => {
      if (userIds.has(user.id)) emails.set(user.id, user.email ?? '')
    })
    if (emails.size === userIds.size || data.users.length < 1000) return emails
  }

  throw new Error('The user list is too large to load safely.')
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  try {
    const authorization = request.headers.get('Authorization')
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) return json({ error: 'Sign in is required.' }, 401)

    const url = Deno.env.get('SUPABASE_URL')
    const publishableKey = getDefaultKey(
      Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'),
      Deno.env.get('SUPABASE_ANON_KEY'),
    )
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !publishableKey || !serviceKey) {
      return json({ error: 'Account administration is not configured.' }, 503)
    }

    const userClient = createClient(url, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: verified, error: authError } = await userClient.auth.getUser(token)
    if (authError || !verified.user) return json({ error: 'Your session is no longer valid.' }, 401)
    const caller = verified.user

    const rawBody = await request.text()
    if (rawBody.length > 16384) return json({ error: 'Request is too large.' }, 413)
    const body = JSON.parse(rawBody) as {
      action?: string
      page?: number
      perPage?: number
      userId?: string
      role?: string
      associationId?: string
      memberEmail?: string
      displayName?: string
      language?: string
      presidentEmail?: string
      slug?: string
      name?: string
      introductionFr?: string
      introductionEn?: string
      missionFr?: string
      missionEn?: string
      publicEmail?: string
    }
    const action = body.action
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const callerIsAdmin = caller.app_metadata?.role === 'admin'
    const firstAdminEmail = normalizeEmail(Deno.env.get('INITIAL_ADMIN_EMAIL'))

    if (action === 'bootstrap-status' || action === 'bootstrap') {
      if (callerIsAdmin || !firstAdminEmail || normalizeEmail(caller.email) !== firstAdminEmail || !caller.email_confirmed_at) {
        return action === 'bootstrap-status'
          ? json({ canBootstrap: false })
          : json({ error: 'This account cannot initialize administrator access.' }, 403)
      }

      const administratorCount = await countAdministrators(admin)
      if (action === 'bootstrap-status') return json({ canBootstrap: administratorCount === 0 })
      if (administratorCount !== 0) return json({ error: 'Administrator access has already been initialized.' }, 409)

      const { data: updated, error } = await admin.auth.admin.updateUserById(caller.id, {
        app_metadata: { ...caller.app_metadata, role: 'admin' },
      })
      if (error || !updated.user) return json({ error: 'Could not activate administrator access.' }, 500)
      return json({ ok: true, role: 'admin' })
    }

    if (action === 'add-association-member') {
      const associationId = typeof body.associationId === 'string' ? body.associationId : ''
      const memberEmail = typeof body.memberEmail === 'string' ? normalizeEmail(body.memberEmail) : ''
      const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
      const language = body.language === 'en' ? 'en' : 'fr'
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(associationId)
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(memberEmail)
        || !displayName || displayName.length > 120) {
        return json({ error: 'Enter a valid association, member email, and display name.' }, 400)
      }

      if (!callerIsAdmin) {
        const { data: membership, error: membershipError } = await admin
          .from('association_memberships')
          .select('id')
          .eq('association_id', associationId)
          .eq('user_id', caller.id)
          .eq('permission_role', 'president')
          .eq('status', 'active')
          .maybeSingle()
        if (membershipError) return json({ error: 'Could not verify association access.' }, 500)
        if (!membership) return json({ error: 'President access to this association is required.' }, 403)
      }

      const existingUser = await findUserByEmail(admin, memberEmail)
      let memberUser = existingUser
      let invitationSent = false
      if (!memberUser) {
        const configuredSiteUrl = Deno.env.get('SITE_URL')
        let siteUrl: URL
        try {
          siteUrl = new URL(configuredSiteUrl ?? '')
        } catch {
          return json({ error: 'Member invitations are not configured on the server.' }, 503)
        }
        if (siteUrl.protocol !== 'https:' && siteUrl.hostname !== 'localhost' && siteUrl.hostname !== '127.0.0.1') {
          return json({ error: 'Member invitations are not configured on the server.' }, 503)
        }

        const redirectPath = language === 'en' ? '/en/account/' : '/compte/'
        const { data, error } = await admin.auth.admin.inviteUserByEmail(memberEmail, {
          redirectTo: new URL(redirectPath, siteUrl).toString(),
        })
        if (error || !data.user) return json({ error: 'Could not send the member invitation.' }, 502)
        memberUser = data.user
        invitationSent = true
      }

      const profileSlug = displayName
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60)
      const slug = `${profileSlug || 'member'}-${memberUser.id.slice(0, 8)}`
      const { error } = await admin.rpc('admin_add_association_member', {
        p_association_id: associationId,
        p_member_user_id: memberUser.id,
        p_assigned_by: caller.id,
        p_profile_slug: slug,
        p_display_name: displayName,
      })
      if (error) return json({ error: 'The account could not be added to this association.' }, 409)
      return json({ ok: true, invitationSent })
    }

    if (!callerIsAdmin) return json({ error: 'Administrator access is required.' }, 403)

    if (action === 'list-associations') {
      const { data: associations, error: associationError } = await admin
        .from('associations')
        .select('id,slug,name,introduction_fr,introduction_en,mission_fr,mission_en,public_email,public_phone,website_url,theme_accent,visibility,published_at')
        .order('name', { ascending: true })
        .limit(100)
      if (associationError) return json({ error: 'Could not load associations.' }, 500)

      const associationIds = (associations ?? []).map((association) => association.id)
      const { data: memberships, error: membershipError } = associationIds.length
        ? await admin
          .from('association_memberships')
          .select('association_id,user_id')
          .in('association_id', associationIds)
          .eq('permission_role', 'president')
          .eq('status', 'active')
        : { data: [], error: null }
      if (membershipError) return json({ error: 'Could not load association presidents.' }, 500)

      const presidentMemberships = memberships ?? []
      const emails = await getUserEmails(admin, new Set(presidentMemberships.map((row) => row.user_id)))
      const presidents = new Map(presidentMemberships.map((row) => [
        row.association_id,
        emails.get(row.user_id) ?? '',
      ]))
      return json({
        associations: (associations ?? []).map((association) => ({
          ...association,
          presidentEmail: presidents.get(association.id) ?? '',
        })),
      })
    }

    if (action === 'create-association' || action === 'set-president') {
      const presidentEmail = typeof body.presidentEmail === 'string'
        ? normalizeEmail(body.presidentEmail)
        : ''
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(presidentEmail)) {
        return json({ error: 'Enter the email of a confirmed account.' }, 400)
      }

      const president = await findUserByEmail(admin, presidentEmail)
      if (!president || !president.email_confirmed_at) {
        return json({ error: 'No confirmed account matches that email.' }, 404)
      }

      if (action === 'create-association') {
        const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''
        const name = typeof body.name === 'string' ? body.name.trim() : ''
        const introductionFr = typeof body.introductionFr === 'string' ? body.introductionFr.trim() : ''
        const introductionEn = typeof body.introductionEn === 'string' ? body.introductionEn.trim() : ''
        const missionFr = typeof body.missionFr === 'string' ? body.missionFr.trim() : ''
        const missionEn = typeof body.missionEn === 'string' ? body.missionEn.trim() : ''
        const publicEmail = typeof body.publicEmail === 'string' ? body.publicEmail.trim() : ''
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !name
          || name.length > 120 || !introductionFr || !introductionEn
          || introductionFr.length > 2000 || introductionEn.length > 2000
          || missionFr.length > 2000 || missionEn.length > 2000
          || Boolean(missionFr) !== Boolean(missionEn)
          || (publicEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(publicEmail))) {
          return json({ error: 'Check the association details and both language versions.' }, 400)
        }

        const { data, error } = await admin.rpc('admin_create_association', {
          p_slug: slug,
          p_name: name,
          p_introduction_fr: introductionFr,
          p_introduction_en: introductionEn,
          p_mission_fr: missionFr || null,
          p_mission_en: missionEn || null,
          p_public_email: publicEmail || null,
          p_assigned_by: caller.id,
          p_president_user_id: president.id,
        })
        if (error) return json({ error: 'Could not create the association. Check that its address is unique.' }, 409)
        return json({ ok: true, associationId: data })
      }

      const associationId = typeof body.associationId === 'string' ? body.associationId : ''
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(associationId)) {
        return json({ error: 'Choose a valid association.' }, 400)
      }
      const { error } = await admin.rpc('admin_set_association_president', {
        p_association_id: associationId,
        p_president_user_id: president.id,
        p_assigned_by: caller.id,
      })
      if (error) return json({ error: 'Could not assign this president.' }, 409)
      return json({ ok: true, associationId, presidentEmail: president.email })
    }

    if (action === 'list-users') {
      const page = Number.isInteger(body.page) ? Math.max(1, Math.min(10000, body.page!)) : 1
      const perPage = Number.isInteger(body.perPage) ? Math.max(1, Math.min(100, body.perPage!)) : 50
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
      if (error) return json({ error: 'Could not load accounts.' }, 500)
      return json({
        users: data.users.map((user: User) => ({
          id: user.id,
          email: user.email ?? '',
          role: user.app_metadata?.role === 'admin' ? 'admin' : 'member',
        })),
        hasMore: data.users.length === perPage,
      })
    }

    if (action === 'set-role') {
      const userId = typeof body.userId === 'string' ? body.userId : ''
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
        return json({ error: 'Choose a valid account.' }, 400)
      }
      if (body.role !== 'member' && body.role !== 'admin') {
        return json({ error: 'Choose a valid role.' }, 400)
      }

      const target = await findUser(admin, userId)
      const targetIsAdmin = target.app_metadata?.role === 'admin'
      if (targetIsAdmin && body.role === 'member' && await countAdministrators(admin) <= 1) {
        return json({ error: 'At least one administrator must remain.' }, 409)
      }

      const { error } = await admin.auth.admin.updateUserById(target.id, {
        app_metadata: { ...target.app_metadata, role: body.role },
      })
      if (error) return json({ error: 'Could not update this account role.' }, 500)
      return json({ ok: true, userId: target.id, role: body.role })
    }

    return json({ error: 'Unknown action.' }, 400)
  } catch {
    return json({ error: 'Could not complete the account request.' }, 500)
  }
})
