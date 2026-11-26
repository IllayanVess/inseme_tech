import { isSupabaseConfigured } from '../../lib/supabase.js'
import { getAccountSession, onAccountChange, signIn } from '../../services/account.js'
import {
  addAiWatchKeyword,
  getAiNewsFeed,
  getMyAiWatchKeywords,
  getWebPushPublicKey,
  removeAiWatchKeyword,
  removeMyPushSubscription,
  saveMyPushSubscription,
} from '../../services/ai-watch.js'
import { findMatchingKeywords } from './match-keywords.js'

const isEnglish = document.documentElement.lang === 'en'

const copy = isEnglish
  ? {
      loadingNews: 'Loading recent articles…',
      newsUnavailable: 'The news feed is temporarily unavailable. Try again in a moment.',
      sourcesUnavailable: 'Sources unavailable',
      noArticles: 'No recent articles were returned by these sources.',
      noFilteredArticles: 'No articles from this source are in the current feed.',
      articles: (count) => `${count} ${count === 1 ? 'article' : 'articles'}`,
      sources: (available, total) => `${available} of ${total} sources available`,
      partialSources: 'Some sources are temporarily unavailable.',
      refresh: 'Refresh',
      refreshing: 'Refreshing…',
      signInRequired: 'Sign in with your member account to save keywords and alerts.',
      notConfigured: 'Member sign-in is not configured on this site yet.',
      loadingAccount: 'Checking your account…',
      signInError: 'Could not sign in. Check your email and password and try again.',
      accountReady: 'You are signed in. Add keywords to start your watch list.',
      keywordLoadError: 'Could not load your keywords. Try again later.',
      keywordAdded: 'Keyword added to your watch list.',
      keywordDuplicate: 'That keyword is already on your watch list.',
      keywordError: 'Could not save this keyword. Check it and try again.',
      keywordRemoved: 'Keyword removed.',
      keywordRemoveError: 'Could not remove this keyword. Try again.',
      keywordLimit: (count) => `${count} of 20 keywords used.`,
      keywordLimitReached: 'You can follow up to 20 keywords. Remove one to add another.',
      emptyKeywords: 'No keywords followed yet.',
      removeKeyword: (keyword) => `Remove ${keyword}`,
      pushUnavailable: 'This browser does not support push notifications. Try a recent browser on HTTPS.',
      pushOff: 'Notifications are off on this device.',
      pushOn: 'Notifications are active on this device.',
      pushEnableError: 'Could not enable notifications. Check browser permission and site configuration.',
      pushPermissionDenied: 'Notifications are blocked in your browser settings for this site.',
      pushConfigMissing: 'Push notifications have not been configured for this site yet.',
      pushEnabled: 'Notifications enabled on this device.',
      pushDisabled: 'Notifications turned off on this device.',
      pushDisableError: 'Could not turn off notifications. Try again.',
      openArticle: 'Open article on publisher site',
      unavailable: 'Temporarily unavailable',
      available: 'Available',
      matchLabel: (terms) => `Matches: ${terms.join(', ')}`,
    }
  : {
      loadingNews: 'Chargement des articles récents…',
      newsUnavailable: 'Le fil est momentanément indisponible. Réessayez dans un instant.',
      sourcesUnavailable: 'Sources indisponibles',
      noArticles: 'Aucun article récent n’a été renvoyé par ces sources.',
      noFilteredArticles: 'Aucun article de cette source dans le fil actuel.',
      articles: (count) => `${count} article${count > 1 ? 's' : ''}`,
      sources: (available, total) => `${available} source${available > 1 ? 's' : ''} sur ${total} disponible${total > 1 ? 's' : ''}`,
      partialSources: 'Certaines sources sont momentanément indisponibles.',
      refresh: 'Actualiser',
      refreshing: 'Actualisation…',
      signInRequired: 'Connectez-vous avec votre compte membre pour enregistrer des mots-clés et alertes.',
      notConfigured: 'La connexion membre n’est pas encore configurée sur ce site.',
      loadingAccount: 'Vérification du compte…',
      signInError: 'Connexion impossible. Vérifiez votre e-mail et votre mot de passe.',
      accountReady: 'Vous êtes connecté. Ajoutez des mots-clés pour commencer votre veille.',
      keywordLoadError: 'Impossible de charger vos mots-clés. Réessayez plus tard.',
      keywordAdded: 'Mot-clé ajouté à votre veille.',
      keywordDuplicate: 'Ce mot-clé figure déjà dans votre veille.',
      keywordError: 'Impossible d’enregistrer ce mot-clé. Vérifiez-le et réessayez.',
      keywordRemoved: 'Mot-clé supprimé.',
      keywordRemoveError: 'Impossible de supprimer ce mot-clé. Réessayez.',
      keywordLimit: (count) => `${count} mot${count > 1 ? 's' : ''}-clé${count > 1 ? 's' : ''} sur 20 utilisé${count > 1 ? 's' : ''}.`,
      keywordLimitReached: 'Vous pouvez suivre jusqu’à 20 mots-clés. Supprimez-en un pour en ajouter un autre.',
      emptyKeywords: 'Aucun mot-clé suivi pour le moment.',
      removeKeyword: (keyword) => `Supprimer ${keyword}`,
      pushUnavailable: 'Ce navigateur ne prend pas en charge les notifications push. Essayez un navigateur récent en HTTPS.',
      pushOff: 'Les notifications sont désactivées sur cet appareil.',
      pushOn: 'Les notifications sont actives sur cet appareil.',
      pushEnableError: 'Impossible d’activer les notifications. Vérifiez les autorisations du navigateur et la configuration du site.',
      pushPermissionDenied: 'Les notifications sont bloquées dans les réglages de votre navigateur pour ce site.',
      pushConfigMissing: 'Les notifications push ne sont pas encore configurées sur ce site.',
      pushEnabled: 'Notifications activées sur cet appareil.',
      pushDisabled: 'Notifications désactivées sur cet appareil.',
      pushDisableError: 'Impossible de désactiver les notifications. Réessayez.',
      openArticle: 'Ouvrir l’article sur le site de l’éditeur',
      unavailable: 'Indisponible temporairement',
      available: 'Disponible',
      matchLabel: (terms) => `Correspondances : ${terms.join(', ')}`,
    }

function createText(tagName, className, value) {
  const element = document.createElement(tagName)
  if (className) element.className = className
  element.textContent = value ?? ''
  return element
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(isEnglish ? 'en-GB' : 'fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export function initializeAiWatchPage() {
  const root = document.querySelector('[data-watch-page]')
  if (!root) return

  const feedStatus = root.querySelector('[data-watch-feed-status]')
  const articlesRoot = root.querySelector('[data-watch-articles]')
  const sourceList = root.querySelector('[data-watch-sources]')
  const sourceCount = root.querySelector('[data-watch-source-count]')
  const sourceFilter = root.querySelector('[data-watch-source-filter]')
  const resultCount = root.querySelector('[data-watch-result-count]')
  const refreshButton = root.querySelector('[data-watch-refresh]')
  const loginSection = root.querySelector('[data-watch-login]')
  const dashboard = root.querySelector('[data-watch-dashboard]')
  const authNote = root.querySelector('[data-watch-auth-note]')
  const signInForm = root.querySelector('[data-watch-signin-form]')
  const accountStatus = root.querySelector('[data-watch-account-status]')
  const userEmail = root.querySelector('[data-watch-user-email]')
  const keywordForm = root.querySelector('[data-watch-keyword-form]')
  const keywordInput = root.querySelector('[name="keyword"]')
  const keywordList = root.querySelector('[data-watch-keywords]')
  const keywordEmpty = root.querySelector('[data-watch-keyword-empty]')
  const keywordCount = root.querySelector('[data-watch-keyword-count]')
  const pushStatus = root.querySelector('[data-watch-push-status]')
  const enablePushButton = root.querySelector('[data-watch-enable-push]')
  const disablePushButton = root.querySelector('[data-watch-disable-push]')

  let user = null
  let keywords = []
  let articles = []
  let sources = []
  let availableSourceIds = []
  let hasPartialSources = false
  let currentPushSubscription = null
  let loadingFeed = false

  function setAccountStatus(message, state = '') {
    accountStatus.textContent = message
    accountStatus.dataset.state = state
  }

  function setFeedStatus(message, state = '') {
    feedStatus.textContent = message
    feedStatus.dataset.state = state
  }

  function renderKeywords() {
    const fragment = document.createDocumentFragment()

    for (const keyword of keywords) {
      const item = document.createElement('li')
      item.className = 'watch-keyword-chip'
      const label = createText('span', '', keyword.keyword)
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.dataset.watchRemoveKeyword = keyword.id
      remove.setAttribute('aria-label', copy.removeKeyword(keyword.keyword))
      remove.textContent = '×'
      item.append(label, remove)
      fragment.append(item)
    }

    keywordList.replaceChildren(fragment)
    keywordEmpty.hidden = keywords.length > 0
    keywordList.hidden = keywords.length === 0
    keywordInput.disabled = keywords.length >= 20
    keywordForm.querySelector('button[type="submit"]').disabled = keywords.length >= 20
    keywordCount.textContent = copy.keywordLimit(keywords.length)
    keywordCount.dataset.atLimit = String(keywords.length >= 20)
  }

  function renderSources() {
    const options = [new Option(isEnglish ? 'All sources' : 'Toutes les sources', 'all')]
    for (const source of sources) options.push(new Option(source.name, source.name))
    const selectedValue = sourceFilter.value
    sourceFilter.replaceChildren(...options)
    sourceFilter.value = options.some((option) => option.value === selectedValue) ? selectedValue : 'all'

    const fragment = document.createDocumentFragment()
    for (const source of sources) {
      const item = document.createElement('li')
      const link = document.createElement('a')
      link.href = source.url
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.textContent = source.name
      const status = createText('span', 'watch-source-state', availableSourceIds.includes(source.id) ? copy.available : copy.unavailable)
      status.dataset.available = String(availableSourceIds.includes(source.id))
      item.append(link, status)
      fragment.append(item)
    }
    sourceList.replaceChildren(fragment)
    sourceCount.textContent = copy.sources(availableSourceIds.length, sources.length)
  }

  function renderArticles() {
    const selectedSource = sourceFilter.value
    const visibleArticles = selectedSource === 'all'
      ? articles
      : articles.filter((article) => article.source === selectedSource)
    const fragment = document.createDocumentFragment()

    for (const article of visibleArticles) {
      const card = document.createElement('article')
      card.className = 'watch-article'
      const meta = document.createElement('div')
      meta.className = 'watch-article-meta'
      meta.append(createText('span', 'watch-article-source', article.source))
      if (article.publishedAt) {
        const time = document.createElement('time')
        time.dateTime = article.publishedAt
        time.textContent = formatDate(article.publishedAt)
        meta.append(time)
      }

      const heading = document.createElement('h3')
      const link = document.createElement('a')
      link.href = article.link
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.setAttribute('aria-label', `${article.title} — ${copy.openArticle}`)
      link.textContent = article.title
      const arrow = document.createElement('span')
      arrow.className = 'watch-article-arrow'
      arrow.setAttribute('aria-hidden', 'true')
      arrow.textContent = '↗'
      heading.append(link, arrow)
      card.append(meta, heading)

      if (article.summary) card.append(createText('p', 'watch-article-summary', article.summary))

      const matches = findMatchingKeywords(`${article.title} ${article.summary}`, keywords)
      if (matches.length) card.append(createText('p', 'watch-article-matches', copy.matchLabel(matches)))
      fragment.append(card)
    }

    articlesRoot.replaceChildren(fragment)
    resultCount.textContent = copy.articles(visibleArticles.length)

    if (!articles.length) {
      articlesRoot.hidden = true
      if (feedStatus.dataset.state !== 'error') setFeedStatus(copy.noArticles)
    } else if (!visibleArticles.length) {
      articlesRoot.hidden = true
      setFeedStatus(copy.noFilteredArticles)
    } else {
      articlesRoot.hidden = false
      setFeedStatus(hasPartialSources ? copy.partialSources : '')
    }
  }

  async function loadFeed() {
    if (loadingFeed) return
    loadingFeed = true
    refreshButton.disabled = true
    refreshButton.querySelector('span:last-child').textContent = copy.refreshing
    setFeedStatus(copy.loadingNews)

    try {
      const result = await getAiNewsFeed()
      articles = Array.isArray(result.articles) ? result.articles : []
      sources = Array.isArray(result.sources) ? result.sources : []
      availableSourceIds = Array.isArray(result.availableSourceIds) ? result.availableSourceIds : []
      hasPartialSources = Boolean(result.failedSourceIds?.length)
      renderSources()
      if (sources.length && availableSourceIds.length === 0) {
        setFeedStatus(copy.newsUnavailable, 'error')
      }
      renderArticles()
    } catch {
      articles = []
      hasPartialSources = false
      setFeedStatus(copy.newsUnavailable, 'error')
      sourceCount.textContent = copy.sourcesUnavailable
      articlesRoot.replaceChildren()
      articlesRoot.hidden = true
      resultCount.textContent = ''
    } finally {
      loadingFeed = false
      refreshButton.disabled = false
      refreshButton.querySelector('span:last-child').textContent = copy.refresh
    }
  }

  async function loadKeywords() {
    if (!user || !isSupabaseConfigured) return
    try {
      keywords = await getMyAiWatchKeywords(user.id)
      renderKeywords()
      renderArticles()
    } catch {
      setAccountStatus(copy.keywordLoadError, 'error')
    }
  }

  async function syncPushState() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      currentPushSubscription = null
      pushStatus.textContent = copy.pushUnavailable
      pushStatus.dataset.state = 'error'
      enablePushButton.hidden = true
      disablePushButton.hidden = true
      return
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration('/')
      currentPushSubscription = registration ? await registration.pushManager.getSubscription() : null
      enablePushButton.hidden = Boolean(currentPushSubscription)
      disablePushButton.hidden = !currentPushSubscription
      pushStatus.textContent = currentPushSubscription
        ? copy.pushOn
        : Notification.permission === 'denied' ? copy.pushPermissionDenied : copy.pushOff
      pushStatus.dataset.state = currentPushSubscription ? 'success' : ''
    } catch {
      currentPushSubscription = null
      pushStatus.textContent = copy.pushUnavailable
      pushStatus.dataset.state = 'error'
      enablePushButton.hidden = true
      disablePushButton.hidden = true
    }
  }

  async function renderUser(nextUser) {
    const changedUser = user?.id !== nextUser?.id
    user = nextUser
    loginSection.hidden = Boolean(user)
    dashboard.hidden = !user

    if (!user) {
      keywords = []
      keywordList.replaceChildren()
      keywordList.hidden = true
      keywordEmpty.hidden = false
      enablePushButton.hidden = true
      disablePushButton.hidden = true
      if (isSupabaseConfigured) {
        authNote.textContent = copy.signInRequired
        setAccountStatus(copy.signInRequired)
      }
      return
    }

    userEmail.textContent = user.email ?? ''
    if (changedUser) {
      keywords = []
      renderKeywords()
      setAccountStatus(copy.accountReady, 'success')
    }
    await Promise.all([loadKeywords(), syncPushState()])
  }

  if (!isSupabaseConfigured) {
    loginSection.hidden = false
    signInForm.hidden = true
    authNote.textContent = copy.notConfigured
    setAccountStatus(copy.notConfigured, 'error')
    enablePushButton.hidden = true
    disablePushButton.hidden = true
  } else {
    authNote.textContent = copy.signInRequired
    setAccountStatus(copy.loadingAccount)
    getAccountSession().then(({ data, error }) => {
      if (error) {
        setAccountStatus(copy.signInError, 'error')
        return
      }
      return renderUser(data.session?.user ?? null)
    }).catch(() => setAccountStatus(copy.signInError, 'error'))

    onAccountChange((_event, session) => {
      renderUser(session?.user ?? null).catch(() => setAccountStatus(copy.keywordLoadError, 'error'))
    })
  }

  signInForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const values = new FormData(signInForm)
    const email = String(values.get('email') ?? '').trim()
    const password = String(values.get('password') ?? '')
    const button = signInForm.querySelector('button[type="submit"]')
    button.disabled = true
    setAccountStatus(copy.loadingAccount)
    try {
      const { error } = await signIn(email, password)
      if (error) {
        setAccountStatus(copy.signInError, 'error')
        return
      }
      signInForm.reset()
      setAccountStatus(copy.accountReady, 'success')
    } catch {
      setAccountStatus(copy.signInError, 'error')
    } finally {
      button.disabled = false
    }
  })

  keywordForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (!user) return
    if (keywords.length >= 20) {
      setAccountStatus(copy.keywordLimitReached, 'error')
      return
    }

    const keyword = keywordInput.value.trim()
    if (keywords.some((item) => item.keyword.toLocaleLowerCase() === keyword.toLocaleLowerCase())) {
      setAccountStatus(copy.keywordDuplicate, 'error')
      return
    }

    const submit = keywordForm.querySelector('button[type="submit"]')
    submit.disabled = true
    try {
      const saved = await addAiWatchKeyword(user.id, keyword)
      keywords = [...keywords, saved]
      keywordForm.reset()
      renderKeywords()
      renderArticles()
      setAccountStatus(copy.keywordAdded, 'success')
    } catch (error) {
      const errorMessage = error?.code === '23505'
        ? copy.keywordDuplicate
        : error?.code === '23514' ? copy.keywordLimitReached : copy.keywordError
      setAccountStatus(errorMessage, 'error')
    } finally {
      submit.disabled = keywords.length >= 20
    }
  })

  keywordList.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-watch-remove-keyword]')
    if (!button || !user) return
    button.disabled = true
    try {
      await removeAiWatchKeyword(user.id, button.dataset.watchRemoveKeyword)
      keywords = keywords.filter((keyword) => keyword.id !== button.dataset.watchRemoveKeyword)
      renderKeywords()
      renderArticles()
      setAccountStatus(copy.keywordRemoved, 'success')
    } catch {
      button.disabled = false
      setAccountStatus(copy.keywordRemoveError, 'error')
    }
  })

  enablePushButton.addEventListener('click', async () => {
    if (!user) return
    let pendingSubscription = null
    enablePushButton.disabled = true
    pushStatus.textContent = copy.loadingAccount
    pushStatus.dataset.state = ''

    try {
      const publicKey = await getWebPushPublicKey()
      if (Notification.permission === 'denied') {
        pushStatus.textContent = copy.pushPermissionDenied
        pushStatus.dataset.state = 'error'
        return
      }

      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission()
      if (permission !== 'granted') {
        pushStatus.textContent = copy.pushPermissionDenied
        pushStatus.dataset.state = 'error'
        return
      }

      const registration = await navigator.serviceWorker.register('/service-worker.js')
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(publicKey),
      })
      pendingSubscription = subscription
      const keys = subscription.toJSON().keys ?? {}
      await saveMyPushSubscription(user.id, {
        endpoint: subscription.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      })
      currentPushSubscription = subscription
      enablePushButton.hidden = true
      disablePushButton.hidden = false
      pushStatus.textContent = copy.pushEnabled
      pushStatus.dataset.state = 'success'
    } catch (error) {
      if (pendingSubscription) {
        try {
          await pendingSubscription.unsubscribe()
        } catch {
          // The failed subscription will be retried or removed from browser settings.
        }
      }
      pushStatus.textContent = error?.message?.includes('not configured') ? copy.pushConfigMissing : copy.pushEnableError
      pushStatus.dataset.state = 'error'
    } finally {
      enablePushButton.disabled = false
    }
  })

  disablePushButton.addEventListener('click', async () => {
    if (!user || !currentPushSubscription) return
    disablePushButton.disabled = true
    try {
      await removeMyPushSubscription(user.id, currentPushSubscription.endpoint)
      await currentPushSubscription.unsubscribe()
      currentPushSubscription = null
      disablePushButton.hidden = true
      pushStatus.textContent = copy.pushDisabled
      pushStatus.dataset.state = 'success'
      enablePushButton.hidden = false
    } catch {
      pushStatus.textContent = copy.pushDisableError
      pushStatus.dataset.state = 'error'
    } finally {
      disablePushButton.disabled = false
    }
  })

  refreshButton.addEventListener('click', loadFeed)
  sourceFilter.addEventListener('change', renderArticles)
  loadFeed()
  window.setInterval(() => {
    if (document.visibilityState === 'visible') loadFeed()
  }, 10 * 60 * 1000)
}
