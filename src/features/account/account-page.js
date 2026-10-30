import { isSupabaseConfigured } from '../../lib/supabase.js'
import {
  callAccountAdministration,
  getAccountSession,
  onAccountChange,
  refreshAccountSession,
  signIn,
  signOut,
} from '../../services/account.js'

const pageCopy = {
  fr: {
    loading: 'Chargement de votre espace…',
    unavailable: 'La connexion à votre espace n’est pas encore configurée sur ce site.',
    signedOut: 'Connectez-vous pour accéder à votre espace membre.',
    signedIn: 'Vous êtes connecté.',
    member: 'Membre',
    admin: 'Administrateur',
    roleSaved: 'Rôle mis à jour.',
    adminReady: 'Votre compte administrateur est activé.',
    genericError: 'Une erreur est survenue. Vérifiez les informations et réessayez.',
    invalidCredentials: 'Adresse e-mail ou mot de passe incorrect.',
    emailNotConfirmed: 'Cette adresse e-mail n’a pas été confirmée. Contactez un administrateur.',
    accountDisabled: 'Ce compte est temporairement désactivé. Contactez un administrateur.',
    tooManyAttempts: 'Trop de tentatives. Réessayez dans quelques minutes.',
    roleUpdateError: 'Impossible de modifier ce rôle. Vérifiez vos droits et réessayez.',
    noUsers: 'Aucun autre compte à afficher.',
    save: 'Enregistrer',
    memberOption: 'Membre',
    adminOption: 'Administrateur',
    email: 'E-mail',
    accountLoadError: 'Impossible de charger les comptes.',
    bootstrapUnavailable: 'La configuration du premier compte administrateur est indisponible.',
  },
  en: {
    loading: 'Loading your account…',
    unavailable: 'Sign-in is not configured on this site yet.',
    signedOut: 'Sign in to access your member space.',
    signedIn: 'You are signed in.',
    member: 'Member',
    admin: 'Administrator',
    roleSaved: 'Role updated.',
    adminReady: 'Your administrator account is active.',
    genericError: 'Something went wrong. Check your details and try again.',
    invalidCredentials: 'The email or password is incorrect.',
    emailNotConfirmed: 'This email address has not been confirmed. Contact an administrator.',
    accountDisabled: 'This account is temporarily disabled. Contact an administrator.',
    tooManyAttempts: 'Too many attempts. Try again in a few minutes.',
    roleUpdateError: 'Could not change this role. Check your access and try again.',
    noUsers: 'There are no more accounts to show.',
    save: 'Save',
    memberOption: 'Member',
    adminOption: 'Administrator',
    email: 'Email',
    accountLoadError: 'Could not load accounts.',
    bootstrapUnavailable: 'First administrator setup is not available.',
  },
}

export function initializeAccountPage() {
  const root = document.querySelector('[data-account-page]')
  if (!root) return

  const copy = pageCopy[document.documentElement.lang === 'en' ? 'en' : 'fr']
  const status = root.querySelector('[data-account-status]')
  const forms = root.querySelector('[data-account-forms]')
  const profile = root.querySelector('[data-account-profile]')
  const adminPanel = root.querySelector('[data-admin-panel]')
  const userList = root.querySelector('[data-user-list]')
  const loadMoreButton = root.querySelector('[data-load-more]')
  const bootstrapButton = root.querySelector('[data-bootstrap-admin]')
  const bootstrapHelp = root.querySelector('[data-bootstrap-help]')
  const pageSize = 50
  let page = 0
  let hasMoreUsers = false
  let currentUser = null

  const setStatus = (message) => { status.textContent = message }

  if (!isSupabaseConfigured) {
    setStatus(copy.unavailable)
    return
  }

  forms.hidden = false

  const renderProfile = async (user) => {
    currentUser = user
    const isAdmin = user?.app_metadata?.role === 'admin'
    forms.hidden = Boolean(user)
    profile.hidden = !user
    adminPanel.hidden = true
    bootstrapButton.hidden = true
    bootstrapHelp.hidden = true
    userList.replaceChildren()
    loadMoreButton.hidden = true
    page = 0

    if (!user) {
      setStatus(copy.signedOut)
      return
    }

    root.querySelector('[data-account-email]').textContent = user.email ?? ''
    root.querySelector('[data-account-role]').textContent = isAdmin ? copy.admin : copy.member
    setStatus(copy.signedIn)

    if (isAdmin) {
      adminPanel.hidden = false
      await loadUsers({ append: false })
      return
    }

    const { data, error } = await callAccountAdministration('bootstrap-status')
    if (error) return
    if (data?.canBootstrap) {
      adminPanel.hidden = false
      bootstrapButton.hidden = false
    }
  }

  const loadUsers = async ({ append }) => {
    if (!currentUser || currentUser.app_metadata?.role !== 'admin') return
    const requestedPage = append ? page + 1 : 1
    loadMoreButton.disabled = true
    const { data, error } = await callAccountAdministration('list-users', {
      page: requestedPage,
      perPage: pageSize,
    })
    loadMoreButton.disabled = false

    if (error || !Array.isArray(data?.users)) {
      setStatus(copy.accountLoadError)
      return
    }

    page = requestedPage
    hasMoreUsers = data.hasMore
    if (!append) userList.replaceChildren()
    data.users.forEach((user) => userList.append(createUserRow(user, copy)))
    loadMoreButton.hidden = !hasMoreUsers
    if (!data.users.length && !append) {
      const empty = document.createElement('p')
      empty.textContent = copy.noUsers
      userList.append(empty)
    }
  }

  root.querySelector('[data-signin-form]').addEventListener('submit', async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    setStatus(copy.loading)
    const { error } = await signIn(values.get('email').trim(), values.get('password'))
    if (error) {
      setStatus(messageForAuthError(error, copy))
      return
    }
    form.reset()
    const { data } = await getAccountSession()
    await renderProfile(data.session?.user ?? null)
  })

  root.querySelector('[data-signout]').addEventListener('click', async () => {
    const { error } = await signOut()
    if (error) {
      setStatus(copy.genericError)
      return
    }
    await renderProfile(null)
  })

  bootstrapButton.addEventListener('click', async () => {
    bootstrapButton.disabled = true
    setStatus(copy.loading)
    const { error } = await callAccountAdministration('bootstrap')
    bootstrapButton.disabled = false
    if (error) {
      setStatus(copy.bootstrapUnavailable)
      return
    }
    const { data, error: refreshError } = await refreshAccountSession()
    if (refreshError) {
      setStatus(copy.genericError)
      return
    }
    setStatus(copy.adminReady)
    await renderProfile(data.session?.user ?? currentUser)
  })

  loadMoreButton.addEventListener('click', () => loadUsers({ append: true }))

  userList.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-save-role]')
    if (!button) return
    const row = button.closest('[data-user-id]')
    const select = row.querySelector('select')
    button.disabled = true
    const { error } = await callAccountAdministration('set-role', {
      userId: row.dataset.userId,
      role: select.value,
    })
    button.disabled = false
    setStatus(error ? copy.roleUpdateError : copy.roleSaved)
    if (!error) await loadUsers({ append: false })
  })

  onAccountChange((_event, session) => {
    const nextUser = session?.user ?? null
    if (nextUser?.id === currentUser?.id) return
    window.setTimeout(() => renderProfile(nextUser), 0)
  })

  setStatus(copy.loading)
  getAccountSession().then(({ data, error }) => {
    if (error) {
      setStatus(copy.genericError)
      return
    }
    renderProfile(data.session?.user ?? null)
  })
}

function createUserRow(user, copy) {
  const row = document.createElement('div')
  row.className = 'account-user-row'
  row.dataset.userId = user.id

  const email = document.createElement('span')
  email.className = 'account-user-email'
  email.textContent = user.email || copy.email

  const select = document.createElement('select')
  select.setAttribute('aria-label', `${copy.email}: ${user.email || user.id}`)
  for (const [value, label] of [['member', copy.memberOption], ['admin', copy.adminOption]]) {
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
  button.textContent = copy.save

  row.append(email, select, button)
  return row
}

function messageForAuthError(error, copy) {
  if (['invalid_credentials', 'user_not_found'].includes(error.code)) return copy.invalidCredentials
  if (error.code === 'email_not_confirmed') return copy.emailNotConfirmed
  if (error.code === 'user_banned') return copy.accountDisabled
  if (['over_request_rate_limit', 'too_many_requests'].includes(error.code)) return copy.tooManyAttempts
  return copy.genericError
}
