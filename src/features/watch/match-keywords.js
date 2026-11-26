export function normalizeWatchText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

function hasPhrase(text, phrase) {
  let start = text.indexOf(phrase)

  while (start !== -1) {
    const end = start + phrase.length
    const previous = start > 0 ? text[start - 1] : ''
    const next = end < text.length ? text[end] : ''
    const startsWithWord = /[\p{L}\p{N}]/u.test(phrase[0])
    const endsWithWord = /[\p{L}\p{N}]/u.test(phrase.at(-1))
    const hasLeftBoundary = !startsWithWord || !previous || !/[\p{L}\p{N}]/u.test(previous)
    const hasRightBoundary = !endsWithWord || !next || !/[\p{L}\p{N}]/u.test(next)

    if (hasLeftBoundary && hasRightBoundary) return true
    start = text.indexOf(phrase, start + 1)
  }

  return false
}

export function findMatchingKeywords(text, keywords) {
  const normalizedText = normalizeWatchText(text)

  return keywords
    .map((item) => typeof item === 'string' ? item : item.keyword)
    .filter(Boolean)
    .filter((keyword) => {
      const normalizedKeyword = normalizeWatchText(keyword).trim()
      return normalizedKeyword && hasPhrase(normalizedText, normalizedKeyword)
    })
}
