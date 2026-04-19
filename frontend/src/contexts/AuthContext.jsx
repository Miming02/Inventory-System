/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeRole } from '../lib/roleAccess'

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

    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,first_name,last_name,avatar_url,department,location,phone,is_active,role_id')
      .eq('id', authUser.id)
      .maybeSingle()

    if (error) {
      setProfile(null)
      return
    }

    let next = data ?? null
    if (next?.role_id) {
      const { data: roleRow } = await supabase
        .from('roles')
        .select('name')
        .eq('id', next.role_id)
        .maybeSingle()
      next = { ...next, role_name: normalizeRole(roleRow?.name) ?? null }
    }

    setProfile(next)
  }, [])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      loadProfile(authUser).finally(() => setLoading(false))
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      loadProfile(authUser).finally(() => setLoading(false))
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
    await supabase.auth.signOut()
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
      {!loading && children}
    </AuthContext.Provider>
  )
}
