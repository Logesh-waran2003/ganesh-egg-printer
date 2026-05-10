import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'

export type Role = 'admin' | 'employee'

export interface Profile {
  id: string
  name: string
  role: Role
}

export async function signIn(username: string, password: string) {
  const email = `${username}@ganeshegg.local`
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser()
  return data.user
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return data
}

export function onAuthChange(callback: (user: User | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null)
  })
}
