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

async function findUserByEmail(admin: ReturnType<typeof createClient>, email: string): Promise<User | null> {
  const wantedEmail = email.trim().toLowerCase()
  const perPage = 1000

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error('Could not verify the account.')
    const match = data.users.find((user) => user.email?.toLowerCase() === wantedEmail)
    if (match) return match
    if (data.users.length < perPage) break
  }

  return null
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function validEmail(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
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
    if (rawBody.length > 4096) return json({ error: 'Request is too large.' }, 413)
    const body = JSON.parse(rawBody) as {
      action?: string
      page?: number
      perPage?: number
      userId?: string
      role?: string
      slug?: string
      name?: string
      introductionFr?: string
      introductionEn?: string
      presidentEmail?: string
      associationId?: string
      memberEmail?: string
    }
    const action = body.action
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const callerIsAdmin = caller.app_metadata?.role === 'admin'
    if (!callerIsAdmin) return json({ error: 'Administrator access is required.' }, 403)

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

    if (action === 'create-workspace') {
      const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      const introductionFr = typeof body.introductionFr === 'string' ? body.introductionFr.trim() : ''
      const introductionEn = typeof body.introductionEn === 'string' ? body.introductionEn.trim() : ''
      if (!/^([a-z0-9]+-)*[a-z0-9]+$/.test(slug)
        || name.length < 1 || name.length > 120
        || introductionFr.length < 1 || introductionFr.length > 4000
        || introductionEn.length < 1 || introductionEn.length > 4000
        || !validEmail(body.presidentEmail)) {
        return json({ error: 'Complete the required workspace fields.' }, 400)
      }

      let president: User
      const foundPresident = await findUserByEmail(admin, body.presidentEmail)
      if (!foundPresident) return json({ error: 'The president account was not found.', code: 'account_not_found' }, 404)
      president = foundPresident
      if (!president.email_confirmed_at) {
        return json({ error: 'The president account must confirm its email first.', code: 'account_not_confirmed' }, 409)
      }

      const { data, error } = await admin.rpc('create_association_workspace', {
        p_slug: slug,
        p_name: name,
        p_introduction_fr: introductionFr,
        p_introduction_en: introductionEn,
        p_president_user_id: president.id,
        p_assigned_by: caller.id,
      })
      if (error) {
        if (error.code === '23505') return json({ error: 'That association address is already in use.', code: 'workspace_exists' }, 409)
        return json({ error: 'Could not create the association workspace.', code: 'workspace_create_failed' }, 500)
      }
      return json({ ok: true, associationId: data })
    }

    if (action === 'set-president') {
      if (!isUuid(body.associationId) || !validEmail(body.presidentEmail)) {
        return json({ error: 'Choose a workspace and a valid account.' }, 400)
      }

      let president: User
      const foundPresident = await findUserByEmail(admin, body.presidentEmail)
      if (!foundPresident) return json({ error: 'The president account was not found.', code: 'account_not_found' }, 404)
      president = foundPresident
      if (!president.email_confirmed_at) {
        return json({ error: 'The president account must confirm its email first.', code: 'account_not_confirmed' }, 409)
      }

      const { error } = await admin.rpc('set_association_president', {
        p_association_id: body.associationId,
        p_president_user_id: president.id,
        p_assigned_by: caller.id,
      })
      if (error) {
        if (error.code === '23503') return json({ error: 'The association or account was not found.', code: 'workspace_or_account_not_found' }, 404)
        return json({ error: 'Could not assign the association president.', code: 'president_assignment_failed' }, 500)
      }
      return json({ ok: true, associationId: body.associationId })
    }

    if (action === 'end-membership') {
      if (!isUuid(body.associationId) || !validEmail(body.memberEmail)) {
        return json({ error: 'Choose a workspace and a valid account.' }, 400)
      }

      const member = await findUserByEmail(admin, body.memberEmail)
      if (!member) return json({ error: 'The member account was not found.', code: 'account_not_found' }, 404)
      const { data: membership, error: membershipError } = await admin
        .from('association_memberships')
        .select('id,permission_role,status')
        .eq('association_id', body.associationId)
        .eq('user_id', member.id)
        .maybeSingle()
      if (membershipError) return json({ error: 'Could not verify workspace membership.', code: 'membership_check_failed' }, 500)
      if (!membership) return json({ error: 'The account is not a member of this workspace.', code: 'membership_not_found' }, 404)
      if (membership.permission_role === 'president') {
        return json({ error: 'Assign a new president before removing this access.', code: 'president_transfer_required' }, 409)
      }
      if (membership.status === 'ended') return json({ ok: true })

      const { error } = await admin
        .from('association_memberships')
        .update({ status: 'ended' })
        .eq('id', membership.id)
      if (error) return json({ error: 'Could not remove workspace access.', code: 'membership_remove_failed' }, 500)
      return json({ ok: true })
    }

    return json({ error: 'Unknown action.' }, 400)
  } catch {
    return json({ error: 'Could not complete the account request.' }, 500)
  }
})
