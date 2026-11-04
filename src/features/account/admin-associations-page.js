import { isSupabaseConfigured } from '../../lib/supabase.js'
import { callAccountAdministration } from '../../services/account.js'
import { getPlatformAdmin } from './admin-access.js'

const copy = {
  fr: {
    notConfigured: 'La connexion à Supabase n’est pas configurée.', signIn: 'Connectez-vous depuis la page Mon compte.',
    adminRequired: 'Cette page est réservée aux administrateurs.', ready: 'Administration des associations.', error: 'Impossible de charger les associations.',
    loading: 'Chargement…', createError: 'Échec de la création. Vérifiez les champs et la configuration Supabase.',
    presidentError: 'Impossible de transférer la présidence. Le compte doit exister et son adresse être confirmée.',
    presidentSaved: 'Présidence attribuée.', memberError: 'Impossible de retirer cet accès. Transférez d’abord la présidence si nécessaire.',
    memberSaved: 'Accès du membre retiré.', none: 'Aucune association pour le moment.', slug: 'Adresse', president: 'Président actif',
    save: 'Enregistrer', unconfirmed: 'Le compte président doit être confirmé.', invalid: 'Vérifiez le slug et les champs bilingues.',
    duplicate: 'Cette adresse est déjà utilisée.', setup: 'La migration d’administration des associations manque dans Supabase. Appliquez-la puis déployez manage-users.',
    config: 'Le service manage-users ou ses secrets ne sont pas configurés.', adminLost: 'Reconnectez-vous avec un compte administrateur.',
  },
  en: {
    notConfigured: 'Supabase sign-in is not configured.', signIn: 'Sign in from the My account page.',
    adminRequired: 'This page is for administrators.', ready: 'Association administration.', error: 'Could not load associations.',
    loading: 'Loading…', createError: 'Creation failed. Check the fields and Supabase setup.',
    presidentError: 'Could not transfer the presidency. The account must exist and its email must be confirmed.',
    presidentSaved: 'Presidency assigned.', memberError: 'Could not remove this access. Transfer the presidency first if needed.',
    memberSaved: 'Member access removed.', none: 'There are no associations yet.', slug: 'Address', president: 'Active president',
    save: 'Save', unconfirmed: 'The president account must be confirmed.', invalid: 'Check the slug and bilingual fields.',
    duplicate: 'This address is already in use.', setup: 'The association administration migration is missing in Supabase. Apply it, then deploy manage-users.',
    config: 'The manage-users function or its secrets are not configured.', adminLost: 'Sign in with an administrator account again.',
  },
}

export function initializeAdminAssociationsPage() {
  const root = document.querySelector('[data-admin-associations-page]')
  if (!root) return
  const text = copy[document.documentElement.lang === 'en' ? 'en' : 'fr']
  const status = root.querySelector('[data-admin-page-status]')
  const body = root.querySelector('[data-admin-page-body]')
  const createForm = root.querySelector('[data-association-create-form]')
  const associationList = root.querySelector('[data-admin-association-list]')
  const removalForm = root.querySelector('[data-admin-remove-member-form]')

  const setStatus = (message) => { status.textContent = message }
  if (!isSupabaseConfigured) {
    setStatus(text.notConfigured)
    return
  }

  const loadAssociations = async () => {
    const { data, error } = await callAccountAdministration('list-associations')
    if (error || !Array.isArray(data?.associations)) {
      setStatus(text.error)
      return
    }
    associationList.replaceChildren()
    removalForm.elements.associationId.replaceChildren()
    if (!data.associations.length) {
      const empty = document.createElement('p')
      empty.textContent = text.none
      associationList.append(empty)
    }
    data.associations.forEach((association) => {
      const row = document.createElement('article')
      row.className = 'account-association-row'
      row.dataset.associationId = association.id
      const heading = document.createElement('h3')
      heading.textContent = association.name
      const slug = document.createElement('p')
      slug.textContent = `${text.slug}: /associations/${association.slug}/`
      const form = document.createElement('form')
      form.dataset.presidentForm = ''
      const label = document.createElement('label')
      label.textContent = text.president
      const input = document.createElement('input')
      input.type = 'email'
      input.name = 'presidentEmail'
      input.autocomplete = 'email'
      input.required = true
      input.value = association.presidentEmail || ''
      const button = document.createElement('button')
      button.className = 'button button-dark account-submit'
      button.type = 'submit'
      button.textContent = text.save
      form.append(label, input, button)
      row.append(heading, slug, form)
      associationList.append(row)

      const option = document.createElement('option')
      option.value = association.id
      option.textContent = association.name
      removalForm.elements.associationId.append(option)
    })
  }

  getPlatformAdmin(root, text).then(async (user) => {
    if (!user) return
    body.hidden = false
    createForm.elements.presidentEmail.value = user.email || ''
    await loadAssociations()
  })

  createForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const button = createForm.querySelector('[type="submit"]')
    const values = new FormData(createForm)
    button.disabled = true
    setStatus(text.loading)
    try {
      const { data, error } = await callAccountAdministration('create-association', {
        slug: values.get('slug'), name: values.get('name'), presidentEmail: values.get('presidentEmail'),
        introductionFr: values.get('introductionFr'), introductionEn: values.get('introductionEn'),
        missionFr: values.get('missionFr'), missionEn: values.get('missionEn'), publicEmail: values.get('publicEmail'),
      })
      if (error) {
        const messages = {
          president_account_unconfirmed: text.unconfirmed,
          invalid_association_fields: text.invalid,
          association_slug_exists: text.duplicate,
          admin_create_function_missing: text.setup,
          admin_not_configured: text.config,
          admin_required: text.adminLost,
        }
        setStatus(messages[data?.code] || text.createError)
        return
      }
      if (!data?.associationId) {
        setStatus(text.createError)
        return
      }
      const languagePrefix = document.documentElement.lang === 'en' ? '/en/account/' : '/compte/'
      window.location.assign(`${languagePrefix}?association=${encodeURIComponent(data.associationId)}&created=1#workspace-editor`)
    } catch {
      setStatus(text.createError)
    } finally {
      button.disabled = false
    }
  })

  associationList.addEventListener('submit', async (event) => {
    const form = event.target.closest('[data-president-form]')
    if (!form) return
    event.preventDefault()
    const button = form.querySelector('[type="submit"]')
    button.disabled = true
    setStatus(text.loading)
    try {
      const { error } = await callAccountAdministration('set-president', {
        associationId: form.closest('[data-association-id]').dataset.associationId,
        presidentEmail: new FormData(form).get('presidentEmail'),
      })
      if (error) {
        setStatus(text.presidentError)
        return
      }
      setStatus(text.presidentSaved)
      await loadAssociations()
    } catch {
      setStatus(text.presidentError)
    } finally {
      button.disabled = false
    }
  })

  removalForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const button = removalForm.querySelector('[type="submit"]')
    button.disabled = true
    setStatus(text.loading)
    try {
      const values = new FormData(removalForm)
      const { error } = await callAccountAdministration('end-membership', {
        associationId: values.get('associationId'), memberEmail: values.get('memberEmail'),
      })
      if (error) {
        setStatus(text.memberError)
        return
      }
      removalForm.elements.memberEmail.value = ''
      setStatus(text.memberSaved)
    } catch {
      setStatus(text.memberError)
    } finally {
      button.disabled = false
    }
  })
}
