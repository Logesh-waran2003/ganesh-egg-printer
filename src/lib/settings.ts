const STORAGE_KEY = 'gec_settings'

export interface Settings {
  whiteEggRate: number
  whiteTrayRate: number
  brownEggRate: number
  brownTrayRate: number
  quailBoxRate: number
}

const DEFAULTS: Settings = {
  whiteEggRate: 7,
  whiteTrayRate: 210,
  brownEggRate: 8,
  brownTrayRate: 240,
  quailBoxRate: 40,
}

export function getSettings(): Settings {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
}

export function saveSettings(s: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}
