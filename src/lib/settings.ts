const STORAGE_KEY = 'gec_settings'

export interface Settings {
  whiteEggRate: number
  whiteTrayRate: number
  brownEggRate: number
  brownTrayRate: number
  quailBoxRate: number
  shopName: string
  shopPhone: string
}

const DEFAULTS: Settings = {
  whiteEggRate: 7,
  whiteTrayRate: 210,
  brownEggRate: 8,
  brownTrayRate: 240,
  quailBoxRate: 40,
  shopName: 'Ganesh Egg Centre',
  shopPhone: '',
}

export function getSettings(): Settings {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
}

export function saveSettings(s: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}
