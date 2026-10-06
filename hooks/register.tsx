import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Platform, Preview } from '../types'
import { imagePaths } from './paths'

const THUMB_COLUMNS = 36
const THUMB_ROWS = 10

const previews = atom({ plugin: 'shot-preview', key: 'previews' } as const, {})
const platform = atom({ plugin: 'shot-preview', key: 'platform' } as const, null)

type $ = EngineInterface

const resolvePath = async ($: $, path: string): Promise<string> => {
  if (!path.startsWith('~/')) return path
  const home = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE')) ?? ''
  return `${home.replace(/[/\\]$/, '')}${path.slice(1)}`
}

const hash = (text: string): string => {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(16)
}

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

const toPreview = async ($: $, file: string): Promise<Preview> => {
  const isPng = /\.png$/i.test(file)
  if ((await detectPlatform($)) !== 'mac') return { file, png: isPng ? file : null, width: 0, height: 0 }
  let png = file
  if (!isPng) {
    const tmp = ((await $.env.get('TMPDIR')) ?? '/tmp/').replace(/\/?$/, '/')
    const cache = `${tmp}claude-shots`
    const { mtimeMs } = await $.fs.stat(file)
    png = `${cache}/${hash(`${file}:${mtimeMs}`)}.png`
    if (!(await $.fs.exists(png))) {
      await $.process.run(['mkdir', '-p', cache])
      await $.process.run(['sips', '-s', 'format', 'png', '-Z', '800', file, '--out', png])
    }
  }
  const { stdout } = await $.process.run(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', png])
  return { file, png, width: pixels(stdout, 'pixelWidth'), height: pixels(stdout, 'pixelHeight') }
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
      if (known[path]) continue
      const file = await resolvePath($, path)
      if (await $.fs.exists(file)) fresh.push([path, await toPreview($, file)])
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
                  onPress={async () => void (await $.process.run(OPEN[await detectPlatform($)](shot.file)))}
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
