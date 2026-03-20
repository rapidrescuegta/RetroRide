'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

interface FamilyMember {
  id: string
  name: string
  avatar: string
}

interface FamilyInfo {
  id: string
  name: string
  code: string
}

interface FamilyContextType {
  family: FamilyInfo | null
  member: FamilyMember | null
  members: FamilyMember[]
  isLoggedIn: boolean
  createFamily: (familyName: string, memberName: string, avatar: string) => Promise<void>
  joinFamily: (code: string, memberName: string, avatar: string) => Promise<string | null>
  switchMember: (memberId: string) => void
  logout: () => void
  refreshMembers: () => Promise<void>
  submitScore: (gameId: string, score: number) => Promise<void>
}

const FamilyContext = createContext<FamilyContextType | null>(null)

export function useFamilyContext() {
  const ctx = useContext(FamilyContext)
  if (!ctx) throw new Error('useFamilyContext must be used within FamilyProvider')
  return ctx
}

export function useFamily() {
  return useContext(FamilyContext)
}

const STORAGE_KEY = 'retroride-family'

function loadSession(): { family: FamilyInfo; member: FamilyMember } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveSession(family: FamilyInfo, member: FamilyMember) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ family, member }))
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY)
}

export function FamilyProvider({ children }: { children: ReactNode }) {
  const [family, setFamily] = useState<FamilyInfo | null>(null)
  const [member, setMember] = useState<FamilyMember | null>(null)
  const [members, setMembers] = useState<FamilyMember[]>([])

  useEffect(() => {
    const session = loadSession()
    if (session) {
      setFamily(session.family)
      setMember(session.member)
    }
  }, [])

  useEffect(() => {
    if (family) {
      fetch(`/api/family?familyId=${family.id}`)
        .then(r => r.json())
        .then(data => {
          if (data.family?.members) setMembers(data.family.members)
        })
        .catch(() => {})
    }
  }, [family])

  const refreshMembers = useCallback(async () => {
    if (!family) return
    const res = await fetch(`/api/family?familyId=${family.id}`)
    const data = await res.json()
    if (data.family?.members) setMembers(data.family.members)
  }, [family])

  const createFamily = useCallback(async (familyName: string, memberName: string, avatar: string) => {
    const res = await fetch('/api/family', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyName, memberName, avatar }),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    setFamily(data.family)
    setMember(data.member)
    setMembers([data.member])
    saveSession(data.family, data.member)
  }, [])

  const joinFamily = useCallback(async (code: string, memberName: string, avatar: string): Promise<string | null> => {
    const res = await fetch('/api/family/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, memberName, avatar }),
    })
    const data = await res.json()
    if (data.error) return data.error
    setFamily(data.family)
    setMember(data.member)
    saveSession(data.family, data.member)
    return null
  }, [])

  const switchMember = useCallback((memberId: string) => {
    const m = members.find(m => m.id === memberId)
    if (m && family) {
      setMember(m)
      saveSession(family, m)
    }
  }, [members, family])

  const logout = useCallback(() => {
    setFamily(null)
    setMember(null)
    setMembers([])
    clearSession()
  }, [])

  const submitScore = useCallback(async (gameId: string, score: number) => {
    if (!member) return
    await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, score, memberId: member.id }),
    }).catch(() => {})
  }, [member])

  return (
    <FamilyContext.Provider value={{
      family, member, members, isLoggedIn: !!family && !!member,
      createFamily, joinFamily, switchMember, logout, refreshMembers, submitScore,
    }}>
      {children}
    </FamilyContext.Provider>
  )
}
