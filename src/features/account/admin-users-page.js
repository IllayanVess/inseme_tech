import { isSupabaseConfigured } from '../../lib/supabase.js'
import { callAccountAdministration } from '../../services/account.js'
import { getPlatformAdmin } from './admin-access.js'

const copy = {
  fr: { notConfigured: 'La connexion à Supabase n’est pas configurée.', signIn: 'Connectez-vous depuis la page Mon compte.', adminRequired: 'Cette page est réservée aux administrateurs.', ready: 'Gestion des comptes.', error: 'Impossible de charger les comptes.', loading: 'Chargement…', none: 'Aucun compte à afficher.', email: 'E-mail', member: 'Membre', admin: 'Administrateur', save: 'Enregistrer', saved: 'Rôle mis à jour.', saveError: 'Impossible de modifier ce rôle.', more: 'Charger plus de comptes.' },
  en: { notConfigured: 'Supabase sign-in is not configured.', signIn: 'Sign in from the My account page.', adminRequired: 'This page is for administrators.', ready: 'Account administration.', error: 'Could not load accounts.', loading: 'Loading…', none: 'There are no accounts to show.', email: 'Email', member: 'Member', admin: 'Administrator', save: 'Save', saved: 'Role updated.', saveError: 'Could not change this role.', more: 'Load more accounts.' },
}

export function initializeAdminUsersPage() {
  const root = document.querySelector('[data-admin-users-page]')
  if (!root) return
  const text = copy[document.documentElement.lang === 'en' ? 'en' : 'fr']
  const status = root.querySelector('[data-admin-page-status]')
  const body = root.querySelector('[data-admin-page-body]')
  const list = root.querySelector('[data-admin-user-list]')
  const more = root.querySelector('[data-admin-load-more]')
  let page = 0
  let hasMore = false

  const loadUsers = async (append = false) => {
    const nextPage = append ? page + 1 : 1
    more.disabled = true
    const { data, error } = await callAccountAdministration('list-users', { page: nextPage, perPage: 50 })
    more.disabled = false
    if (error || !Array.isArray(data?.users)) {
      status.textContent = text.error
      return
    }
    page = nextPage
    hasMore = Boolean(data.hasMore)
    more.hidden = !hasMore
    if (!append) list.replaceChildren()
    if (!data.users.length && !append) {
      const empty = document.createElement('p')
      empty.textContent = text.none
      list.append(empty)
    }
    data.users.forEach((user) => {
      const row = document.createElement('div')
      row.className = 'account-user-row'
      row.dataset.userId = user.id
      const email = document.createElement('span')
      email.className = 'account-user-email'
      email.textContent = user.email || text.email
      const select = document.createElement('select')
      select.setAttribute('aria-label', `${text.email}: ${user.email || user.id}`)
      for (const [value, label] of [['member', text.member], ['admin', text.admin]]) {
        const option = document.createElement('option')
        option.value = value
        option.textContent = label
        option.selected = user.role === value
        select.append(option)
      }
      const button = document.createElement('button')
      button.className = 'account-role-save'
      button.type = 'button'
      button.dataset.saveRole = ''
      button.textContent = text.save
      row.append(email, select, button)
      list.append(row)
    })
  }

  if (!isSupabaseConfigured) {
    status.textContent = text.notConfigured
    return
  }
  getPlatformAdmin(root, text).then(async (user) => {
    if (!user) return
    body.hidden = false
    await loadUsers()
  })

  list.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-save-role]')
    if (!button) return
    const row = button.closest('[data-user-id]')
    button.disabled = true
    const { error } = await callAccountAdministration('set-role', {
      userId: row.dataset.userId,
      role: row.querySelector('select').value,
    })
    button.disabled = false
    status.textContent = error ? text.saveError : text.saved
    if (!error) await loadUsers()
  })
  more.addEventListener('click', () => loadUsers(true))
}
