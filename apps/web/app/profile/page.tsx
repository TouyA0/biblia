'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ProfileRedirect() {
  const router = useRouter()

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (!savedUser) {
      router.replace('/login')
      return
    }
    const user = JSON.parse(savedUser)
    router.replace(`/profile/${user.username}`)
  }, [])

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--parchment)',
      fontFamily: 'Spectral, serif',
      fontStyle: 'italic',
      color: 'var(--ink-muted)',
    }}>
      Chargement...
    </div>
  )
}