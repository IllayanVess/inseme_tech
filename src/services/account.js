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

export async function callAccountAdministration(action, values = {}) {
  return supabase.functions.invoke('manage-users', {
    body: { action, ...values },
  })
}

export function onAccountChange(callback) {
  return supabase.auth.onAuthStateChange(callback)
}
