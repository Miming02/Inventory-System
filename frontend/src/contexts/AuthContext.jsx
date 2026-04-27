/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeRole } from '../lib/roleAccess'

/** Max wait for Supabase before we unblock the UI (avoids infinite white screen on slow/504 API). */
const PROFILE_LOAD_TIMEOUT_MS = 12000
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'
const SYNC_TIMEOUT_MS = 2500
let warnedExternalSyncOffline = false

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

  const mapExternalUserToProfile = useCallback((row, authUser) => {
    if (!row) return null
    return {
      id: row.id ?? authUser?.id ?? null,
      email: row.email ?? authUser?.email ?? null,
      first_name: row.first_name ?? '',
      last_name: row.last_name ?? '',
      avatar_url: row.avatar_url ?? null,
      role_name: normalizeRole(row.role_name) ?? null,
      organization_id: row.organization_id ?? null,
      organization_name: row.organization_name ?? null,
      is_active: true,
      source: 'external_postgres',
    }
  }, [])

  const loadProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setProfile(null)
      return null
    }

    // PostgreSQL-first auth context: role/org checks come from external DB users table.
    try {
      const externalRes = await withTimeout(
        supabase
          .from('users')
          .select('id,email,first_name,last_name,avatar_url,role_name,organization_id,organization_name')
          .eq('id', authUser.id)
          .maybeSingle(),
        6000
      )
      if (!externalRes?.error && externalRes?.data) {
        const mapped = mapExternalUserToProfile(externalRes.data, authUser)
        setProfile(mapped)
        return mapped
      }
    } catch {
      // continue to legacy profile source for backward compatibility
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
      return null
    }

    if (error) {
      console.error('profiles load failed:', error.message ?? error)
      setProfile(null)
      return null
    }

    if (!data) {
      setProfile(null)
      return null
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

    const resolvedProfile = {
      ...data,
      organization_name: orgName,
      role_name: roleName,
    }
    setProfile(resolvedProfile)
    return resolvedProfile
  }, [mapExternalUserToProfile])

  const syncUserToExternalDb = useCallback(async (authUser, loadedProfile = null) => {
    if (!authUser?.id) return
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS)
      await fetch(`${API_BASE_URL}/api/auth/sync-user`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          user: {
            id: authUser.id,
            email: authUser.email ?? null,
          },
          profile: loadedProfile
            ? {
                first_name: loadedProfile.first_name ?? null,
                last_name: loadedProfile.last_name ?? null,
                avatar_url: loadedProfile.avatar_url ?? null,
                role_name: normalizeRole(loadedProfile.role_name) ?? null,
                organization_id: loadedProfile.organization_id ?? null,
                organization_name: loadedProfile.organization_name ?? null,
              }
            : null,
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer))
      warnedExternalSyncOffline = false
    } catch (error) {
      if (!warnedExternalSyncOffline) {
        warnedExternalSyncOffline = true
        console.warn('external-db user sync failed:', error?.message ?? error)
      }
    }
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
      void Promise.race([loadProfile(authUser), delay(PROFILE_LOAD_TIMEOUT_MS)])
        .then((loadedProfile) => syncUserToExternalDb(authUser, loadedProfile))
        .finally(() => {
          setLoading(false)
        })
    })

    return () => subscription.unsubscribe()
  }, [loadProfile, syncUserToExternalDb])

  useEffect(() => {
    if (!user?.id) return
    void syncUserToExternalDb(user, profile)
  }, [user, profile, syncUserToExternalDb])

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
