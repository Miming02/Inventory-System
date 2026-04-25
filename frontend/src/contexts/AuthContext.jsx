/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeRole } from '../lib/roleAccess'

/** Max wait for Supabase before we unblock the UI (avoids infinite white screen on slow/504 API). */
const PROFILE_LOAD_TIMEOUT_MS = 12000

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out')), ms)
    }),
  ])
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setProfile(null)
      return
    }

    let data
    let error
    try {
      const res = await withTimeout(
        supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle(),
        PROFILE_LOAD_TIMEOUT_MS
      )
      data = res.data
      error = res.error
    } catch {
      setProfile(null)
      return
    }

    if (error) {
      console.error('profiles load failed:', error.message ?? error)
      setProfile(null)
      return
    }

    if (!data) {
      setProfile(null)
      return
    }

    let roleName = null
    let orgName = null
    try {
      const [roleRes, orgRes] = await Promise.all([
        data.role_id
          ? withTimeout(
              supabase.from('roles').select('name').eq('id', data.role_id).maybeSingle(),
              8000
            ).catch(() => ({ data: null }))
          : Promise.resolve({ data: null }),
        data.organization_id
          ? withTimeout(
              supabase.from('organizations').select('name').eq('id', data.organization_id).maybeSingle(),
              8000
            ).catch(() => ({ data: null }))
          : Promise.resolve({ data: null }),
      ])
      roleName = normalizeRole(roleRes.data?.name) ?? null
      orgName = orgRes.data?.name ?? null
    } catch {
      // keep partial profile
    }

    setProfile({
      ...data,
      organization_name: orgName,
      role_name: roleName,
    })
  }, [])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const authUser = session?.user ?? null
      setUser(authUser)

      if (event === 'TOKEN_REFRESHED') {
        return
      }

      setLoading(true)
      // Never hang forever: unblock shell after PROFILE_LOAD_TIMEOUT_MS even if profile fetch stalls.
      void Promise.race([loadProfile(authUser), delay(PROFILE_LOAD_TIMEOUT_MS)]).finally(() => {
        setLoading(false)
      })
    })

    return () => subscription.unsubscribe()
  }, [loadProfile])

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  const logout = async () => {
    await supabase.auth.signOut({ scope: 'local' })
    setUser(null)
    setProfile(null)
  }

  const refreshProfile = async () => {
    const { data: { user: u } } = await supabase.auth.getUser()
    if (u) await loadProfile(u)
  }

  const value = {
    user,
    profile,
    role: normalizeRole(profile?.role_name) ?? null,
    loading,
    login,
    logout,
    refreshProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-on-background px-6">
          <span
            className="inline-block h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent"
            aria-hidden
          />
          <p className="text-sm font-medium text-on-surface-variant">Loading session…</p>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  )
}
