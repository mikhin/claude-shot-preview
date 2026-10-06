const IMAGE = /\.(?:png|jpe?g)$/i
const PATH_START = /^(?:~\/|\/|[A-Za-z]:\\)/
const CODE_SPAN = /`([^`\n]+)`/g
const BARE_PATH = /(?:~\/|[A-Za-z]:\\|\/)[^\s`'"()<>[\]]+\.(?:png|jpe?g)/gi

export const imagePaths = (text: string): string[] => {
  const quoted = [...text.matchAll(CODE_SPAN)]
    .map(match => (match[1] ?? '').trim())
    .filter(span => PATH_START.test(span) && IMAGE.test(span))
  const bare = text.replace(CODE_SPAN, ' ').match(BARE_PATH) ?? []
  return [...new Set([...quoted, ...bare])]
}
