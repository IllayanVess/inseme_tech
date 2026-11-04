import { isSupabaseConfigured } from '../../lib/supabase.js'
import { initializeWorkspaceEditor } from '../workspace/workspace-editor.js'
import {
  createAssociationEvent,
  getAssociationEvents,
  getMyMemberProfiles,
  getMyActiveAssociationMemberships,
  updateAssociationPage,
  updateAssociationEvent,
  updateMyMemberProfile,
} from '../../services/association-content.js'
import {
  callAccountAdministration,
  getAccountSession,
  getAccountUser,
  onAccountChange,
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
    eventManagement: 'Gestion des événements',
    createEvent: 'Créer un événement',
    editEvent: 'Modifier l’événement',
    saveEvent: 'Enregistrer l’événement',
    eventSaved: 'Événement enregistré.',
    eventSaveError: 'Impossible d’enregistrer l’événement. Vérifiez les champs et vos droits.',
    eventLoadError: 'Impossible de charger les événements de cette association.',
    noEvents: 'Aucun événement pour le moment.',
    eventSlug: 'Adresse de l’événement (slug)',
    eventTitleFr: 'Titre — français',
    eventTitleEn: 'Title — English',
    eventSummaryFr: 'Résumé — français',
    eventSummaryEn: 'Summary — English',
    eventDescriptionFr: 'Description — français',
    eventDescriptionEn: 'Description — English',
    eventLocationFr: 'Lieu — français',
    eventLocationEn: 'Location — English',
    eventStartsAt: 'Date et heure de début',
    eventEndsAt: 'Date et heure de fin (facultatif)',
    eventTimezone: 'Fuseau horaire IANA',
    eventCategory: 'Catégorie',
    eventStatus: 'Statut de l’événement',
    eventRegistrationDeadline: 'Date limite d’inscription (facultatif)',
    eventRegistrationCapacity: 'Capacité (facultatif)',
    eventPublication: 'Publication',
    invalidEventFields: 'Renseignez le titre en anglais pour publier et complétez les champs facultatifs dans les deux langues.',
    invalidEventDate: 'Vérifiez les dates et le fuseau horaire. Cette heure locale n’existe peut-être pas.',
    eventCategories: {
      programming: 'Programmation',
      data_ai: 'Données et IA',
      robotics: 'Robotique',
      creative_technology: 'Technologies créatives',
      professional_development: 'Développement professionnel',
      community: 'Vie étudiante',
    },
    eventStatuses: { planned: 'Prévu', open: 'Inscriptions ouvertes', full: 'Complet', cancelled: 'Annulé', completed: 'Terminé' },
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
    eventManagement: 'Event management',
    createEvent: 'Create an event',
    editEvent: 'Edit event',
    saveEvent: 'Save event',
    eventSaved: 'Event saved.',
    eventSaveError: 'Could not save this event. Check the fields and your access.',
    eventLoadError: 'Could not load this association’s events.',
    noEvents: 'There are no events yet.',
    eventSlug: 'Event address (slug)',
    eventTitleFr: 'Titre — français',
    eventTitleEn: 'Title — English',
    eventSummaryFr: 'Summary — French',
    eventSummaryEn: 'Summary — English',
    eventDescriptionFr: 'Description — French',
    eventDescriptionEn: 'Description — English',
    eventLocationFr: 'Lieu — français',
    eventLocationEn: 'Location — English',
    eventStartsAt: 'Start date and time',
    eventEndsAt: 'End date and time (optional)',
    eventTimezone: 'IANA time zone',
    eventCategory: 'Category',
    eventStatus: 'Event status',
    eventRegistrationDeadline: 'Registration deadline (optional)',
    eventRegistrationCapacity: 'Capacity (optional)',
    eventPublication: 'Publication',
    invalidEventFields: 'Enter the English title to publish and complete optional fields in both languages.',
    invalidEventDate: 'Check the dates and time zone. This local time may not exist.',
    eventCategories: {
      programming: 'Programming',
      data_ai: 'Data and AI',
      robotics: 'Robotics',
      creative_technology: 'Creative technology',
      professional_development: 'Professional development',
      community: 'Community',
    },
    eventStatuses: { planned: 'Planned', open: 'Registration open', full: 'Full', cancelled: 'Cancelled', completed: 'Completed' },
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
  const workspaceEditor = initializeWorkspaceEditor({
    accountRoot: root,
    onAssociationCreated: async () => {
      await loadAssociations()
      await loadWorkspaces()
    },
  })
  const pageSize = 50
  let page = 0
  let hasMoreUsers = false
  let currentUser = null

  const setStatus = (message) => { status.textContent = message }
  const loadEventEditors = async (container) => {
    const editors = [...container.querySelectorAll('[data-event-manager]')]
    await Promise.all(editors.map(async (editor) => {
      const list = editor.querySelector('[data-event-list]')
      list.replaceChildren()
      try {
        const events = await getAssociationEvents(editor.dataset.associationId)
        if (!events.length) {
          appendWorkspaceMessage(list, copy.noEvents)
          return
        }
        events.forEach((event) => list.append(createEventEditor(event, copy)))
      } catch {
        appendWorkspaceMessage(list, copy.eventLoadError)
      }
    }))
  }

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
      await workspaceEditor.setContext({ user: null, memberships: [], isAdmin: false })
      return
    }

    root.querySelector('[data-account-email]').textContent = user.email ?? ''
    root.querySelector('[data-account-role]').textContent = isAdmin ? copy.admin : copy.member
    setStatus(copy.signedIn)
    const memberships = await loadWorkspaces()
    await workspaceEditor.setContext({ user, memberships, isAdmin })
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
        return []
      }
      memberships.forEach((membership) => {
        const association = membership.association
        if (!association?.slug || !association?.name) return
        workspaceList.append(createWorkspaceRow(membership, copy))
        if (membership.permission_role === 'president' && currentUser?.app_metadata?.role !== 'admin') {
          associationEditors.append(createAssociationEditor(association, copy))
        }
      })
      if (currentUser?.app_metadata?.role !== 'admin') await loadEventEditors(associationEditors)
      return memberships
    } catch {
      appendWorkspaceMessage(workspaceList, copy.workspaceLoadError)
      return []
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
    await loadEventEditors(associationEditors)
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
    const { data, error: userError } = await getAccountUser()
    if (userError) {
      setStatus(copy.genericError)
      return
    }
    await renderProfile(data.user)
  })

  root.querySelector('[data-signout]').addEventListener('click', async () => {
    const { error } = await signOut()
    if (error) {
      setStatus(copy.genericError)
      return
    }
    await renderProfile(null)
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
    const memberships = await loadWorkspaces()
    await workspaceEditor.setContext({ user: currentUser, memberships, isAdmin: true })
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

    const eventForm = event.target.closest('[data-event-form]')
    if (eventForm) {
      event.preventDefault()
      const submit = eventForm.querySelector('[type="submit"]')
      let values
      try {
        values = getEventFormValues(eventForm)
      } catch {
        setStatus(copy.invalidEventDate)
        return
      }
      if (!values) {
        setStatus(copy.invalidEventFields)
        return
      }
      submit.disabled = true
      setStatus(copy.loading)
      try {
        const eventId = eventForm.dataset.eventId
        if (eventId) {
          await updateAssociationEvent(eventForm.dataset.associationId, eventId, values)
        } else {
          await createAssociationEvent(eventForm.dataset.associationId, values)
        }
        setStatus(copy.eventSaved)
        await loadEventEditors(associationEditors)
      } catch {
        setStatus(copy.eventSaveError)
      } finally {
        submit.disabled = false
      }
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

  onAccountChange(async (_event, session) => {
    if (!session) {
      if (currentUser) await renderProfile(null)
      return
    }
    const { data, error } = await getAccountUser()
    if (error) {
      setStatus(copy.genericError)
      return
    }
    const nextUser = data.user
    if (nextUser?.id === currentUser?.id
      && nextUser.app_metadata?.role === currentUser?.app_metadata?.role) return
    window.setTimeout(() => renderProfile(nextUser), 0)
  })

  setStatus(copy.loading)
  getAccountSession().then(async ({ data, error }) => {
    if (error) {
      setStatus(copy.genericError)
      return
    }
    if (!data.session) {
      await renderProfile(null)
      return
    }
    const { data: userData, error: userError } = await getAccountUser()
    if (userError) {
      setStatus(copy.genericError)
      return
    }
    await renderProfile(userData.user)
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
    const languagePrefix = document.documentElement.lang === 'en' ? '/en' : ''
    link.className = 'account-workspace-link'
    link.href = `${languagePrefix}/associations/${encodeURIComponent(membership.association.slug)}/`
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
  details.append(createEventManager(association, copy))
  return details
}

function createEventManager(association, copy) {
  const section = document.createElement('section')
  section.className = 'association-event-manager'
  section.dataset.eventManager = ''
  section.dataset.associationId = association.id

  const heading = document.createElement('h4')
  heading.textContent = copy.eventManagement
  const createForm = createEventForm(association.id, copy)
  const createTitle = document.createElement('summary')
  createTitle.textContent = copy.createEvent
  const createPanel = document.createElement('details')
  createPanel.open = false
  createPanel.append(createTitle, createForm)

  const list = document.createElement('div')
  list.className = 'association-event-list'
  list.dataset.eventList = ''
  section.append(heading, createPanel, list)
  return section
}

function createEventEditor(event, copy) {
  const details = document.createElement('details')
  details.className = 'association-event-editor'
  const summary = document.createElement('summary')
  summary.textContent = `${copy.editEvent} — ${event.title_fr}`
  details.append(summary, createEventForm(event.association_id, copy, event))
  return details
}

function createEventForm(associationId, copy, event = null) {
  const form = document.createElement('form')
  form.className = 'association-event-form'
  form.dataset.eventForm = ''
  form.dataset.associationId = associationId
  form.dataset.publishedAt = event?.published_at ?? ''
  if (event) form.dataset.eventId = event.id

  const prefix = `event-${associationId}-${event?.id ?? 'new'}`
  const addInput = (name, labelText, { type = 'text', value = '', required = false, maxLength, min } = {}) => {
    const label = document.createElement('label')
    label.htmlFor = `${prefix}-${name}`
    label.textContent = labelText
    const input = document.createElement('input')
    input.id = label.htmlFor
    input.name = name
    input.type = type
    input.value = value ?? ''
    input.required = required
    if (maxLength) input.maxLength = maxLength
    if (min !== undefined) input.min = String(min)
    form.append(label, input)
    return input
  }
  const addTextarea = (name, labelText, value, maxLength) => {
    const label = document.createElement('label')
    label.htmlFor = `${prefix}-${name}`
    label.textContent = labelText
    const textarea = document.createElement('textarea')
    textarea.id = label.htmlFor
    textarea.name = name
    textarea.value = value ?? ''
    textarea.rows = 3
    textarea.maxLength = maxLength
    form.append(label, textarea)
  }
  const addSelect = (name, labelText, options, value) => {
    const label = document.createElement('label')
    label.htmlFor = `${prefix}-${name}`
    label.textContent = labelText
    const select = document.createElement('select')
    select.id = label.htmlFor
    select.name = name
    Object.entries(options).forEach(([optionValue, optionLabel]) => {
      const option = document.createElement('option')
      option.value = optionValue
      option.textContent = optionLabel
      option.selected = value === optionValue
      select.append(option)
    })
    form.append(label, select)
  }

  const slugInput = addInput('slug', copy.eventSlug, {
    value: event?.slug ?? '',
    required: true,
    maxLength: 120,
  })
  slugInput.pattern = '[a-z0-9]+(-[a-z0-9]+)*'
  const titleFrInput = addInput('title_fr', copy.eventTitleFr, {
    value: event?.title_fr,
    required: true,
    maxLength: 160,
  })
  if (!event) {
    slugInput.addEventListener('input', () => { slugInput.dataset.edited = 'true' })
    titleFrInput.addEventListener('input', () => {
      if (!slugInput.dataset.edited) slugInput.value = makeSlug(titleFrInput.value)
    })
  }

  addInput('title_en', copy.eventTitleEn, { value: event?.title_en, maxLength: 160 })
  addTextarea('summary_fr', copy.eventSummaryFr, event?.summary_fr, 1000)
  addTextarea('summary_en', copy.eventSummaryEn, event?.summary_en, 1000)
  addTextarea('description_fr', copy.eventDescriptionFr, event?.description_fr, 5000)
  addTextarea('description_en', copy.eventDescriptionEn, event?.description_en, 5000)
  addInput('location_fr', copy.eventLocationFr, { value: event?.location_fr, maxLength: 240 })
  addInput('location_en', copy.eventLocationEn, { value: event?.location_en, maxLength: 240 })
  addInput('starts_at', copy.eventStartsAt, {
    type: 'datetime-local',
    value: eventDateForInput(event?.starts_at, event?.timezone_name ?? 'Europe/Paris'),
    required: true,
  })
  addInput('ends_at', copy.eventEndsAt, {
    type: 'datetime-local',
    value: eventDateForInput(event?.ends_at, event?.timezone_name ?? 'Europe/Paris'),
  })
  addInput('timezone_name', copy.eventTimezone, {
    value: event?.timezone_name ?? 'Europe/Paris',
    required: true,
    maxLength: 80,
  })
  addSelect('category', copy.eventCategory, copy.eventCategories, event?.category ?? 'programming')
  addSelect('event_status', copy.eventStatus, copy.eventStatuses, event?.event_status ?? 'planned')
  addInput('registration_deadline', copy.eventRegistrationDeadline, {
    type: 'datetime-local',
    value: eventDateForInput(event?.registration_deadline, event?.timezone_name ?? 'Europe/Paris'),
  })
  addInput('registration_capacity', copy.eventRegistrationCapacity, {
    type: 'number',
    value: event?.registration_capacity,
    min: 1,
  })
  addSelect('publication_status', copy.eventPublication, {
    draft: copy.draft,
    published: copy.published,
    archived: copy.archived,
  }, event?.publication_status ?? 'draft')

  const save = document.createElement('button')
  save.className = 'button button-dark account-submit'
  save.type = 'submit'
  save.textContent = copy.saveEvent
  form.append(save)
  return form
}

function getEventFormValues(form) {
  const values = new FormData(form)
  const publicationStatus = values.get('publication_status')
  const titleFr = values.get('title_fr').trim()
  const titleEn = values.get('title_en').trim()
  const pairedFields = ['summary', 'description', 'location']
  if (!titleFr || (publicationStatus === 'published' && !titleEn)
    || pairedFields.some((field) => Boolean(values.get(`${field}_fr`).trim()) !== Boolean(values.get(`${field}_en`).trim()))) {
    return null
  }

  const timezone = values.get('timezone_name').trim()
  const startsAt = zonedDateTimeToIso(values.get('starts_at'), timezone)
  const endsAt = zonedDateTimeToIso(values.get('ends_at'), timezone)
  const registrationDeadline = zonedDateTimeToIso(values.get('registration_deadline'), timezone)
  const registrationCapacity = values.get('registration_capacity')
  const publishedAt = form.dataset.publishedAt
  return {
    slug: values.get('slug').trim(),
    category: values.get('category'),
    title_fr: titleFr,
    title_en: titleEn || null,
    summary_fr: values.get('summary_fr').trim() || null,
    summary_en: values.get('summary_en').trim() || null,
    description_fr: values.get('description_fr').trim() || null,
    description_en: values.get('description_en').trim() || null,
    location_fr: values.get('location_fr').trim() || null,
    location_en: values.get('location_en').trim() || null,
    starts_at: startsAt,
    ends_at: endsAt,
    timezone_name: timezone,
    event_status: values.get('event_status'),
    registration_deadline: registrationDeadline,
    registration_capacity: registrationCapacity ? Number(registrationCapacity) : null,
    publication_status: publicationStatus,
    published_at: publicationStatus === 'published'
      ? (publishedAt || new Date().toISOString())
      : publicationStatus === 'draft' ? null : publishedAt || null,
  }
}

function makeSlug(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)
}

function eventDateForInput(value, timezone) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]))
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`
}

function zonedDateTimeToIso(value, timezone) {
  if (!value) return null
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) throw new Error('Invalid event date.')
  const expected = match.slice(1).map(Number)
  const [year, month, day, hour, minute] = expected
  const target = Date.UTC(year, month - 1, day, hour, minute)
  if (!Number.isFinite(target)) throw new Error('Invalid event date.')

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  let timestamp = target
  let actual
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp))
      .map(({ type, value: partValue }) => [type, partValue]))
    actual = [parts.year, parts.month, parts.day, parts.hour, parts.minute].map(Number)
    const represented = Date.UTC(...actual.slice(0, 3).map((part, index) => index === 1 ? part - 1 : part), actual[3], actual[4], Number(parts.second))
    const adjustment = target - represented
    timestamp += adjustment
    if (adjustment === 0) break
  }

  const finalParts = Object.fromEntries(formatter.formatToParts(new Date(timestamp))
    .map(({ type, value: partValue }) => [type, partValue]))
  actual = [finalParts.year, finalParts.month, finalParts.day, finalParts.hour, finalParts.minute].map(Number)
  if (expected.some((part, index) => part !== actual[index])) throw new Error('Invalid local time for event time zone.')
  return new Date(timestamp).toISOString()
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
