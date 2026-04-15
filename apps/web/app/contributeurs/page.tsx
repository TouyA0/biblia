'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { getRoleColor, getRoleBackground, getRoleBorder } from '@/lib/roleColors'
import TopBar from '@/components/bible/TopBar'

interface Contributor {
  id: string
  username: string
  role: string
  createdAt: string
  _count: {
    wordTranslations: number
    proposals: number
    comments: number
  }
}

export default function ContributeursPage() {
  const [contributors, setContributors] = useState<Contributor[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'total' | 'wordTranslations' | 'proposals' | 'comments'>('total')
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.get('/api/users/contributors')
      .then(res => setContributors(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const sorted = [...contributors].sort((a, b) => {
    if (sortBy === 'total') return (b._count.wordTranslations + b._count.proposals + b._count.comments) - (a._count.wordTranslations + a._count.proposals + a._count.comments)
    return b._count[sortBy] - a._count[sortBy]
  })
  .filter(u => u._count.wordTranslations + u._count.proposals + u._count.comments > 0)
  .filter(u => !search || u.username.toLowerCase().includes(search.toLowerCase()))

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--parchment)', fontFamily: 'Spectral, serif', fontStyle: 'italic', color: 'var(--ink-muted)' }}>
      Chargement...
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--parchment)' }}>
      <TopBar showSearch={false} />
      <div className="page-content">
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '32px', fontWeight: '300', color: 'var(--ink)', marginBottom: '8px' }}>
            Contributeurs
          </div>
          <div style={{ fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-muted)', fontStyle: 'italic' }}>
            {sorted.length} membre{sorted.length !== 1 ? 's' : ''} ont contribué à la traduction
          </div>
        </div>

        {/* Recherche */}
        <div style={{ marginBottom: '16px' }}>
          <input
            type="text"
            placeholder="Rechercher un contributeur..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              background: 'var(--card-bg)',
              fontFamily: 'Spectral, serif',
              fontSize: '14px',
              color: 'var(--ink)',
              outline: 'none',
            }}
          />
        </div>

        {/* Tri */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {([
            { key: 'total', label: 'Total' },
            { key: 'wordTranslations', label: 'Traductions de mots' },
            { key: 'proposals', label: 'Reformulations' },
            { key: 'comments', label: 'Commentaires' },
          ] as const).map(s => (
            <button key={s.key} onClick={() => setSortBy(s.key)}
              style={{ padding: '5px 12px', borderRadius: '20px', border: `1px solid ${sortBy === s.key ? 'var(--gold)' : 'var(--border)'}`, background: sortBy === s.key ? 'var(--gold-pale)' : 'var(--card-bg)', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: sortBy === s.key ? 'var(--gold)' : 'var(--ink-muted)', cursor: 'pointer' }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Liste */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
          {sorted.map((u, i) => {
            const total = u._count.wordTranslations + u._count.proposals + u._count.comments
            const max = sorted[0] ? sorted[0]._count.wordTranslations + sorted[0]._count.proposals + sorted[0]._count.comments : 1
            const sortedValue = sortBy === 'total' ? total : u._count[sortBy]
            const sortedMax = sortBy === 'total' ? max : sorted[0]?._count[sortBy] || 1
            return (
              <Link key={u.id} href={`/profile/${u.username}`} style={{ textDecoration: 'none', display: 'block' }}>
                <div style={{ padding: '14px 20px', borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--parchment)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
                    {/* Rang */}
                    <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '20px', fontWeight: '300', color: i < 3 ? 'var(--gold)' : 'var(--ink-faint)', width: '28px', textAlign: 'center', flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    {/* Avatar */}
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: getRoleColor(u.role), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'white', flexShrink: 0 }}>
                      {u.username.substring(0, 2).toUpperCase()}
                    </div>
                    {/* Nom + rôle */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Spectral, serif', fontSize: '16px', color: 'var(--ink)', marginBottom: '3px' }}>
                        {u.username}
                      </div>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: getRoleBackground(u.role), color: getRoleColor(u.role), border: `1px solid ${getRoleBorder(u.role)}` }}>
                        {u.role}
                      </span>
                    </div>
                    {/* Stats */}
                    <div className="contrib-stats">
                      {[
                        { label: 'Mots', value: u._count.wordTranslations },
                        { label: 'Vers.', value: u._count.proposals },
                        { label: 'Comm.', value: u._count.comments },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign: 'center' }}>
                          <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '20px', fontWeight: '300', color: 'var(--gold)' }}>{s.value}</div>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--ink-faint)', letterSpacing: '0.08em' }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Barre de progression */}
                  <div style={{ marginLeft: '42px', height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(sortedValue / sortedMax) * 100}%`, background: 'var(--gold)', borderRadius: '2px', opacity: 0.6, transition: 'width 0.3s' }} />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}