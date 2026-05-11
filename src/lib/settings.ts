import { supabase } from './supabase'

export interface Preset {
  qty: number
  total: number
}

export interface Settings {
  whiteEggRate: number
  whiteTrayRate: number
  brownEggRate: number
  brownTrayRate: number
  quailBoxRate: number
  shopName: string
  shopPhone: string
  presets: Preset[]
}

const DEFAULTS: Settings = {
  whiteEggRate: 6,
  whiteTrayRate: 175,
  brownEggRate: 10,
  brownTrayRate: 300,
  quailBoxRate: 40,
  shopName: 'Ganesh Egg Centre',
  shopPhone: '',
  presets: [
    { qty: 17, total: 100 },
    { qty: 15, total: 90 },
    { qty: 10, total: 60 },
  ],
}

const CACHE_KEY = 'gec_settings_cache'

function cacheSettings(s: Settings) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(s))
}

function getCachedSettings(): Settings {
  const raw = localStorage.getItem(CACHE_KEY)
  return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
}

export async function fetchSettings(): Promise<Settings> {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 'default')
    .single()

  if (error || !data) return getCachedSettings()

  const s: Settings = {
    whiteEggRate: data.white_egg_rate,
    whiteTrayRate: data.white_tray_rate,
    brownEggRate: data.brown_egg_rate,
    brownTrayRate: data.brown_tray_rate,
    quailBoxRate: data.quail_box_rate,
    shopName: data.shop_name,
    shopPhone: data.shop_phone,
    presets: data.presets || DEFAULTS.presets,
  }
  cacheSettings(s)
  return s
}

export async function saveSettings(s: Settings): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .update({
      white_egg_rate: s.whiteEggRate,
      white_tray_rate: s.whiteTrayRate,
      brown_egg_rate: s.brownEggRate,
      brown_tray_rate: s.brownTrayRate,
      quail_box_rate: s.quailBoxRate,
      shop_name: s.shopName,
      shop_phone: s.shopPhone,
      presets: s.presets,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'default')

  if (error) throw error
  cacheSettings(s)
}

// Sync getter for immediate use (from cache)
export function getSettingsSync(): Settings {
  return getCachedSettings()
}
