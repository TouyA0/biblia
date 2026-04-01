'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import CommentText from '@/components/bible/CommentText'
import { getRoleColor, getRoleBackground, getRoleBorder } from '@/lib/roleColors'

interface UserProfile {
  id: string
  email: string
  username: string
  role: string
  createdAt: string
  _count: {
    wordTranslations: number
    proposals: number
    comments: number
    votes: number
  }
}

interface WordTranslationContrib {
  id: string
  translation: string
  isValidated: boolean
  voteCount: number
  createdAt: string
  wordToken: {
    id: string
    word: string
    verseText: {
      verse: {
        number: number
        reference: string
        chapter: {
          number: number
          book: { name: string; slug: string; testament: string }
        }
      }
    }
  }
}

interface ProposalContrib {
  id: string
  proposedText: string
  status: string
  createdAt: string
  votes: { id: string }[]
  translation: {
    verse: {
      id: string
      number: number
      reference: string
      chapter: {
        number: number
        book: { name: string; slug: string; testament: string }
      }
    }
  }
}

interface CommentContrib {
  id: string
  text: string
  createdAt: string
  verse: {
    id: string
    number: number
    reference: string
    chapter: {
      number: number
      book: { name: string; slug: string; testament: string }
    }
  } | null
}

function getVerseUrl(
  book: { slug: string; testament: string },
  chapterNumber: number,
  verseNumber?: number,
  options?: { wordId?: string; verseId?: string; tab?: 'verse' | 'word' | 'comments' }
): string {
  const prefix = book.testament === 'AT' ? 'at' : 'nt'
  const hash = verseNumber ? `#v${verseNumber}` : ''
  const params = new URLSearchParams()
  if (options?.wordId) params.set('word', options.wordId)
  if (options?.verseId) params.set('verse', options.verseId)
  if (options?.tab) params.set('tab', options.tab)
  const query = params.toString() ? `?${params.toString()}` : ''
  return `/${prefix}/${book.slug}/${chapterNumber}${query}${hash}`
}

const ITEMS_PER_PAGE = 5

export default function ProfilePage() {
  const router = useRouter()
  const { user, setUser, setToken } = useAuthStore()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [wordTranslations, setWordTranslations] = useState<WordTranslationContrib[]>([])
  const [proposals, setProposals] = useState<ProposalContrib[]>([])
  const [comments, setComments] = useState<CommentContrib[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'info' | 'contributions' | 'password'>('info')

  const [wordPage, setWordPage] = useState(1)
  const [proposalPage, setProposalPage] = useState(1)
  const [commentPage, setCommentPage] = useState(1)
  const [proposalFilter, setProposalFilter] = useState<'ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED'>('ALL')
  const [wordFilter, setWordFilter] = useState<'ALL' | 'VALIDATED' | 'PROPOSED'>('ALL')

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileError, setProfileError] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (!token || !savedUser) {
      router.push('/login')
      return
    }
    setToken(token)
    setUser(JSON.parse(savedUser))
    loadProfile()
  }, [])

  async function loadProfile() {
    try {
      const [profileRes, contribRes] = await Promise.all([
        api.get('/api/profile'),
        api.get('/api/profile/contributions'),
      ])
      setProfile(profileRes.data)
      setUsername(profileRes.data.username)
      setEmail(profileRes.data.email)
      setWordTranslations(contribRes.data.wordTranslations)
      setProposals(contribRes.data.proposals)
      setComments(contribRes.data.comments)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateProfile() {
    setProfileError('')
    setProfileSuccess('')
    try {
      const res = await api.patch('/api/profile', { username, email })
      setUser(res.data)
      localStorage.setItem('user', JSON.stringify(res.data))
      setProfileSuccess('Profil mis à jour avec succès')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      setProfileError(error.response?.data?.error || 'Erreur lors de la mise à jour')
    }
  }

  async function handleChangePassword() {
    setPasswordError('')
    setPasswordSuccess('')
    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas')
      return
    }
    try {
      await api.patch('/api/profile/password', { currentPassword, newPassword })
      setPasswordSuccess('Mot de passe modifié avec succès')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      setPasswordError(error.response?.data?.error || 'Erreur lors du changement')
    }
  }

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

  // Pagination
  const filteredWords = wordFilter === 'ALL' ? wordTranslations : wordTranslations.filter(t => wordFilter === 'VALIDATED' ? t.isValidated : !t.isValidated)
  const pagedWords = filteredWords.slice(0, wordPage * ITEMS_PER_PAGE)
  const filteredProposals = proposalFilter === 'ALL' ? proposals : proposals.filter(p => p.status === proposalFilter)
  const pagedProposals = filteredProposals.slice(0, proposalPage * ITEMS_PER_PAGE)
  const pagedComments = comments.slice(0, commentPage * ITEMS_PER_PAGE)

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
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
          {user?.role === 'ADMIN' && (
            <Link href="/admin" style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '10px',
              color: '#e88',
              letterSpacing: '0.08em',
              textDecoration: 'none',
              padding: '3px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(122,42,42,0.3)',
              background: 'rgba(122,42,42,0.15)',
            }}>
              Administration
            </Link>
          )}
          {user && (
            <span style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '10px',
              color: 'rgba(255,255,255,0.6)',
            }}>
              {user.username}
            </span>
          )}
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

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px' }}>
        {/* Header profil */}
        {profile && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            marginBottom: '32px',
            flexWrap: 'wrap',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'DM Mono, monospace',
              fontSize: '20px',
              color: 'white',
              flexShrink: 0,
            }}>
              {profile.username.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{
                fontFamily: 'Crimson Pro, serif',
                fontSize: '28px',
                fontWeight: '300',
                color: 'var(--ink)',
                marginBottom: '4px',
              }}>
                {profile.username}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '10px',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  color: getRoleColor(profile.role),
                  border: `1px solid ${getRoleBorder(profile.role)}`,
                  background: getRoleBackground(profile.role),
                }}>
                  {profile.role}
                </span>
                <span style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '10px',
                  color: 'var(--ink-muted)',
                }}>
                  Membre depuis {new Date(profile.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </span>
              </div>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '24px' }}>
              {[
                { label: 'Traductions', value: profile._count.wordTranslations },
                { label: 'Propositions', value: profile._count.proposals },
                { label: 'Commentaires', value: profile._count.comments },
                { label: 'Votes', value: profile._count.votes },
              ].map(stat => (
                <div key={stat.label} style={{ textAlign: 'center' }}>
                  <div style={{
                    fontFamily: 'Crimson Pro, serif',
                    fontSize: '28px',
                    fontWeight: '300',
                    color: 'var(--gold)',
                  }}>
                    {stat.value}
                  </div>
                  <div style={{
                    fontFamily: 'DM Mono, monospace',
                    fontSize: '9px',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase' as const,
                    color: 'var(--ink-muted)',
                  }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Onglets */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          marginBottom: '32px',
        }}>
          {([
            { key: 'info', label: 'Informations' },
            { key: 'contributions', label: 'Contributions' },
            { key: 'password', label: 'Mot de passe' },
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

        {/* ONGLET INFORMATIONS */}
        {activeTab === 'info' && (
          <div style={{ maxWidth: '480px' }}>
            {profileSuccess && (
              <div style={{
                padding: '10px 14px',
                background: 'var(--green-light)',
                border: '1px solid rgba(45,90,58,0.2)',
                borderRadius: '6px',
                color: 'var(--green-valid)',
                fontFamily: 'Spectral, serif',
                fontSize: '13px',
                marginBottom: '20px',
              }}>
                {profileSuccess}
              </div>
            )}
            {profileError && (
              <div style={{
                padding: '10px 14px',
                background: 'var(--red-light)',
                border: '1px solid rgba(122,42,42,0.2)',
                borderRadius: '6px',
                color: 'var(--red-soft)',
                fontFamily: 'Spectral, serif',
                fontSize: '13px',
                marginBottom: '20px',
              }}>
                {profileError}
              </div>
            )}
            {[
              { label: "Nom d'utilisateur", value: username, setter: setUsername, type: 'text' },
              { label: 'Email', value: email, setter: setEmail, type: 'email' },
            ].map(field => (
              <div key={field.label} style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '10px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase' as const,
                  color: 'var(--ink-muted)',
                  marginBottom: '6px',
                }}>
                  {field.label}
                </label>
                <input
                  type={field.type}
                  value={field.value}
                  onChange={e => field.setter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    background: 'white',
                    fontFamily: 'Spectral, serif',
                    fontSize: '14px',
                    color: 'var(--ink)',
                    outline: 'none',
                  }}
                />
              </div>
            ))}
            <button
              onClick={handleUpdateProfile}
              style={{
                padding: '10px 24px',
                background: 'var(--gold)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontFamily: 'DM Mono, monospace',
                fontSize: '11px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase' as const,
                cursor: 'pointer',
                marginTop: '8px',
              }}
            >
              Enregistrer
            </button>
          </div>
        )}

        {/* ONGLET CONTRIBUTIONS */}
        {activeTab === 'contributions' && (
          <div>
            {/* Traductions de mots */}
            <div style={{ marginBottom: '32px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}>
                <div style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '10px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase' as const,
                  color: 'var(--ink-muted)',
                }}>
                  Traductions de mots ({profile?._count.wordTranslations || 0})
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {(['ALL', 'VALIDATED', 'PROPOSED'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => { setWordFilter(f); setWordPage(1) }}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '20px',
                        border: `1px solid ${wordFilter === f ? 'var(--gold)' : 'var(--border)'}`,
                        background: wordFilter === f ? 'var(--gold-pale)' : 'transparent',
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '9px',
                        color: wordFilter === f ? 'var(--gold)' : 'var(--ink-muted)',
                        cursor: 'pointer',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {f === 'ALL' ? 'Toutes' : f === 'VALIDATED' ? 'Validées' : 'Proposées'}
                    </button>
                  ))}
                </div>
              </div>
              {wordTranslations.length === 0 ? (
                <div style={{ fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-faint)', fontStyle: 'italic' }}>
                  Aucune proposition.
                </div>
              ) : (
                <>
                  {pagedWords.map(t => {
                    const verse = t.wordToken.verseText.verse
                    const url = getVerseUrl(
                      verse.chapter.book,
                      verse.chapter.number,
                      verse.number,
                      { wordId: t.wordToken.id, tab: 'word' }
                    )
                    return (
                      <Link key={t.id} href={url} style={{ textDecoration: 'none' }}>
                        <div style={{
                          padding: '10px 14px',
                          border: `1px solid ${t.isValidated ? 'rgba(45,90,58,0.3)' : 'var(--border)'}`,
                          borderRadius: '8px',
                          background: t.isValidated ? 'var(--green-light)' : 'white',
                          marginBottom: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'opacity 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                              <span style={{
                                fontFamily: 'Spectral, serif',
                                fontSize: '15px',
                                fontStyle: 'italic',
                                color: 'var(--ink)',
                              }}>
                                {t.translation}
                              </span>
                              <span style={{
                                fontFamily: 'DM Mono, monospace',
                                fontSize: '9px',
                                padding: '1px 6px',
                                borderRadius: '20px',
                                background: t.isValidated ? 'var(--green-light)' : 'var(--amber-light)',
                                color: t.isValidated ? 'var(--green-valid)' : 'var(--amber-pending)',
                                border: `1px solid ${t.isValidated ? 'rgba(45,90,58,0.2)' : 'rgba(122,90,26,0.2)'}`,
                              }}>
                                {t.isValidated ? 'Validée' : 'Proposée'}
                              </span>
															{!t.isValidated && (
																<span style={{
																	fontFamily: 'DM Mono, monospace',
																	fontSize: '9px',
																	color: 'var(--ink-muted)',
																}}>
																	{t.voteCount} vote{t.voteCount !== 1 ? 's' : ''}
																</span>
															)}
                            </div>
                            <div style={{
                              fontFamily: 'DM Mono, monospace',
                              fontSize: '9px',
                              color: 'var(--ink-muted)',
                            }}>
                              {t.wordToken.word} · {verse.chapter.book.name} {verse.chapter.number}:{verse.number}
                            </div>
                          </div>
                          <div style={{
                            fontFamily: 'DM Mono, monospace',
                            fontSize: '9px',
                            color: 'var(--ink-faint)',
                            flexShrink: 0,
                            marginLeft: '12px',
                          }}>
                            {new Date(t.createdAt).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                  {pagedWords.length < filteredWords.length && (
                    <button
                      onClick={() => setWordPage(p => p + 1)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        background: 'transparent',
                        border: '1px dashed var(--border-strong)',
                        borderRadius: '6px',
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '10px',
                        color: 'var(--ink-muted)',
                        cursor: 'pointer',
                        marginTop: '4px',
                      }}
                    >
                      Voir plus ({filteredWords.length - pagedWords.length} restantes)
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Propositions */}
            <div style={{ marginBottom: '32px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}>
                <div style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '10px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase' as const,
                  color: 'var(--ink-muted)',
                }}>
                  Reformulation de versets ({profile?._count.proposals || 0})
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {(['ALL', 'PENDING', 'ACCEPTED', 'REJECTED'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => { setProposalFilter(f); setProposalPage(1) }}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '20px',
                        border: `1px solid ${proposalFilter === f ? 'var(--gold)' : 'var(--border)'}`,
                        background: proposalFilter === f ? 'var(--gold-pale)' : 'transparent',
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '9px',
                        color: proposalFilter === f ? 'var(--gold)' : 'var(--ink-muted)',
                        cursor: 'pointer',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {f === 'ALL' ? 'Toutes' : f === 'PENDING' ? 'En attente' : f === 'ACCEPTED' ? 'Acceptées' : 'Rejetées'}
                    </button>
                  ))}
                </div>
              </div>
              {proposals.length === 0 ? (
                <div style={{ fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-faint)', fontStyle: 'italic' }}>
                  Aucune proposition.
                </div>
              ) : (
                <>
                  {pagedProposals.map(p => {
                    const verse = p.translation.verse
                    const url = getVerseUrl(
                      verse.chapter.book,
                      verse.chapter.number,
                      verse.number,
                      { verseId: verse.id, tab: 'verse' }
                    )
                    return (
                      <Link key={p.id} href={url} style={{ textDecoration: 'none' }}>
                        <div style={{
                          padding: '10px 14px',
                          border: `1px solid ${p.status === 'ACCEPTED' ? 'rgba(45,90,58,0.3)' : p.status === 'REJECTED' ? 'rgba(122,42,42,0.2)' : 'var(--border)'}`,
                          borderRadius: '8px',
                          background: p.status === 'ACCEPTED' ? 'var(--green-light)' : p.status === 'REJECTED' ? 'var(--red-light)' : 'white',
                          marginBottom: '8px',
                          cursor: 'pointer',
                          transition: 'opacity 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                        >
                          <div style={{
														display: 'flex',
														justifyContent: 'space-between',
														marginBottom: '4px',
													}}>
														<span style={{
															fontFamily: 'DM Mono, monospace',
															fontSize: '9px',
															color: 'var(--ink-muted)',
														}}>
															{verse.chapter.book.name} {verse.chapter.number}:{verse.number}
														</span>
														<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
															<span style={{
																fontFamily: 'DM Mono, monospace',
																fontSize: '9px',
																padding: '1px 6px',
																borderRadius: '20px',
																background: p.status === 'ACCEPTED' ? 'var(--green-light)' : p.status === 'REJECTED' ? 'var(--red-light)' : 'var(--amber-light)',
																color: p.status === 'ACCEPTED' ? 'var(--green-valid)' : p.status === 'REJECTED' ? 'var(--red-soft)' : 'var(--amber-pending)',
																border: `1px solid ${p.status === 'ACCEPTED' ? 'rgba(45,90,58,0.2)' : p.status === 'REJECTED' ? 'rgba(122,42,42,0.2)' : 'rgba(122,90,26,0.2)'}`,
															}}>
																{p.status === 'ACCEPTED' ? 'Acceptée' : p.status === 'REJECTED' ? 'Rejetée' : 'En attente'}
															</span>
															{p.status === 'PENDING' && (
																<span style={{
																	fontFamily: 'DM Mono, monospace',
																	fontSize: '9px',
																	color: 'var(--ink-muted)',
																}}>
																	{p.votes?.length || 0} vote{(p.votes?.length || 0) !== 1 ? 's' : ''}
																</span>
															)}
															<span style={{
																fontFamily: 'DM Mono, monospace',
																fontSize: '9px',
																color: 'var(--ink-faint)',
															}}>
																{new Date(p.createdAt).toLocaleDateString('fr-FR')}
															</span>
														</div>
													</div>
                          <div style={{
                            fontFamily: 'Spectral, serif',
                            fontSize: '13px',
                            fontStyle: 'italic',
                            color: 'var(--ink-soft)',
                            lineHeight: '1.6',
                          }}>
                            {p.proposedText}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                  {pagedProposals.length < filteredProposals.length && (
                    <button
                      onClick={() => setProposalPage(p => p + 1)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        background: 'transparent',
                        border: '1px dashed var(--border-strong)',
                        borderRadius: '6px',
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '10px',
                        color: 'var(--ink-muted)',
                        cursor: 'pointer',
                        marginTop: '4px',
                      }}
                    >
                      Voir plus ({filteredProposals.length - pagedProposals.length} restantes)
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Commentaires */}
            <div>
              <div style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: '10px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
                color: 'var(--ink-muted)',
                marginBottom: '12px',
              }}>
                Commentaires ({profile?._count.comments || 0})
              </div>
              {comments.length === 0 ? (
                <div style={{ fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-faint)', fontStyle: 'italic' }}>
                  Aucun commentaire.
                </div>
              ) : (
                <>
                  {pagedComments.map(c => {
                    const url = c.verse ? getVerseUrl(
                      c.verse.chapter.book,
                      c.verse.chapter.number,
                      c.verse.number,
                      { verseId: c.verse.id, tab: 'comments' }
                    ) : null
                    const content = (
                      <div style={{
                        padding: '10px 14px',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        background: 'white',
                        marginBottom: '8px',
                        cursor: url ? 'pointer' : 'default',
                        transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'}
											onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                      >
                        {c.verse && (
													<div style={{
														display: 'flex',
														justifyContent: 'space-between',
														fontFamily: 'DM Mono, monospace',
														fontSize: '9px',
														color: 'var(--ink-muted)',
														marginBottom: '4px',
													}}>
														<span>{c.verse.chapter.book.name} {c.verse.chapter.number}:{c.verse.number}</span>
														<span style={{ color: 'var(--ink-faint)' }}>{new Date(c.createdAt).toLocaleDateString('fr-FR')}</span>
													</div>
												)}
                        <div style={{
                          fontFamily: 'Spectral, serif',
                          fontSize: '13px',
                          color: 'var(--ink-soft)',
                          lineHeight: '1.6',
                        }}>
                          <CommentText text={c.text} disableLinks />
                        </div>
                      </div>
                    )
                    return url ? (
                      <Link key={c.id} href={url} style={{ textDecoration: 'none', display: 'block' }}>
                        <div style={{
                          padding: '10px 14px',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          background: 'white',
                          marginBottom: '8px',
                          transition: 'opacity 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                        >
                          {c.verse && (
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontFamily: 'DM Mono, monospace',
                              fontSize: '9px',
                              color: 'var(--ink-muted)',
                              marginBottom: '4px',
                            }}>
                              <span>{c.verse.chapter.book.name} {c.verse.chapter.number}:{c.verse.number}</span>
                              <span style={{ color: 'var(--ink-faint)' }}>{new Date(c.createdAt).toLocaleDateString('fr-FR')}</span>
                            </div>
                          )}
                          <div style={{
                            fontFamily: 'Spectral, serif',
                            fontSize: '13px',
                            color: 'var(--ink-soft)',
                            lineHeight: '1.6',
                            pointerEvents: 'none',
                          }}>
                            <CommentText text={c.text} disableLinks />
                          </div>
                        </div>
                      </Link>
                    ) : (
                      <div key={c.id}>{content}</div>
                    )
                  })}
                  {pagedComments.length < comments.length && (
                    <button
                      onClick={() => setCommentPage(p => p + 1)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        background: 'transparent',
                        border: '1px dashed var(--border-strong)',
                        borderRadius: '6px',
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '10px',
                        color: 'var(--ink-muted)',
                        cursor: 'pointer',
                        marginTop: '4px',
                      }}
                    >
                      Voir plus ({comments.length - pagedComments.length} restants)
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ONGLET MOT DE PASSE */}
        {activeTab === 'password' && (
          <div style={{ maxWidth: '480px' }}>
            {passwordSuccess && (
              <div style={{
                padding: '10px 14px',
                background: 'var(--green-light)',
                border: '1px solid rgba(45,90,58,0.2)',
                borderRadius: '6px',
                color: 'var(--green-valid)',
                fontFamily: 'Spectral, serif',
                fontSize: '13px',
                marginBottom: '20px',
              }}>
                {passwordSuccess}
              </div>
            )}
            {passwordError && (
              <div style={{
                padding: '10px 14px',
                background: 'var(--red-light)',
                border: '1px solid rgba(122,42,42,0.2)',
                borderRadius: '6px',
                color: 'var(--red-soft)',
                fontFamily: 'Spectral, serif',
                fontSize: '13px',
                marginBottom: '20px',
              }}>
                {passwordError}
              </div>
            )}
            {[
              { label: 'Mot de passe actuel', value: currentPassword, setter: setCurrentPassword },
              { label: 'Nouveau mot de passe', value: newPassword, setter: setNewPassword },
              { label: 'Confirmer le nouveau mot de passe', value: confirmPassword, setter: setConfirmPassword },
            ].map(field => (
              <div key={field.label} style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '10px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase' as const,
                  color: 'var(--ink-muted)',
                  marginBottom: '6px',
                }}>
                  {field.label}
                </label>
                <input
                  type="password"
                  value={field.value}
                  onChange={e => field.setter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    background: 'white',
                    fontFamily: 'Spectral, serif',
                    fontSize: '14px',
                    color: 'var(--ink)',
                    outline: 'none',
                  }}
                />
              </div>
            ))}
            <button
              onClick={handleChangePassword}
              style={{
                padding: '10px 24px',
                background: 'var(--gold)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontFamily: 'DM Mono, monospace',
                fontSize: '11px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase' as const,
                cursor: 'pointer',
                marginTop: '8px',
              }}
            >
              Changer le mot de passe
            </button>
          </div>
        )}
      </div>
    </div>
  )
}