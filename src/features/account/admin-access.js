import { getAccountSession, getAccountUser } from '../../services/account.js'

export async function getPlatformAdmin(root, messages) {
  const status = root.querySelector('[data-admin-page-status]')
  const { data: sessionData, error: sessionError } = await getAccountSession()
  if (sessionError) {
    status.textContent = messages.error
    return null
  }
  if (!sessionData.session) {
    status.textContent = messages.signIn
    return null
  }

  const { data, error } = await getAccountUser()
  if (error) {
    status.textContent = messages.error
    return null
  }
  if (data.user?.app_metadata?.role !== 'admin') {
    status.textContent = messages.adminRequired
    return null
  }
  status.textContent = messages.ready
  return data.user
}
