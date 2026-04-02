'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import CommentText from '@/components/bible/CommentText'
import { getRoleColor, getRoleBackground, getRoleBorder } from '@/lib/roleColors'

interface Stats {
  users: number
  books: number
  verses: number
  wordTranslations: number
  proposals: number
  comments: number
  usersByRole: { role: string; _count: { role: number } }[]
  recentUsers: { id: string; username: string; role: string; createdAt: string }[]
  recentProposals: {
    id: string
    proposedText: string
    status: string
    createdAt: string
    creator: { username: string; role: string } | null
    translation: {
      verse: {
        number: number
        chapter: { number: number; book: { name: string; slug: string; testament: string } }
      }
    }
  }[]
  recentWordTranslations: {
    id: string
    translation: string
    isValidated: boolean
    createdAt: string
    creator: { username: string; role: string } | null
    wordToken: {
      word: string
      verseText: {
        verse: {
          number: number
          chapter: { number: number; book: { name: string; slug: string; testament: string } }
        }
      }
    }
  }[]
  recentComments: {
    id: string
    text: string
    createdAt: string
    creator: { username: string; role: string } | null
    verse: {
      number: number
      chapter: { number: number; book: { name: string; slug: string; testament: string } }
    } | null
  }[]
}

interface User {
  id: string
  email: string
  username: string
  role: string
  createdAt: string
  isActive: boolean
  forcePasswordReset: boolean
  _count: {
    wordTranslations: number
    proposals: number
    comments: number
  }
}

function getVerseUrl(book: { name: string }, bookSlug: string, testament: string, chapterNumber: number, verseNumber: number): string {
  const prefix = testament === 'AT' ? 'at' : 'nt'
  return `/${prefix}/${bookSlug}/${chapterNumber}#v${verseNumber}`
}

const ROLES = ['VISITOR', 'NOVICE', 'INTERMEDIATE', 'EXPERT', 'ADMIN']

export default function AdminPage() {
  const router = useRouter()
  const { user, setUser, setToken } = useAuthStore()
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'stats' | 'users'>('stats')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (!token || !savedUser) { router.push('/login'); return }
    const u = JSON.parse(savedUser)
    if (u.role !== 'ADMIN') { router.push('/'); return }
    setToken(token)
    setUser(u)
    loadData()
  }, [])

  async function loadData() {
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.get('/api/admin/stats'),
        api.get('/api/admin/users'),
      ])
      setStats(statsRes.data)
      setUsers(usersRes.data)
    } catch (error) {
      console.error(error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    setUpdatingRole(userId)
    try {
      await api.patch(`/api/admin/users/${userId}/role`, { role: newRole })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    } catch (error) {
      console.error(error)
    } finally {
      setUpdatingRole(null)
    }
  }

  const filteredUsers = users.filter(u => {
    const matchSearch = u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'ALL' 
      || (roleFilter === 'DISABLED' ? !u.isActive : u.role === roleFilter && u.isActive)
    return matchSearch && matchRole
  })

  if (loading) return (
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--parchment)' }}>
      {/* Topbar */}
      <div style={{
        background: 'var(--ink)',
        padding: '0 24px',
        height: '52px',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
      }}>
        <Link href="/" style={{
          fontFamily: 'Crimson Pro, serif',
          fontSize: '22px',
          fontWeight: '300',
          color: 'var(--gold-light)',
          letterSpacing: '0.06em',
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <span style={{ opacity: 0.7, fontStyle: 'italic' }}>בּ</span>
          Biblia
        </Link>
        <span style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: '10px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase' as const,
          padding: '4px 10px',
          borderRadius: '20px',
          background: 'rgba(122,42,42,0.3)',
          color: '#e88',
          border: '1px solid rgba(122,42,42,0.3)',
        }}>
          Administration
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/profile" style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: '10px',
            color: 'rgba(255,255,255,0.6)',
            textDecoration: 'none',
          }}>
            {user?.username}
          </Link>
          <button
            onClick={() => {
              localStorage.removeItem('token')
              localStorage.removeItem('refreshToken')
              localStorage.removeItem('user')
              router.push('/login')
            }}
            style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '10px',
              color: 'rgba(255,255,255,0.4)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Déconnexion
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 24px' }}>
        <div style={{
          fontFamily: 'Crimson Pro, serif',
          fontSize: '32px',
          fontWeight: '300',
          color: 'var(--ink)',
          marginBottom: '32px',
        }}>
          Tableau de bord
        </div>

        {/* Onglets */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          marginBottom: '32px',
        }}>
          {([
            { key: 'stats', label: 'Statistiques' },
            { key: 'users', label: `Utilisateurs (${users.length})` },
          ] as const).map(tab => (
            <div
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '12px 20px',
                fontFamily: 'DM Mono, monospace',
                fontSize: '11px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase' as const,
                color: activeTab === tab.key ? 'var(--gold)' : 'var(--ink-muted)',
                cursor: 'pointer',
                borderBottom: activeTab === tab.key ? '2px solid var(--gold)' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {tab.label}
            </div>
          ))}
        </div>

        {/* ONGLET STATS */}
        {activeTab === 'stats' && stats && (
          <div>
            {/* Chiffres clés */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px',
              marginBottom: '32px',
            }}>
              {[
                { label: 'Utilisateurs', value: stats.users },
                { label: 'Livres', value: stats.books },
                { label: 'Versets', value: stats.verses.toLocaleString('fr-FR') },
                { label: 'Traductions de mots', value: stats.wordTranslations.toLocaleString('fr-FR') },
                { label: 'Propositions', value: stats.proposals },
                { label: 'Commentaires', value: stats.comments },
              ].map(stat => (
                <div key={stat.label} style={{
                  background: 'white',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '20px',
                  textAlign: 'center',
                }}>
                  <div style={{
                    fontFamily: 'Crimson Pro, serif',
                    fontSize: '36px',
                    fontWeight: '300',
                    color: 'var(--gold)',
                    marginBottom: '4px',
                  }}>
                    {stat.value}
                  </div>
                  <div style={{
                    fontFamily: 'DM Mono, monospace',
                    fontSize: '9px',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase' as const,
                    color: 'var(--ink-muted)',
                  }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Répartition des rôles */}
            <div style={{
              background: 'white',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '20px',
              marginBottom: '24px',
            }}>
              <div style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: '10px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
                color: 'var(--ink-muted)',
                marginBottom: '16px',
              }}>
                Répartition des rôles
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {stats.usersByRole.map(r => {
                  const colors = { bg: getRoleBackground(r.role), color: getRoleColor(r.role), border: getRoleBorder(r.role) }
                  return (
                    <div key={r.role} style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: colors.bg,
                      border: `1px solid ${colors.border}`,
                      textAlign: 'center',
                    }}>
                      <div style={{
                        fontFamily: 'Crimson Pro, serif',
                        fontSize: '24px',
                        fontWeight: '300',
                        color: colors.color,
                      }}>
                        {r._count.role}
                      </div>
                      <div style={{
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '9px',
                        letterSpacing: '0.08em',
                        color: colors.color,
                        opacity: 0.8,
                      }}>
                        {r.role}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Nouveaux membres */}
            <div style={{
              background: 'white',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '20px',
            }}>
              <div style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: '10px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
                color: 'var(--ink-muted)',
                marginBottom: '16px',
              }}>
                Derniers inscrits
              </div>
              {stats.recentUsers.map(u => {
                const colors = { bg: getRoleBackground(u.role), color: getRoleColor(u.role), border: getRoleBorder(u.role) }
                return (
                  <div key={u.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'var(--gold)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '11px',
                      color: 'white',
                      flexShrink: 0,
                    }}>
                      {u.username.substring(0, 2).toUpperCase()}
                    </div>
                    <span style={{
                      fontFamily: 'Spectral, serif',
                      fontSize: '14px',
                      color: 'var(--ink)',
                      flex: 1,
                    }}>
                      {u.username}
                    </span>
                    <span style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '9px',
                      padding: '2px 8px',
                      borderRadius: '20px',
                      background: colors.bg,
                      color: colors.color,
                      border: `1px solid ${colors.border}`,
                    }}>
                      {u.role}
                    </span>
                    <span style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '9px',
                      color: 'var(--ink-faint)',
                    }}>
                      {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                )
              })}
            </div>
            {/* Dernières activités */}
						<div style={{
							display: 'grid',
							gridTemplateColumns: 'repeat(3, 1fr)',
							gap: '16px',
							marginTop: '24px',
						}}>
							{/* Dernières propositions */}
							<div style={{
								background: 'white',
								border: '1px solid var(--border)',
								borderRadius: '10px',
								padding: '20px',
							}}>
								<div style={{
									fontFamily: 'DM Mono, monospace',
									fontSize: '10px',
									letterSpacing: '0.1em',
									textTransform: 'uppercase' as const,
									color: 'var(--ink-muted)',
									marginBottom: '16px',
								}}>
									Dernières propositions de reformulation
								</div>
								{stats.recentProposals.map(p => {
									const verse = p.translation.verse
									const url = `/${verse.chapter.book.testament === 'AT' ? 'at' : 'nt'}/${verse.chapter.book.slug}/${verse.chapter.number}?verse=${encodeURIComponent(verse.number)}&tab=verse#v${verse.number}`
									return (
										<Link key={p.id} href={url} style={{ textDecoration: 'none', display: 'block' }}>
											<div style={{
												padding: '8px 0',
												borderBottom: '1px solid var(--border)',
												cursor: 'pointer',
												transition: 'opacity 0.15s',
											}}
											onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.6'}
											onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
											>
												<div style={{
													display: 'flex',
													justifyContent: 'space-between',
													marginBottom: '2px',
												}}>
													<span style={{
														fontFamily: 'DM Mono, monospace',
														fontSize: '9px',
														color: 'var(--ink-muted)',
													}}>
														{verse.chapter.book.name} {verse.chapter.number}:{verse.number}
													</span>
													<span style={{
														fontFamily: 'DM Mono, monospace',
														fontSize: '9px',
														color: p.status === 'ACCEPTED' ? 'var(--green-valid)' : p.status === 'REJECTED' ? 'var(--red-soft)' : 'var(--amber-pending)',
													}}>
														{p.status === 'ACCEPTED' ? 'Acceptée' : p.status === 'REJECTED' ? 'Rejetée' : 'En attente'}
													</span>
												</div>
												<div style={{
													fontFamily: 'Spectral, serif',
													fontSize: '12px',
													fontStyle: 'italic',
													color: 'var(--ink-soft)',
													overflow: 'hidden',
													textOverflow: 'ellipsis',
													whiteSpace: 'nowrap',
													marginBottom: '2px',
												}}>
													{p.proposedText}
												</div>
												<div style={{
													fontFamily: 'DM Mono, monospace',
													fontSize: '9px',
													color: 'var(--ink-faint)',
												}}>
													<span style={{ color: p.creator ? getRoleColor(p.creator.role) : 'var(--ink-muted)' }}>
														@{p.creator?.username || 'anonyme'}
													</span>
													{' · '}{new Date(p.createdAt).toLocaleDateString('fr-FR')}
												</div>
											</div>
										</Link>
									)
								})}
							</div>

							{/* Dernières traductions de mots */}
							<div style={{
								background: 'white',
								border: '1px solid var(--border)',
								borderRadius: '10px',
								padding: '20px',
							}}>
								<div style={{
									fontFamily: 'DM Mono, monospace',
									fontSize: '10px',
									letterSpacing: '0.1em',
									textTransform: 'uppercase' as const,
									color: 'var(--ink-muted)',
									marginBottom: '16px',
								}}>
									Dernières traductions de mots
								</div>
								{stats.recentWordTranslations.map(t => {
									const verse = t.wordToken.verseText.verse
									const url = `/${verse.chapter.book.testament === 'AT' ? 'at' : 'nt'}/${verse.chapter.book.slug}/${verse.chapter.number}?word=${t.id}&tab=word#v${verse.number}`
									return (
										<Link key={t.id} href={url} style={{ textDecoration: 'none', display: 'block' }}>
											<div style={{
												padding: '8px 0',
												borderBottom: '1px solid var(--border)',
												cursor: 'pointer',
												transition: 'opacity 0.15s',
											}}
											onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.6'}
											onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
											>
												<div style={{
													display: 'flex',
													justifyContent: 'space-between',
													marginBottom: '2px',
												}}>
													<span style={{
														fontFamily: 'DM Mono, monospace',
														fontSize: '9px',
														color: 'var(--ink-muted)',
													}}>
														{verse.chapter.book.name} {verse.chapter.number}:{verse.number}
													</span>
													<span style={{
														fontFamily: 'DM Mono, monospace',
														fontSize: '9px',
														color: t.isValidated ? 'var(--green-valid)' : 'var(--amber-pending)',
													}}>
														{t.isValidated ? 'Validée' : 'Proposée'}
													</span>
												</div>
												<div style={{
													fontFamily: 'Spectral, serif',
													fontSize: '12px',
													fontStyle: 'italic',
													color: 'var(--ink-soft)',
													marginBottom: '2px',
												}}>
													{t.wordToken.word} → {t.translation}
												</div>
												<div style={{
													fontFamily: 'DM Mono, monospace',
													fontSize: '9px',
													color: 'var(--ink-faint)',
												}}>
													<span style={{ color: t.creator ? getRoleColor(t.creator.role) : 'var(--ink-muted)' }}>
														@{t.creator?.username || 'anonyme'}
													</span>
													{' · '}{new Date(t.createdAt).toLocaleDateString('fr-FR')}
												</div>
											</div>
										</Link>
									)
								})}
							</div>

							{/* Derniers commentaires */}
							<div style={{
								background: 'white',
								border: '1px solid var(--border)',
								borderRadius: '10px',
								padding: '20px',
							}}>
								<div style={{
									fontFamily: 'DM Mono, monospace',
									fontSize: '10px',
									letterSpacing: '0.1em',
									textTransform: 'uppercase' as const,
									color: 'var(--ink-muted)',
									marginBottom: '16px',
								}}>
									Derniers commentaires
								</div>
								{stats.recentComments.map(c => {
									const url = c.verse
										? `/${c.verse.chapter.book.testament === 'AT' ? 'at' : 'nt'}/${c.verse.chapter.book.slug}/${c.verse.chapter.number}?verse=${c.verse.number}&tab=comments#v${c.verse.number}`
										: null
									const content = (
										<div style={{
											padding: '8px 0',
											borderBottom: '1px solid var(--border)',
											cursor: url ? 'pointer' : 'default',
											transition: 'opacity 0.15s',
										}}
										onMouseEnter={e => url && ((e.currentTarget as HTMLElement).style.opacity = '0.6')}
										onMouseLeave={e => url && ((e.currentTarget as HTMLElement).style.opacity = '1')}
										>
											{c.verse && (
												<div style={{
													fontFamily: 'DM Mono, monospace',
													fontSize: '9px',
													color: 'var(--ink-muted)',
													marginBottom: '2px',
												}}>
													{c.verse.chapter.book.name} {c.verse.chapter.number}:{c.verse.number}
												</div>
											)}
											<div style={{
												fontFamily: 'Spectral, serif',
												fontSize: '12px',
												color: 'var(--ink-soft)',
												overflow: 'hidden',
												textOverflow: 'ellipsis',
												whiteSpace: 'nowrap',
												marginBottom: '2px',
												pointerEvents: 'none',
											}}>
												<CommentText text={c.text} disableLinks />
											</div>
											<div style={{
												fontFamily: 'DM Mono, monospace',
												fontSize: '9px',
												color: 'var(--ink-faint)',
											}}>
												<span style={{ color: c.creator ? getRoleColor(c.creator.role) : 'var(--ink-muted)' }}>
													@{c.creator?.username || 'anonyme'}
												</span>
												{' · '}{new Date(c.createdAt).toLocaleDateString('fr-FR')}
											</div>
										</div>
									)
									return url ? (
										<Link key={c.id} href={url} style={{ textDecoration: 'none', display: 'block' }}>{content}</Link>
									) : (
										<div key={c.id}>{content}</div>
									)
								})}
							</div>
						</div>
          </div>
        )}

        {/* ONGLET UTILISATEURS */}
        {activeTab === 'users' && (
          <div>
            {/* Filtres */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '20px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}>
              <input
                type="text"
                placeholder="Rechercher un utilisateur..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: '200px',
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  background: 'white',
                  fontFamily: 'Spectral, serif',
                  fontSize: '14px',
                  color: 'var(--ink)',
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['ALL', ...ROLES, 'DISABLED'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '20px',
                      border: `1px solid ${roleFilter === r ? 'var(--gold)' : 'var(--border)'}`,
                      background: roleFilter === r ? 'var(--gold-pale)' : 'transparent',
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '9px',
                      color: roleFilter === r ? 'var(--gold)' : 'var(--ink-muted)',
                      cursor: 'pointer',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {r === 'ALL' ? 'Tous' : r}
                  </button>
                ))}
              </div>
            </div>

            {/* Liste utilisateurs */}
            <div style={{
              background: 'white',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 200px 120px 80px 80px 80px 120px 100px',
                padding: '10px 16px',
                background: 'var(--parchment-dark)',
                borderBottom: '1px solid var(--border)',
                fontFamily: 'DM Mono, monospace',
                fontSize: '9px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
                color: 'var(--ink-muted)',
              }}>
                <span>Utilisateur</span>
                <span>Email</span>
                <span>Inscription</span>
                <span>Trad.</span>
                <span>Prop.</span>
                <span>Comm.</span>
                <span>Rôle</span>
                <span>Actions</span>
              </div>

              {filteredUsers.length === 0 ? (
                <div style={{
                  padding: '24px',
                  textAlign: 'center',
                  fontFamily: 'Spectral, serif',
                  fontSize: '14px',
                  color: 'var(--ink-faint)',
                  fontStyle: 'italic',
                }}>
                  Aucun utilisateur trouvé.
                </div>
              ) : filteredUsers.map((u, i) => {
                const colors = { bg: getRoleBackground(u.role), color: getRoleColor(u.role), border: getRoleBorder(u.role) }
                const isMe = u.id === user?.id
                return (
                  <div key={u.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 200px 120px 80px 80px 80px 120px 100px',
                    padding: '12px 16px',
                    borderBottom: i < filteredUsers.length - 1 ? '1px solid var(--border)' : 'none',
                    alignItems: 'center',
                    background: isMe ? 'var(--gold-pale)' : 'transparent',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: isMe ? 'var(--gold)' : 'var(--parchment-deep)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '9px',
                        color: isMe ? 'white' : 'var(--ink-muted)',
                        flexShrink: 0,
                      }}>
                        {u.username.substring(0, 2).toUpperCase()}
                      </div>
                      <span style={{
                        fontFamily: 'Spectral, serif',
                        fontSize: '14px',
                        color: u.isActive ? 'var(--ink)' : 'var(--ink-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '150px',
                        display: 'block',
                      }}>
                        <Link href={`/profile/${u.username}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          {u.username}
                        </Link>
                        {isMe && (
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '8px', color: 'var(--gold)', marginLeft: '6px' }}>(vous)</span>
                        )}
                        {!u.isActive && (
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '8px', color: 'var(--red-soft)', marginLeft: '6px' }}>désactivé</span>
                        )}
                        {u.forcePasswordReset && (
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '8px', color: 'var(--amber-pending)', marginLeft: '6px' }}>reset mdp</span>
                        )}
                      </span>
                    </div>
                    <span style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '10px',
                      color: 'var(--ink-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {u.email}
                    </span>
                    <span style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '10px',
                      color: 'var(--ink-faint)',
                    }}>
                      {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                    <span style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '11px',
                      color: 'var(--ink-soft)',
                      textAlign: 'center',
                    }}>
                      {u._count.wordTranslations}
                    </span>
                    <span style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '11px',
                      color: 'var(--ink-soft)',
                      textAlign: 'center',
                    }}>
                      {u._count.proposals}
                    </span>
                    <span style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '11px',
                      color: 'var(--ink-soft)',
                      textAlign: 'center',
                    }}>
                      {u._count.comments}
                    </span>
                    <div>
                      {isMe ? (
                        <span style={{
                          fontFamily: 'DM Mono, monospace',
                          fontSize: '9px',
                          padding: '3px 10px',
                          borderRadius: '20px',
                          background: colors.bg,
                          color: colors.color,
                          border: `1px solid ${colors.border}`,
                        }}>
                          {u.role}
                        </span>
                      ) : (
                        <select
                          value={u.role}
                          disabled={updatingRole === u.id}
                          onChange={e => handleRoleChange(u.id, e.target.value)}
                          style={{
                            padding: '3px 6px',
                            border: `1px solid ${colors.border}`,
                            borderRadius: '6px',
                            background: colors.bg,
                            fontFamily: 'DM Mono, monospace',
                            fontSize: '9px',
                            color: colors.color,
                            cursor: 'pointer',
                            outline: 'none',
                            opacity: updatingRole === u.id ? 0.5 : 1,
                          }}
                        >
                          {ROLES.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {!isMe && (
                        <>
                          {/* Désactiver / Réactiver */}
                          <button
                            title={u.isActive ? 'Désactiver' : 'Réactiver'}
                            disabled={actionLoading === u.id}
                            onClick={async () => {
                              setActionLoading(u.id)
                              try {
                                if (u.isActive) {
                                  await api.patch(`/api/admin/users/${u.id}/deactivate`)
                                  setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: false } : x))
                                } else {
                                  await api.patch(`/api/admin/users/${u.id}/reactivate`)
                                  setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: true } : x))
                                }
                              } catch (error) { console.error(error) }
                              finally { setActionLoading(null) }
                            }}
                            style={{
                              width: '24px', height: '24px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              borderRadius: '4px',
                              border: `1px solid ${u.isActive ? 'rgba(122,42,42,0.2)' : 'rgba(45,90,58,0.2)'}`,
                              background: u.isActive ? 'var(--red-light)' : 'var(--green-light)',
                              cursor: 'pointer',
                              fontSize: '11px',
                              color: u.isActive ? 'var(--red-soft)' : 'var(--green-valid)',
                              opacity: actionLoading === u.id ? 0.5 : 1,
                            }}
                          >
                            {u.isActive ? '✕' : '✓'}
                          </button>

                          {/* Kick */}
                          <button
                            title="Déconnecter tous les appareils"
                            disabled={actionLoading === u.id}
                            onClick={async () => {
                              setActionLoading(u.id)
                              try {
                                await api.patch(`/api/admin/users/${u.id}/kick`)
                              } catch (error) { console.error(error) }
                              finally { setActionLoading(null) }
                            }}
                            style={{
                              width: '24px', height: '24px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              borderRadius: '4px',
                              border: '1px solid rgba(42,74,122,0.2)',
                              background: 'var(--blue-light)',
                              cursor: 'pointer',
                              fontSize: '11px',
                              color: 'var(--blue-sacred)',
                              opacity: actionLoading === u.id ? 0.5 : 1,
                            }}
                          >
                            ⟳
                          </button>

                          {/* Forcer reset mdp */}
                          <button
                            title="Forcer réinitialisation mot de passe"
                            disabled={actionLoading === u.id || u.forcePasswordReset}
                            onClick={async () => {
                              setActionLoading(u.id)
                              try {
                                await api.patch(`/api/admin/users/${u.id}/force-reset`)
                                setUsers(prev => prev.map(x => x.id === u.id ? { ...x, forcePasswordReset: true } : x))
                              } catch (error) { console.error(error) }
                              finally { setActionLoading(null) }
                            }}
                            style={{
                              width: '24px', height: '24px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              borderRadius: '4px',
                              border: '1px solid rgba(122,90,26,0.2)',
                              background: 'var(--amber-light)',
                              cursor: u.forcePasswordReset ? 'not-allowed' : 'pointer',
                              fontSize: '11px',
                              color: 'var(--amber-pending)',
                              opacity: actionLoading === u.id || u.forcePasswordReset ? 0.5 : 1,
                            }}
                          >
                            🔑
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '10px',
              color: 'var(--ink-faint)',
              marginTop: '12px',
              textAlign: 'right',
            }}>
              {filteredUsers.length} utilisateur{filteredUsers.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}