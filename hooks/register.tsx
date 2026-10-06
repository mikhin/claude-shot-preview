import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Platform, Preview } from '../types'

const IMAGE_PATH = /(?:[A-Za-z]:\\|\/)[^\s`'"()<>[\]]+\.(?:png|jpe?g)/gi
const THUMB_COLUMNS = 36
const THUMB_ROWS = 10

const previews = atom({ plugin: 'shot-preview', key: 'previews' } as const, {})
const platform = atom({ plugin: 'shot-preview', key: 'platform' } as const, null)

type $ = EngineInterface

const imagePaths = (text: string): string[] => [...new Set(text.match(IMAGE_PATH) ?? [])]

const pixels = (out: string, name: string): number => Number(new RegExp(`${name}: (\\d+)`).exec(out)?.[1] ?? 0)

const detectPlatform = async ($: $): Promise<Platform> => {
  const known = await read($, platform)
  if (known) return known
  const found: Platform =
    (await $.env.get('OS')) === 'Windows_NT'
      ? 'windows'
      : (await $.process.run(['uname'])).stdout.trim() === 'Darwin'
        ? 'mac'
        : 'linux'
  await update($, platform, () => found)
  return found
}

const OPEN: Record<Platform, (path: string) => string[]> = {
  mac: path => ['open', path],
  linux: path => ['xdg-open', path],
  windows: path => ['cmd', '/c', 'start', '""', path],
}

const toPreview = async ($: $, path: string): Promise<Preview> => {
  const isPng = /\.png$/i.test(path)
  if ((await detectPlatform($)) !== 'mac') return { png: isPng ? path : null, width: 0, height: 0 }
  let png = path
  if (!isPng) {
    const tmp = ((await $.env.get('TMPDIR')) ?? '/tmp/').replace(/\/?$/, '/')
    const cache = `${tmp}claude-shots`
    png = `${cache}/${path.split('/').at(-1)?.replace(/\.jpe?g$/i, '.png')}`
    if (!(await $.fs.exists(png))) {
      await $.process.run(['mkdir', '-p', cache])
      await $.process.run(['sips', '-s', 'format', 'png', '-Z', '800', path, '--out', png])
    }
  }
  const { stdout } = await $.process.run(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', png])
  return { png, width: pixels(stdout, 'pixelWidth'), height: pixels(stdout, 'pixelHeight') }
}

const fit = (width: number, height: number) => {
  const [w, h] = width > 0 && height > 0 ? [width, height] : [16, 9]
  const wide = { columns: THUMB_COLUMNS, rows: Math.round((THUMB_COLUMNS * h) / w / 2) }
  const box = wide.rows <= THUMB_ROWS ? wide : { columns: Math.round((THUMB_ROWS * 2 * w) / h), rows: THUMB_ROWS }
  return { columns: Math.max(1, box.columns), rows: Math.max(1, box.rows) }
}

export const register: Register = on => {
  on('session.append', async ($, e, next) => {
    const stored = await next(e)
    if (e.door !== 'response' || e.agentId !== undefined) return stored
    const text = e.message.content.map(block => (block.type === 'text' ? block.text : '')).join('\n')
    const known = await read($, previews)
    const fresh: [string, Preview][] = []
    for (const path of imagePaths(text)) {
      if (!known[path] && (await $.fs.exists(path))) fresh.push([path, await toPreview($, path)])
    }
    if (fresh.length > 0) await update($, previews, all => ({ ...all, ...Object.fromEntries(fresh) }))
    return stored
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    const known = await read($, previews)
    const shots = imagePaths(e.props.text).flatMap(path => (known[path] ? [{ path, ...known[path] }] : []))
    if (shots.length === 0) return next(e)

    const { Box, Button, Image } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {await next(e)}
        <Box gap={2} flexWrap="wrap" marginLeft={2}>
          {shots.map(shot => {
            const room = fit(shot.width, shot.height)
            return (
              <Box key={shot.path} flexDirection="column">
                {shot.png && <Image key={shot.path} source={{ file: shot.png, format: 'png' }} columns={room.columns} rows={room.rows} alt={shot.path} />}
                <Button
                  key={`open:${shot.path}`}
                  plain
                  dimColor
                  onPress={async () => void (await $.process.run(OPEN[await detectPlatform($)](shot.path)))}
                >
                  ↗ open
                </Button>
              </Box>
            )
          })}
        </Box>
      </Box>
    )
  })
}
