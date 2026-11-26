import { supabase } from '../lib/supabase.js'

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function getAccountSession() {
  return supabase.auth.getSession()
}

export async function getAccountUser() {
  return supabase.auth.getUser()
}

export async function refreshAccountSession() {
  return supabase.auth.refreshSession()
}

export async function callAccountAdministration(action, values = {}) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !session?.access_token) {
    return {
      data: { code: 'auth_session_missing' },
      error: sessionError ?? new Error('Sign in is required for account administration.'),
    }
  }

  const result = await supabase.functions.invoke('manage-users', {
    body: { action, ...values },
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (!result.error) return result

  const response = result.error.context
  if (response && typeof response.json === 'function') {
    try {
      return { data: await response.json(), error: result.error }
    } catch {
      return result
    }
  }
  return result
}

export function onAccountChange(callback) {
  return supabase.auth.onAuthStateChange(callback)
}
