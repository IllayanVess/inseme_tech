import {
  assignMemberPosition,
  deleteAssociationSection,
  deleteAssociationSocialLink,
  endMemberPosition,
  getWorkspaceAssociations,
  getWorkspaceEditorData,
  removeAssociationMedia,
  saveAssociationPosition,
  saveAssociationProfile,
  saveAssociationSection,
  saveAssociationSocialLink,
  uploadAssociationMedia,
} from '../../services/association-workspace.js'
import { callAccountAdministration } from '../../services/account.js'

const english = document.documentElement.lang === 'en'

const copy = english
  ? {
      loading: 'Loading workspace…',
      loaded: 'Workspace loaded.',
      unavailable: 'Could not load this workspace. Check your access and try again.',
      saved: 'Changes saved.',
      saveError: 'Could not save these changes. Check the fields and your access.',
      mediaError: 'Image upload failed. Use PNG, JPEG, or WebP under 5 MB.',
      mediaCleanupError: 'Changes were saved, but an old image could not be removed.',
      noWorkspaces: 'No association workspace is available to manage.',
      publicOnly: 'Only members with a public profile and consent can be assigned.',
      noProfiles: 'No public member profiles are available to assign.',
      noSections: 'No page sections yet.',
      noLinks: 'No social links yet.',
      noPositions: 'No role cards yet.',
      noAssignments: 'No current role assignments.',
      published: 'Published',
      draft: 'Draft',
      edit: 'Edit',
      remove: 'Remove',
      deactivate: 'Deactivate',
      activate: 'Activate',
      sectionRemoved: 'Page section removed.',
      linkRemoved: 'Social link removed.',
      positionSaved: 'Role card saved.',
      assigned: 'Role card assigned.',
      assignmentEnded: 'Role assignment ended.',
      roleError: 'Could not save the role card. Check its bilingual fields.',
      assignmentError: 'Could not assign this role. Check the selected member.',
      adminSaved: 'Workspace access updated.',
      adminError: 'Could not complete the workspace administration request.',
      adminErrorMessages: {
        workspace_exists: 'That address is already in use.',
        account_not_found: 'No existing account matches that email address.',
        account_not_confirmed: 'That account must confirm its email first.',
        workspace_or_account_not_found: 'The workspace or account could not be found.',
        president_transfer_required: 'Assign a new president before removing this access.',
        membership_not_found: 'That account is not a member of this workspace.',
      },
      workspaceCreated: 'Workspace created as a draft and president assigned.',
      presidentChanged: 'President assigned. The previous president is now a member.',
      memberEnded: 'Member access removed.',
      contrast: 'Contrast',
      contrastPass: 'passes WCAG AA',
      contrastFail: 'does not pass WCAG AA',
      invalidHttps: 'Use a secure https:// address.',
      imageAltRequired: 'Provide French and English alternative text for each image.',
      mediaRightsRequired: 'Confirm image rights and consent before uploading.',
      slugRequired: 'Use a French title with letters or numbers to create a stable section address.',
    }
  : {
      loading: 'Chargement de l’espace…',
      loaded: 'Espace chargé.',
      unavailable: 'Impossible de charger cet espace. Vérifiez vos droits et réessayez.',
      saved: 'Modifications enregistrées.',
      saveError: 'Impossible d’enregistrer. Vérifiez les champs et vos droits.',
      mediaError: 'Échec de l’envoi. Utilisez une image PNG, JPEG ou WebP de moins de 5 Mo.',
      mediaCleanupError: 'Les modifications sont enregistrées, mais une ancienne image n’a pas pu être supprimée.',
      noWorkspaces: 'Aucun espace associatif à gérer.',
      publicOnly: 'Seuls les profils publics avec consentement peuvent recevoir un rôle.',
      noProfiles: 'Aucun profil public disponible.',
      noSections: 'Aucune section pour le moment.',
      noLinks: 'Aucun lien pour le moment.',
      noPositions: 'Aucune fiche de rôle pour le moment.',
      noAssignments: 'Aucune affectation en cours.',
      published: 'Publié',
      draft: 'Brouillon',
      edit: 'Modifier',
      remove: 'Supprimer',
      deactivate: 'Désactiver',
      activate: 'Activer',
      sectionRemoved: 'Section supprimée.',
      linkRemoved: 'Lien supprimé.',
      positionSaved: 'Fiche de rôle enregistrée.',
      assigned: 'Fiche de rôle attribuée.',
      assignmentEnded: 'Affectation terminée.',
      roleError: 'Impossible d’enregistrer cette fiche. Vérifiez les champs bilingues.',
      assignmentError: 'Impossible d’attribuer ce rôle. Vérifiez le membre choisi.',
      adminSaved: 'Accès à l’espace mis à jour.',
      adminError: 'Impossible de terminer cette opération d’administration.',
      adminErrorMessages: {
        workspace_exists: 'Cette adresse est déjà utilisée.',
        account_not_found: 'Aucun compte existant ne correspond à cette adresse e-mail.',
        account_not_confirmed: 'Ce compte doit d’abord confirmer son adresse e-mail.',
        workspace_or_account_not_found: 'L’espace ou le compte est introuvable.',
        president_transfer_required: 'Attribuez une nouvelle présidence avant de retirer cet accès.',
        membership_not_found: 'Ce compte n’est pas membre de cet espace.',
      },
      workspaceCreated: 'Espace créé en brouillon et présidence attribuée.',
      presidentChanged: 'Présidence attribuée. La personne précédente est désormais membre.',
      memberEnded: 'Accès du membre retiré.',
      contrast: 'Contraste',
      contrastPass: 'conforme WCAG AA',
      contrastFail: 'non conforme WCAG AA',
      invalidHttps: 'Utilisez une adresse sécurisée en https://.',
      imageAltRequired: 'Ajoutez un texte alternatif en français et en anglais pour chaque image.',
      mediaRightsRequired: 'Confirmez les droits et consentements avant d’envoyer des images.',
      slugRequired: 'Utilisez un titre français avec des lettres ou des chiffres pour créer une adresse stable.',
    }

const palette = {
  indigo: '#818cf8',
  cyan: '#22d3ee',
  violet: '#a78bfa',
  blue: '#60a5fa',
}

const $ = (root, selector) => root.querySelector(selector)

function setMessage(element, message, isError = false) {
  element.textContent = message
  element.dataset.state = isError ? 'error' : 'success'
}

function addOption(select, value, label) {
  const option = document.createElement('option')
  option.value = value
  option.textContent = label
  select.append(option)
}

function appendButton(parent, label, action, id) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'account-role-save'
  button.textContent = label
  button.dataset[action] = id
  parent.append(button)
  return button
}

function escapeKey(value) {
  const normalized = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  return normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

function contrastRatio(hex, background = '#06070d') {
  const luminance = (color) => {
    const channels = color.match(/[0-9a-f]{2}/gi).map((part) => parseInt(part, 16) / 255)
    const [red, green, blue] = channels.map((channel) => (
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    ))
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue
  }
  const values = [luminance(hex), luminance(background)].sort((left, right) => right - left)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

function secureUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

function scrollToForm(form) {
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  form.scrollIntoView({ behavior, block: 'center' })
}

export function initializeWorkspaceEditor({ accountRoot, onAssociationCreated }) {
  const editor = $(accountRoot, '[data-workspace-editor]')
  const adminTools = $(accountRoot, '[data-admin-workspace-tools]')
  if (!editor) return { setContext: () => {} }

  const workspaceSelect = $(editor, '[data-workspace-select]')
  const editorBody = $(editor, '[data-workspace-editor-body]')
  const status = $(editor, '[data-workspace-status]')
  const profileForm = $(editor, '[data-workspace-profile-form]')
  const themeSelect = $(profileForm, '[name="theme_accent"]')
  const themePreview = $(profileForm, '[data-theme-preview]')
  const contrastLabel = $(profileForm, '[data-theme-contrast]')
  const sectionForm = $(editor, '[data-section-form]')
  const socialForm = $(editor, '[data-social-form]')
  const positionForm = $(editor, '[data-position-form]')
  const assignmentForm = $(editor, '[data-assignment-form]')
  let context = { user: null, memberships: [], isAdmin: false }
  let workspaceData = null
  let activeAssociationId = null
  let pendingLogoUrl = null
  let pendingCoverUrl = null
  let requestNumber = 0

  const selectedData = () => workspaceData?.association

  const refreshThemePreview = () => {
    const accent = palette[themeSelect.value] ? themeSelect.value : 'indigo'
    themePreview.dataset.accent = accent
    const ratio = contrastRatio(palette[accent])
    const passes = ratio >= 4.5
    contrastLabel.textContent = `${copy.contrast}: ${ratio.toFixed(2)}:1 — ${passes ? copy.contrastPass : copy.contrastFail}`
    contrastLabel.dataset.state = passes ? 'success' : 'error'
  }

  const fillProfile = (association) => {
    if (pendingLogoUrl) URL.revokeObjectURL(pendingLogoUrl)
    if (pendingCoverUrl) URL.revokeObjectURL(pendingCoverUrl)
    pendingLogoUrl = null
    pendingCoverUrl = null
    const fields = profileForm.elements
    for (const name of [
      'name', 'slug', 'introduction_fr', 'introduction_en', 'mission_fr', 'mission_en',
      'public_email', 'public_phone', 'website_url', 'visibility',
      'logo_alt_fr', 'logo_alt_en', 'cover_alt_fr', 'cover_alt_en',
    ]) {
      fields.namedItem(name).value = association[name] || ''
    }
    themeSelect.value = palette[association.theme_accent] ? association.theme_accent : 'indigo'
    $(profileForm, '[data-logo-current]').textContent = association.logo_path || ''
    $(profileForm, '[data-cover-current]').textContent = association.cover_path || ''
    const previewLogo = $(themePreview, '[data-preview-logo]')
    previewLogo.hidden = !association.logo_url
    previewLogo.src = association.logo_url || ''
    const previewCover = $(themePreview, '[data-preview-cover]')
    previewCover.hidden = !association.cover_url
    previewCover.src = association.cover_url || ''
    $(profileForm, '[data-clear-logo]').checked = false
    $(profileForm, '[data-clear-cover]').checked = false
    fields.namedItem('media_rights_confirmed').checked = false
    profileForm.elements.namedItem('logo_file').value = ''
    profileForm.elements.namedItem('cover_file').value = ''
    refreshThemePreview()
  }

  const renderSections = () => {
    const list = $(editor, '[data-section-list]')
    list.replaceChildren()
    if (!workspaceData.sections.length) {
      list.textContent = copy.noSections
      return
    }
    workspaceData.sections.forEach((section) => {
      const row = document.createElement('article')
      row.className = 'workspace-list-row'
      const details = document.createElement('div')
      const title = document.createElement('strong')
      title.textContent = section.content_fr?.title || section.section_key
      const metadata = document.createElement('span')
      metadata.textContent = `${section.section_type} · ${section.display_order} · ${section.publication_status === 'published' ? copy.published : copy.draft}`
      details.append(title, metadata)
      row.append(details)
      appendButton(row, copy.edit, 'editSection', section.id)
      appendButton(row, copy.remove, 'removeSection', section.id)
      list.append(row)
    })
  }

  const renderLinks = () => {
    const list = $(editor, '[data-social-list]')
    list.replaceChildren()
    if (!workspaceData.socialLinks.length) {
      list.textContent = copy.noLinks
      return
    }
    workspaceData.socialLinks.forEach((link) => {
      const row = document.createElement('article')
      row.className = 'workspace-list-row'
      const details = document.createElement('div')
      const title = document.createElement('strong')
      title.textContent = link.label_fr || link.platform
      const metadata = document.createElement('span')
      metadata.textContent = `${link.url} · ${link.publication_status === 'published' ? copy.published : copy.draft}`
      details.append(title, metadata)
      row.append(details)
      appendButton(row, copy.edit, 'editLink', link.id)
      appendButton(row, copy.remove, 'removeLink', link.id)
      list.append(row)
    })
  }

  const renderPositions = () => {
    const list = $(editor, '[data-position-list]')
    const positionSelect = $(assignmentForm, '[name="position_id"]')
    list.replaceChildren()
    positionSelect.replaceChildren()
    addOption(positionSelect, '', '—')

    workspaceData.positions.forEach((position) => {
      const row = document.createElement('article')
      row.className = 'workspace-list-row'
      const details = document.createElement('div')
      const title = document.createElement('strong')
      title.textContent = position.title_fr
      const metadata = document.createElement('span')
      metadata.textContent = position.is_active ? copy.published : copy.draft
      details.append(title, metadata)
      row.append(details)
      appendButton(row, copy.edit, 'editPosition', position.id)
      appendButton(row, position.is_active ? copy.deactivate : copy.activate, 'togglePosition', position.id)
      list.append(row)
      if (position.is_active) addOption(positionSelect, position.id, position.title_fr)
    })
    if (!workspaceData.positions.length) list.textContent = copy.noPositions

    const profileSelect = $(assignmentForm, '[name="member_profile_id"]')
    profileSelect.replaceChildren()
    addOption(profileSelect, '', '—')
    workspaceData.profiles.forEach((profile) => addOption(profileSelect, profile.id, profile.display_name))
    $(assignmentForm, '[data-public-only-note]').textContent = workspaceData.profiles.length
      ? copy.publicOnly
      : copy.noProfiles

    const assignments = $(editor, '[data-assignment-list]')
    assignments.replaceChildren()
    if (!workspaceData.assignments.length) {
      assignments.textContent = copy.noAssignments
      return
    }
    const positions = new Map(workspaceData.positions.map((position) => [position.id, position]))
    const profiles = new Map(workspaceData.profiles.map((profile) => [profile.id, profile]))
    workspaceData.assignments.forEach((assignment) => {
      const position = positions.get(assignment.position_id)
      const profile = profiles.get(assignment.member_profile_id)
      if (!position || !profile) return
      const row = document.createElement('article')
      row.className = 'workspace-list-row'
      const label = document.createElement('strong')
      label.textContent = `${position.title_fr} — ${profile.display_name}`
      row.append(label)
      appendButton(row, copy.remove, 'endAssignment', assignment.id)
      assignments.append(row)
    })
  }

  const refreshWorkspace = async (associationId = activeAssociationId) => {
    if (!associationId) return
    const request = ++requestNumber
    activeAssociationId = associationId
    editorBody.hidden = true
    setMessage(status, copy.loading)
    try {
      const data = await getWorkspaceEditorData(associationId)
      if (request !== requestNumber) return
      workspaceData = data
      fillProfile(data.association)
      renderSections()
      renderLinks()
      renderPositions()
      editorBody.hidden = false
      setMessage(status, copy.loaded)
      return true
    } catch (error) {
      console.error('Workspace editor load failed:', error)
      editorBody.hidden = true
      setMessage(status, copy.unavailable, true)
      return false
    }
  }

  workspaceSelect.addEventListener('change', () => refreshWorkspace(workspaceSelect.value))
  themeSelect.addEventListener('change', refreshThemePreview)

  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const association = selectedData()
    if (!association) return
    const values = new FormData(profileForm)
    const website = values.get('website_url').trim()
    if (website && !secureUrl(website)) {
      setMessage(status, copy.invalidHttps, true)
      return
    }

    const oldPaths = [association.logo_path, association.cover_path].filter(Boolean)
    const newPaths = []
    let updated = false
    setMessage(status, copy.loading)
    try {
      const files = [
        ['logo_file', 'logo_path', 'logo_alt_fr', 'logo_alt_en', '[data-clear-logo]'],
        ['cover_file', 'cover_path', 'cover_alt_fr', 'cover_alt_en', '[data-clear-cover]'],
      ]
      const hasNewImage = files.some(([fileName]) => {
        const file = values.get(fileName)
        return file instanceof File && file.size > 0
      })
      if (hasNewImage && values.get('media_rights_confirmed') !== 'on') {
        throw new Error(copy.mediaRightsRequired)
      }
      const profileValues = {
        name: values.get('name').trim(),
        slug: values.get('slug').trim().toLowerCase(),
        introduction_fr: values.get('introduction_fr').trim(),
        introduction_en: values.get('introduction_en').trim(),
        mission_fr: values.get('mission_fr').trim() || null,
        mission_en: values.get('mission_en').trim() || null,
        public_email: values.get('public_email').trim() || null,
        public_phone: values.get('public_phone').trim() || null,
        website_url: website || null,
        theme_accent: themeSelect.value,
        visibility: values.get('visibility'),
        published_at: values.get('visibility') === 'published'
          ? association.published_at || new Date().toISOString()
          : null,
      }

      for (const [fileName, pathName, altFrName, altEnName, clearSelector] of files) {
        const file = values.get(fileName)
        const clear = $(profileForm, clearSelector).checked
        let path = association[pathName]
        if (clear) path = null
        if (file instanceof File && file.size > 0) {
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
            throw new Error(copy.mediaError)
          }
          path = await uploadAssociationMedia(association.id, file)
          newPaths.push(path)
        }
        profileValues[pathName] = path
        profileValues[altFrName] = path ? values.get(altFrName).trim() : null
        profileValues[altEnName] = path ? values.get(altEnName).trim() : null
        if (path && (!profileValues[altFrName] || !profileValues[altEnName])) {
          throw new Error(copy.imageAltRequired)
        }
      }

      await saveAssociationProfile(association.id, profileValues)
      updated = true
      const refreshed = await refreshWorkspace(association.id)
      const obsoletePaths = oldPaths.filter((path) => ![profileValues.logo_path, profileValues.cover_path].includes(path))
      for (const path of obsoletePaths) {
        try {
          await removeAssociationMedia(path)
        } catch (cleanupError) {
          console.error('Workspace media cleanup failed:', cleanupError)
          setMessage(status, copy.mediaCleanupError, true)
          return
        }
      }
      if (refreshed) setMessage(status, copy.saved)
    } catch (error) {
      console.error('Workspace profile save failed:', error)
      if (!updated) {
        for (const path of newPaths) {
          try {
            await removeAssociationMedia(path)
          } catch (cleanupError) {
            console.error('Workspace media cleanup failed:', cleanupError)
          }
        }
      }
      const message = [copy.mediaError, copy.imageAltRequired, copy.mediaRightsRequired].includes(error.message)
        ? error.message
        : copy.saveError
      setMessage(status, message, true)
    }
  })

  profileForm.addEventListener('change', (event) => {
    const file = event.target.files?.[0]
    if (!file || !event.target.matches('[name="logo_file"], [name="cover_file"]')) return
    const url = URL.createObjectURL(file)
    if (event.target.name === 'logo_file') {
      if (pendingLogoUrl) URL.revokeObjectURL(pendingLogoUrl)
      pendingLogoUrl = url
      const preview = $(themePreview, '[data-preview-logo]')
      preview.src = url
      preview.hidden = false
    } else {
      if (pendingCoverUrl) URL.revokeObjectURL(pendingCoverUrl)
      pendingCoverUrl = url
      const preview = $(themePreview, '[data-preview-cover]')
      preview.src = url
      preview.hidden = false
    }
  })

  sectionForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const values = new FormData(sectionForm)
    const association = selectedData()
    if (!association) return
    const publish = values.get('publish') === 'on'
    const titleFr = values.get('title_fr').trim()
    const titleEn = values.get('title_en').trim()
    const sectionKey = values.get('section_key').trim() || escapeKey(titleFr)
    if (!sectionKey) {
      setMessage(status, copy.slugRequired, true)
      return
    }
    const section = {
      id: values.get('id') || undefined,
      section_key: sectionKey,
      section_type: values.get('section_type'),
      content_fr: { title: titleFr, body: values.get('body_fr').trim() },
      content_en: { title: titleEn, body: values.get('body_en').trim() },
      display_order: Number(values.get('display_order')) || 0,
      publication_status: publish ? 'published' : 'draft',
      published_at: publish ? new Date().toISOString() : null,
    }
    try {
      await saveAssociationSection(association.id, section)
      sectionForm.reset()
      sectionForm.elements.namedItem('id').value = ''
      if (await refreshWorkspace()) setMessage(status, copy.saved)
    } catch (error) {
      console.error('Workspace section save failed:', error)
      setMessage(status, copy.saveError, true)
    }
  })

  $(editor, '[data-section-list]').addEventListener('click', async (event) => {
    const edit = event.target.closest('[data-edit-section]')
    if (edit) {
      const section = workspaceData.sections.find((item) => item.id === edit.dataset.editSection)
      if (!section) return
      const fr = section.content_fr || {}
      const en = section.content_en || {}
      sectionForm.elements.namedItem('id').value = section.id
      sectionForm.elements.namedItem('section_key').value = section.section_key
      sectionForm.elements.namedItem('section_type').value = section.section_type
      sectionForm.elements.namedItem('title_fr').value = fr.title || ''
      sectionForm.elements.namedItem('title_en').value = en.title || ''
      sectionForm.elements.namedItem('body_fr').value = fr.body || ''
      sectionForm.elements.namedItem('body_en').value = en.body || ''
      sectionForm.elements.namedItem('display_order').value = section.display_order
      sectionForm.elements.namedItem('publish').checked = section.publication_status === 'published'
      scrollToForm(sectionForm)
      return
    }
    const remove = event.target.closest('[data-remove-section]')
    if (!remove) return
    try {
      await deleteAssociationSection(activeAssociationId, remove.dataset.removeSection)
      if (await refreshWorkspace()) setMessage(status, copy.sectionRemoved)
    } catch (error) {
      console.error('Workspace section removal failed:', error)
      setMessage(status, copy.saveError, true)
    }
  })

  socialForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const values = new FormData(socialForm)
    const association = selectedData()
    if (!association) return
    const url = secureUrl(values.get('url').trim())
    if (!url) {
      setMessage(status, copy.invalidHttps, true)
      return
    }
    try {
      await saveAssociationSocialLink(association.id, {
        id: values.get('id') || undefined,
        platform: values.get('platform'),
        url,
        label_fr: values.get('label_fr').trim(),
        label_en: values.get('label_en').trim(),
        display_order: Number(values.get('display_order')) || 0,
        publication_status: values.get('publish') === 'on' ? 'published' : 'draft',
      })
      socialForm.reset()
      socialForm.elements.namedItem('id').value = ''
      if (await refreshWorkspace()) setMessage(status, copy.saved)
    } catch (error) {
      console.error('Workspace link save failed:', error)
      setMessage(status, copy.saveError, true)
    }
  })

  $(editor, '[data-social-list]').addEventListener('click', async (event) => {
    const edit = event.target.closest('[data-edit-link]')
    if (edit) {
      const link = workspaceData.socialLinks.find((item) => item.id === edit.dataset.editLink)
      if (!link) return
      for (const [key, value] of Object.entries(link)) {
        const field = socialForm.elements.namedItem(key)
        if (field) field.value = value ?? ''
      }
      socialForm.elements.namedItem('publish').checked = link.publication_status === 'published'
      scrollToForm(socialForm)
      return
    }
    const remove = event.target.closest('[data-remove-link]')
    if (!remove) return
    try {
      await deleteAssociationSocialLink(activeAssociationId, remove.dataset.removeLink)
      if (await refreshWorkspace()) setMessage(status, copy.linkRemoved)
    } catch (error) {
      console.error('Workspace link removal failed:', error)
      setMessage(status, copy.saveError, true)
    }
  })

  positionForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const values = new FormData(positionForm)
    const association = selectedData()
    if (!association) return
    const titleFr = values.get('title_fr').trim()
    const titleEn = values.get('title_en').trim()
    const id = values.get('id') || undefined
    const slug = id
      ? workspaceData.positions.find((position) => position.id === id)?.slug
      : escapeKey(titleFr)
    if (!slug) {
      setMessage(status, copy.slugRequired, true)
      return
    }
    try {
      await saveAssociationPosition(association.id, {
        id,
        slug,
        title_fr: titleFr,
        title_en: titleEn,
        responsibility_fr: values.get('responsibility_fr').trim() || null,
        responsibility_en: values.get('responsibility_en').trim() || null,
        tasks_fr: values.get('tasks_fr').trim() || null,
        tasks_en: values.get('tasks_en').trim() || null,
        display_order: Number(values.get('display_order')) || 0,
        is_active: values.get('is_active') === 'on',
      })
      positionForm.reset()
      positionForm.elements.namedItem('id').value = ''
      if (await refreshWorkspace()) setMessage(status, copy.positionSaved)
    } catch (error) {
      console.error('Workspace role card save failed:', error)
      setMessage(status, copy.roleError, true)
    }
  })

  $(editor, '[data-position-list]').addEventListener('click', async (event) => {
    const edit = event.target.closest('[data-edit-position]')
    if (edit) {
      const position = workspaceData.positions.find((item) => item.id === edit.dataset.editPosition)
      if (!position) return
      for (const [key, value] of Object.entries(position)) {
        const field = positionForm.elements.namedItem(key)
        if (field) {
          if (field.type === 'checkbox') field.checked = Boolean(value)
          else field.value = value ?? ''
        }
      }
      scrollToForm(positionForm)
      return
    }
    const toggle = event.target.closest('[data-toggle-position]')
    if (!toggle) return
    const position = workspaceData.positions.find((item) => item.id === toggle.dataset.togglePosition)
    if (!position) return
    try {
      await saveAssociationPosition(activeAssociationId, { ...position, is_active: !position.is_active })
      if (await refreshWorkspace()) setMessage(status, copy.positionSaved)
    } catch (error) {
      console.error('Workspace role status change failed:', error)
      setMessage(status, copy.roleError, true)
    }
  })

  assignmentForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const values = new FormData(assignmentForm)
    try {
      await assignMemberPosition(activeAssociationId, values.get('position_id'), values.get('member_profile_id'))
      if (await refreshWorkspace()) setMessage(status, copy.assigned)
    } catch (error) {
      console.error('Workspace member assignment failed:', error)
      setMessage(status, copy.assignmentError, true)
    }
  })

  $(editor, '[data-assignment-list]').addEventListener('click', async (event) => {
    const remove = event.target.closest('[data-end-assignment]')
    if (!remove) return
    try {
      await endMemberPosition(activeAssociationId, remove.dataset.endAssignment)
      if (await refreshWorkspace()) setMessage(status, copy.assignmentEnded)
    } catch (error) {
      console.error('Workspace member unassignment failed:', error)
      setMessage(status, copy.assignmentError, true)
    }
  })

  const setWorkspaceOptions = (associations) => {
    workspaceSelect.replaceChildren()
    associations.forEach((association) => addOption(workspaceSelect, association.id, association.name))
    if (!associations.length) {
      activeAssociationId = null
      editor.hidden = true
      setMessage(status, copy.noWorkspaces, true)
      return
    }
    editor.hidden = false
    const selected = associations.some((association) => association.id === activeAssociationId)
      ? activeAssociationId
      : associations[0].id
    activeAssociationId = selected
    workspaceSelect.value = selected
    refreshWorkspace(selected)
  }

  const loadAdminAssociationOptions = async () => {
    const associations = await getWorkspaceAssociations()
    const selects = accountRoot.querySelectorAll('[data-admin-association-select]')
    selects.forEach((select) => {
      select.replaceChildren()
      associations.forEach((association) => addOption(select, association.id, association.name))
    })
    return associations
  }

  const bindAdminTools = () => {
    if (!adminTools) return
    const adminStatus = $(adminTools, '[data-admin-workspace-status]')
    const createForm = $(adminTools, '[data-create-workspace-form]')
    const transferForm = $(adminTools, '[data-transfer-president-form]')
    const removeForm = $(adminTools, '[data-remove-member-form]')

    const runAdminAction = async (form, action, values, successMessage) => {
      const button = form.querySelector('[type="submit"]')
      button.disabled = true
      setMessage(adminStatus, copy.loading)
      try {
        const { data, error } = await callAccountAdministration(action, values)
        if (error || !data?.ok) {
          setMessage(adminStatus, copy.adminErrorMessages[data?.code] || copy.adminError, true)
          return false
        }
        setMessage(adminStatus, successMessage)
        return true
      } catch (error) {
        console.error('Workspace administration request failed:', error)
        setMessage(adminStatus, copy.adminError, true)
        return false
      } finally {
        button.disabled = false
      }
    }

    createForm.addEventListener('submit', async (event) => {
      event.preventDefault()
      const values = new FormData(createForm)
      const ok = await runAdminAction(createForm, 'create-workspace', {
        slug: values.get('slug').trim(),
        name: values.get('name').trim(),
        introductionFr: values.get('introduction_fr').trim(),
        introductionEn: values.get('introduction_en').trim(),
        presidentEmail: values.get('president_email').trim(),
      }, copy.workspaceCreated)
      if (ok) {
        createForm.reset()
        try {
          setWorkspaceOptions(await loadAdminAssociationOptions())
          await onAssociationCreated?.()
        } catch (error) {
          console.error('Workspace admin list refresh failed:', error)
          setMessage(adminStatus, copy.adminError, true)
        }
      }
    })

    transferForm.addEventListener('submit', async (event) => {
      event.preventDefault()
      const values = new FormData(transferForm)
      const ok = await runAdminAction(transferForm, 'set-president', {
        associationId: values.get('association_id'),
        presidentEmail: values.get('president_email').trim(),
      }, copy.presidentChanged)
      if (ok) transferForm.reset()
    })

    removeForm.addEventListener('submit', async (event) => {
      event.preventDefault()
      const values = new FormData(removeForm)
      const ok = await runAdminAction(removeForm, 'end-membership', {
        associationId: values.get('association_id'),
        memberEmail: values.get('member_email').trim(),
      }, copy.memberEnded)
      if (ok) removeForm.reset()
    })
  }

  bindAdminTools()

  return {
    async setContext(nextContext) {
      context = nextContext
      editor.hidden = true
      if (adminTools) adminTools.hidden = !context.isAdmin
      if (!context.user) return

      try {
        if (context.isAdmin) {
          const associations = await loadAdminAssociationOptions()
          setWorkspaceOptions(associations)
        } else {
          const associations = context.memberships
            .filter((membership) => membership.permission_role === 'president')
            .map((membership) => membership.association)
            .filter(Boolean)
          setWorkspaceOptions(associations)
        }
      } catch (error) {
        console.error('Workspace list load failed:', error)
        setMessage(status, copy.unavailable, true)
      }
    },
  }
}
