import { isSupabaseConfigured } from '../../lib/supabase.js'
import {
  getMyMemberProfiles,
  getMyActiveAssociationMemberships,
  updateAssociationPage,
  updateMyMemberProfile,
} from '../../services/association-content.js'
import {
  callAccountAdministration,
  getAccountSession,
  onAccountChange,
  refreshAccountSession,
  signIn,
  signOut,
  updateAccountPassword,
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
    workspaces: 'Mes associations',
    noWorkspaces: 'Aucune adhésion active à afficher.',
    workspaceLoadError: 'Impossible de charger vos associations.',
    president: 'Président',
    memberRole: 'Membre',
    viewAssociation: 'Voir la page publique',
    unpublishedWorkspace: 'La page publique de cette association n’est pas encore publiée.',
    editPage: 'Modifier la page',
    pageSaved: 'Page de l’association enregistrée.',
    pageSaveError: 'Impossible d’enregistrer la page. Vérifiez les champs et vos droits.',
    pageName: 'Nom',
    introductionFr: 'Présentation — français',
    introductionEn: 'Présentation — anglais',
    missionFr: 'Mission — français',
    missionEn: 'Mission — anglais',
    publicEmail: 'E-mail public',
    publicPhone: 'Téléphone public',
    websiteUrl: 'Site web (HTTPS)',
    themeAccent: 'Couleur d’accent',
    visibility: 'Publication',
    draft: 'Brouillon',
    published: 'Publié',
    archived: 'Archivé',
    savePage: 'Enregistrer la page',
    noManagedAssociations: 'Aucune association à gérer.',
    associationLoadError: 'Impossible de charger les associations.',
    noPresident: 'Aucun président actif',
    presidentEmail: 'E-mail du président confirmé',
    assignPresident: 'Attribuer / transférer la présidence',
    presidentSaved: 'Présidence attribuée.',
    presidentSaveError: 'Impossible d’attribuer cette présidence. Vérifiez le compte et réessayez.',
    associationCreated: 'Association créée et présidence attribuée.',
    associationCreateError: 'Impossible de créer l’association. Vérifiez les informations, le slug et le compte confirmé.',
    members: 'Membres',
    inviteMember: 'Ajouter un membre',
    memberEmail: 'Adresse e-mail du membre',
    memberName: 'Nom à afficher',
    addMember: 'Ajouter le membre et envoyer l’invitation',
    memberAdded: 'Membre ajouté à cette association.',
    memberInvited: 'Invitation envoyée. Le membre pourra ensuite compléter et publier son profil.',
    memberAddError: 'Impossible d’ajouter ce membre. Vérifiez son e-mail et réessayez.',
    memberProfiles: 'Mon profil public',
    memberProfile: 'Profil de membre',
    profileName: 'Nom à afficher',
    profileBioFr: 'Biographie — français',
    profileBioEn: 'Biography — English',
    profileConsent: 'J’accepte de publier ce profil sur le site de mon association.',
    saveProfile: 'Enregistrer mon profil',
    profileSaved: 'Profil enregistré.',
    profileSaveError: 'Impossible d’enregistrer le profil. Remplissez les deux biographies ou laissez-les vides.',
    passwordSaved: 'Mot de passe enregistré.',
    passwordError: 'Impossible d’enregistrer le mot de passe. Utilisez au moins 10 caractères.',
    passwordLabel: 'Définir ou modifier le mot de passe',
    accents: { indigo: 'Indigo', cyan: 'Cyan', violet: 'Violet', blue: 'Bleu' },
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
    workspaces: 'My associations',
    noWorkspaces: 'There are no active memberships to show.',
    workspaceLoadError: 'Could not load your associations.',
    president: 'President',
    memberRole: 'Member',
    viewAssociation: 'View public page',
    unpublishedWorkspace: 'This association’s public page is not published yet.',
    editPage: 'Edit page',
    pageSaved: 'Association page saved.',
    pageSaveError: 'Could not save this page. Check the fields and your access.',
    pageName: 'Name',
    introductionFr: 'Introduction — French',
    introductionEn: 'Introduction — English',
    missionFr: 'Mission — French',
    missionEn: 'Mission — English',
    publicEmail: 'Public email',
    publicPhone: 'Public phone',
    websiteUrl: 'Website (HTTPS)',
    themeAccent: 'Accent color',
    visibility: 'Publication',
    draft: 'Draft',
    published: 'Published',
    archived: 'Archived',
    savePage: 'Save page',
    noManagedAssociations: 'There are no associations to manage.',
    associationLoadError: 'Could not load associations.',
    noPresident: 'No active president',
    presidentEmail: 'Confirmed president account email',
    assignPresident: 'Assign / transfer presidency',
    presidentSaved: 'Presidency assigned.',
    presidentSaveError: 'Could not assign this president. Check the account and try again.',
    associationCreated: 'Association created and presidency assigned.',
    associationCreateError: 'Could not create the association. Check the details, slug, and confirmed account.',
    members: 'Members',
    inviteMember: 'Add a member',
    memberEmail: 'Member email address',
    memberName: 'Display name',
    addMember: 'Add member and send invitation',
    memberAdded: 'Member added to this association.',
    memberInvited: 'Invitation sent. The member can then complete and publish their profile.',
    memberAddError: 'Could not add this member. Check the email and try again.',
    memberProfiles: 'My public profile',
    memberProfile: 'Member profile',
    profileName: 'Display name',
    profileBioFr: 'Biography — French',
    profileBioEn: 'Biography — English',
    profileConsent: 'I agree to publish this profile on my association’s website.',
    saveProfile: 'Save my profile',
    profileSaved: 'Profile saved.',
    profileSaveError: 'Could not save your profile. Fill in both biographies or leave both blank.',
    passwordSaved: 'Password saved.',
    passwordError: 'Could not save the password. Use at least 10 characters.',
    passwordLabel: 'Set or change password',
    accents: { indigo: 'Indigo', cyan: 'Cyan', violet: 'Violet', blue: 'Blue' },
  },
}

export function initializeAccountPage() {
  const root = document.querySelector('[data-account-page]')
  if (!root) return

  const copy = pageCopy[document.documentElement.lang === 'en' ? 'en' : 'fr']
  const status = root.querySelector('[data-account-status]')
  const forms = root.querySelector('[data-account-forms]')
  const profile = root.querySelector('[data-account-profile]')
  const workspaceList = root.querySelector('[data-workspace-list]')
  const memberProfiles = root.querySelector('[data-member-profiles]')
  const passwordForm = root.querySelector('[data-password-form]')
  const associationEditors = root.querySelector('[data-association-editors]')
  const adminPanel = root.querySelector('[data-admin-panel]')
  const associationList = root.querySelector('[data-association-list]')
  const associationCreateForm = root.querySelector('[data-association-create-form]')
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
    associationEditors.replaceChildren()
    associationList.replaceChildren()
    memberProfiles.replaceChildren()
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
    await loadWorkspaces()
    await loadMemberProfiles()

    if (isAdmin) {
      adminPanel.hidden = false
      await Promise.all([loadUsers({ append: false }), loadAssociations()])
      return
    }

    const { data, error } = await callAccountAdministration('bootstrap-status')
    if (error) return
    if (data?.canBootstrap) {
      adminPanel.hidden = false
      bootstrapButton.hidden = false
    }
  }

  const loadWorkspaces = async () => {
    workspaceList.replaceChildren()
    if (currentUser?.app_metadata?.role !== 'admin') associationEditors.replaceChildren()
    try {
      const memberships = await getMyActiveAssociationMemberships()
      if (!memberships?.length) {
        appendWorkspaceMessage(workspaceList, copy.noWorkspaces)
        return
      }
      memberships.forEach((membership) => {
        const association = membership.association
        if (!association?.slug || !association?.name) return
        workspaceList.append(createWorkspaceRow(membership, copy))
        if (membership.permission_role === 'president' && currentUser?.app_metadata?.role !== 'admin') {
          associationEditors.append(createAssociationEditor(association, copy))
        }
      })
    } catch {
      appendWorkspaceMessage(workspaceList, copy.workspaceLoadError)
    }
  }

  const loadMemberProfiles = async () => {
    memberProfiles.replaceChildren()
    try {
      const profiles = await getMyMemberProfiles()
      if (!profiles?.length) return
      const heading = document.createElement('h3')
      heading.textContent = copy.memberProfiles
      memberProfiles.append(heading)
      profiles.forEach((profile) => memberProfiles.append(createMemberProfileEditor(profile, copy)))
    } catch {
      appendWorkspaceMessage(memberProfiles, copy.workspaceLoadError)
    }
  }

  const loadAssociations = async () => {
    const { data, error } = await callAccountAdministration('list-associations')
    if (error || !Array.isArray(data?.associations)) {
      setStatus(copy.associationLoadError)
      return
    }

    associationEditors.replaceChildren()
    associationList.replaceChildren()
    if (!data.associations.length) {
      appendWorkspaceMessage(associationList, copy.noManagedAssociations)
      appendWorkspaceMessage(associationEditors, copy.noManagedAssociations)
      return
    }

    data.associations.forEach((association) => {
      associationList.append(createAssociationManagementRow(association, copy))
      associationEditors.append(createAssociationEditor(association, copy))
    })
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

  associationCreateForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const submit = form.querySelector('[type="submit"]')
    const values = new FormData(form)
    submit.disabled = true
    setStatus(copy.loading)
    const { error } = await callAccountAdministration('create-association', {
      slug: values.get('slug'),
      name: values.get('name'),
      presidentEmail: values.get('presidentEmail'),
      introductionFr: values.get('introductionFr'),
      introductionEn: values.get('introductionEn'),
      missionFr: values.get('missionFr'),
      missionEn: values.get('missionEn'),
      publicEmail: values.get('publicEmail'),
    })
    submit.disabled = false
    if (error) {
      setStatus(copy.associationCreateError)
      return
    }
    form.reset()
    setStatus(copy.associationCreated)
    await loadAssociations()
    await loadWorkspaces()
  })

  associationEditors.addEventListener('submit', async (event) => {
    const inviteForm = event.target.closest('[data-member-invite-form]')
    if (inviteForm) {
      event.preventDefault()
      const submit = inviteForm.querySelector('[type="submit"]')
      const values = new FormData(inviteForm)
      submit.disabled = true
      setStatus(copy.loading)
      const { data, error } = await callAccountAdministration('add-association-member', {
        associationId: inviteForm.dataset.associationId,
        memberEmail: values.get('memberEmail'),
        displayName: values.get('displayName'),
        language: document.documentElement.lang === 'en' ? 'en' : 'fr',
      })
      submit.disabled = false
      if (error) {
        setStatus(copy.memberAddError)
        return
      }
      inviteForm.reset()
      setStatus(data?.invitationSent ? copy.memberInvited : copy.memberAdded)
      return
    }

    const form = event.target.closest('[data-association-edit-form]')
    if (!form) return
    event.preventDefault()
    const submit = form.querySelector('[type="submit"]')
    const values = new FormData(form)
    const visibility = values.get('visibility')
    const publishedAt = form.dataset.publishedAt
    submit.disabled = true
    setStatus(copy.loading)
    try {
      await updateAssociationPage(form.dataset.associationId, {
        name: values.get('name').trim(),
        introduction_fr: values.get('introduction_fr').trim(),
        introduction_en: values.get('introduction_en').trim(),
        mission_fr: values.get('mission_fr').trim() || null,
        mission_en: values.get('mission_en').trim() || null,
        public_email: values.get('public_email').trim() || null,
        public_phone: values.get('public_phone').trim() || null,
        website_url: values.get('website_url').trim() || null,
        theme_accent: values.get('theme_accent'),
        visibility,
        published_at: visibility === 'published' ? (publishedAt || new Date().toISOString()) : null,
      })
      form.dataset.publishedAt = visibility === 'published'
        ? (publishedAt || new Date().toISOString())
        : ''
      setStatus(copy.pageSaved)
      await loadWorkspaces()
      if (currentUser?.app_metadata?.role === 'admin') await loadAssociations()
    } catch {
      setStatus(copy.pageSaveError)
    } finally {
      submit.disabled = false
    }
  })

  memberProfiles.addEventListener('submit', async (event) => {
    const form = event.target.closest('[data-member-profile-form]')
    if (!form) return
    event.preventDefault()
    const submit = form.querySelector('[type="submit"]')
    const values = new FormData(form)
    const bioFr = values.get('bio_fr').trim()
    const bioEn = values.get('bio_en').trim()
    if (Boolean(bioFr) !== Boolean(bioEn)) {
      setStatus(copy.profileSaveError)
      return
    }

    submit.disabled = true
    setStatus(copy.loading)
    try {
      const isPublic = values.get('is_public') === 'on'
      await updateMyMemberProfile(form.dataset.profileId, {
        display_name: values.get('display_name').trim(),
        bio_fr: bioFr || null,
        bio_en: bioEn || null,
        is_public: isPublic,
        consented_at: isPublic ? new Date().toISOString() : null,
      })
      setStatus(copy.profileSaved)
    } catch {
      setStatus(copy.profileSaveError)
    } finally {
      submit.disabled = false
    }
  })

  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const values = new FormData(passwordForm)
    const password = values.get('password')
    const submit = passwordForm.querySelector('[type="submit"]')
    submit.disabled = true
    setStatus(copy.loading)
    const { error } = await updateAccountPassword(password)
    submit.disabled = false
    if (error) {
      setStatus(copy.passwordError)
      return
    }
    passwordForm.reset()
    setStatus(copy.passwordSaved)
  })

  associationList.addEventListener('submit', async (event) => {
    const form = event.target.closest('[data-president-form]')
    if (!form) return
    event.preventDefault()
    const submit = form.querySelector('[type="submit"]')
    const email = new FormData(form).get('presidentEmail')
    submit.disabled = true
    setStatus(copy.loading)
    const { error } = await callAccountAdministration('set-president', {
      associationId: form.dataset.associationId,
      presidentEmail: email,
    })
    submit.disabled = false
    if (error) {
      setStatus(copy.presidentSaveError)
      return
    }
    setStatus(copy.presidentSaved)
    await loadAssociations()
  })

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

function createWorkspaceRow(membership, copy) {
  const row = document.createElement('article')
  row.className = 'account-workspace-row'
  const details = document.createElement('div')
  const name = document.createElement('h3')
  name.textContent = membership.association.name
  const role = document.createElement('span')
  role.className = 'account-role'
  role.textContent = membership.permission_role === 'president' ? copy.president : copy.memberRole
  details.append(name, role)
  row.append(details)

  const isPublished = membership.association.visibility === 'published'
    && membership.association.published_at
    && new Date(membership.association.published_at).getTime() <= Date.now()
  if (isPublished) {
    const link = document.createElement('a')
    link.className = 'account-workspace-link'
    link.href = `/associations/${encodeURIComponent(membership.association.slug)}/`
    link.textContent = copy.viewAssociation
    row.append(link)
  } else {
    const note = document.createElement('p')
    note.className = 'account-workspace-note'
    note.textContent = copy.unpublishedWorkspace
    row.append(note)
  }

  return row
}

function createAssociationEditor(association, copy) {
  const details = document.createElement('details')
  details.className = 'account-association-editor'
  const summary = document.createElement('summary')
  summary.textContent = `${copy.editPage} — ${association.name}`
  details.append(summary)

  const form = document.createElement('form')
  form.dataset.associationEditForm = ''
  form.dataset.associationId = association.id
  form.dataset.publishedAt = association.published_at ?? ''

  const fields = [
    { name: 'name', label: copy.pageName, required: true, maxLength: 120 },
    { name: 'introduction_fr', label: copy.introductionFr, multiline: true, required: true, maxLength: 2000 },
    { name: 'introduction_en', label: copy.introductionEn, multiline: true, required: true, maxLength: 2000 },
    { name: 'mission_fr', label: copy.missionFr, multiline: true, maxLength: 2000 },
    { name: 'mission_en', label: copy.missionEn, multiline: true, maxLength: 2000 },
    { name: 'public_email', label: copy.publicEmail, type: 'email' },
    { name: 'public_phone', label: copy.publicPhone, type: 'tel' },
    { name: 'website_url', label: copy.websiteUrl, type: 'url' },
  ]

  fields.forEach((field) => {
    const label = document.createElement('label')
    label.textContent = field.label
    const input = document.createElement(field.multiline ? 'textarea' : 'input')
    input.name = field.name
    if (field.type) input.type = field.type
    if (field.maxLength) input.maxLength = field.maxLength
    if (field.required) input.required = true
    if (field.multiline) input.rows = 3
    input.value = association[field.name] ?? ''
    label.htmlFor = `association-${association.id}-${field.name}`
    input.id = label.htmlFor
    form.append(label, input)
  })

  const accentLabel = document.createElement('label')
  accentLabel.textContent = copy.themeAccent
  const accentSelect = document.createElement('select')
  accentSelect.name = 'theme_accent'
  accentSelect.id = `association-${association.id}-theme-accent`
  accentLabel.htmlFor = accentSelect.id
  Object.entries(copy.accents).forEach(([value, label]) => {
    const option = document.createElement('option')
    option.value = value
    option.textContent = label
    option.selected = association.theme_accent === value
    accentSelect.append(option)
  })
  form.append(accentLabel, accentSelect)

  const visibilityLabel = document.createElement('label')
  visibilityLabel.textContent = copy.visibility
  const visibilitySelect = document.createElement('select')
  visibilitySelect.name = 'visibility'
  visibilitySelect.id = `association-${association.id}-visibility`
  visibilityLabel.htmlFor = visibilitySelect.id
  const visibilityOptions = ['draft', 'published', 'archived']
  visibilityOptions.forEach((value) => {
    const option = document.createElement('option')
    option.value = value
    option.textContent = copy[value]
    option.selected = association.visibility === value
    visibilitySelect.append(option)
  })
  form.append(visibilityLabel, visibilitySelect)

  const save = document.createElement('button')
  save.className = 'button button-dark account-submit'
  save.type = 'submit'
  save.textContent = copy.savePage
  form.append(save)
  details.append(form)
  details.append(createMemberInviteForm(association, copy))
  return details
}

function createMemberInviteForm(association, copy) {
  const form = document.createElement('form')
  form.className = 'association-member-invite'
  form.dataset.memberInviteForm = ''
  form.dataset.associationId = association.id

  const heading = document.createElement('h4')
  heading.textContent = copy.inviteMember
  const emailLabel = document.createElement('label')
  emailLabel.htmlFor = `member-email-${association.id}`
  emailLabel.textContent = copy.memberEmail
  const email = document.createElement('input')
  email.id = emailLabel.htmlFor
  email.name = 'memberEmail'
  email.type = 'email'
  email.autocomplete = 'email'
  email.required = true

  const nameLabel = document.createElement('label')
  nameLabel.htmlFor = `member-name-${association.id}`
  nameLabel.textContent = copy.memberName
  const name = document.createElement('input')
  name.id = nameLabel.htmlFor
  name.name = 'displayName'
  name.maxLength = 120
  name.required = true

  const button = document.createElement('button')
  button.className = 'button button-dark account-submit'
  button.type = 'submit'
  button.textContent = copy.addMember
  form.append(heading, emailLabel, email, nameLabel, name, button)
  return form
}

function createMemberProfileEditor(profile, copy) {
  const details = document.createElement('details')
  details.className = 'account-association-editor'
  const summary = document.createElement('summary')
  summary.textContent = `${copy.memberProfile} — ${profile.association?.name ?? ''}`
  details.append(summary)

  const form = document.createElement('form')
  form.dataset.memberProfileForm = ''
  form.dataset.profileId = profile.id

  const fields = [
    { name: 'display_name', label: copy.profileName, value: profile.display_name, required: true },
    { name: 'bio_fr', label: copy.profileBioFr, value: profile.bio_fr, multiline: true },
    { name: 'bio_en', label: copy.profileBioEn, value: profile.bio_en, multiline: true },
  ]
  fields.forEach((field) => {
    const label = document.createElement('label')
    label.textContent = field.label
    const input = document.createElement(field.multiline ? 'textarea' : 'input')
    input.id = `profile-${profile.id}-${field.name}`
    input.name = field.name
    input.value = field.value ?? ''
    if (field.required) input.required = true
    if (field.multiline) {
      input.rows = 3
      input.maxLength = 2000
    }
    label.htmlFor = input.id
    form.append(label, input)
  })

  const consentLabel = document.createElement('label')
  consentLabel.className = 'member-profile-consent'
  const consent = document.createElement('input')
  consent.type = 'checkbox'
  consent.name = 'is_public'
  consent.checked = profile.is_public
  consentLabel.append(consent, document.createTextNode(copy.profileConsent))

  const save = document.createElement('button')
  save.className = 'button button-dark account-submit'
  save.type = 'submit'
  save.textContent = copy.saveProfile
  form.append(consentLabel, save)
  details.append(form)
  return details
}

function createAssociationManagementRow(association, copy) {
  const row = document.createElement('article')
  row.className = 'account-association-row'
  const heading = document.createElement('h4')
  heading.textContent = association.name
  const currentPresident = document.createElement('p')
  currentPresident.textContent = association.presidentEmail || copy.noPresident

  const form = document.createElement('form')
  form.dataset.presidentForm = ''
  form.dataset.associationId = association.id
  const label = document.createElement('label')
  label.htmlFor = `president-${association.id}`
  label.textContent = copy.presidentEmail
  const email = document.createElement('input')
  email.id = label.htmlFor
  email.name = 'presidentEmail'
  email.type = 'email'
  email.autocomplete = 'email'
  email.required = true
  const button = document.createElement('button')
  button.className = 'account-role-save'
  button.type = 'submit'
  button.textContent = copy.assignPresident
  form.append(label, email, button)
  row.append(heading, currentPresident, form)
  return row
}

function appendWorkspaceMessage(list, message) {
  const paragraph = document.createElement('p')
  paragraph.className = 'account-workspace-empty'
  paragraph.textContent = message
  list.append(paragraph)
}

function messageForAuthError(error, copy) {
  if (['invalid_credentials', 'user_not_found'].includes(error.code)) return copy.invalidCredentials
  if (error.code === 'email_not_confirmed') return copy.emailNotConfirmed
  if (error.code === 'user_banned') return copy.accountDisabled
  if (['over_request_rate_limit', 'too_many_requests'].includes(error.code)) return copy.tooManyAttempts
  return copy.genericError
}
