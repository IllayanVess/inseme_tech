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

    return json({ error: 'Unknown action.' }, 400)
  } catch {
    return json({ error: 'Could not complete the account request.' }, 500)
  }
})
