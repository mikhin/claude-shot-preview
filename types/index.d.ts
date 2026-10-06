export type Preview = { png: string | null; width: number; height: number }

export type Platform = 'mac' | 'linux' | 'windows'

declare module 'claude-code' {
  interface PluginState {
    'shot-preview': { previews: Record<string, Preview>; platform: Platform | null }
  }
}
