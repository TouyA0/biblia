'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { getRoleColor, getRoleBackground, getRoleBorder } from '@/lib/roleColors'
import ConfirmModal from '@/components/bible/ConfirmModal'
import CommentText from '@/components/bible/CommentText'
import NotificationBell from '@/components/bible/NotificationBell'


interface UserProfile {
  id: string
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

interface AdminInfo {
  user: {
    id: string
    email: string
    username: string
    role: string
    createdAt: string
    isVerified: boolean
    isActive: boolean
    forcePasswordReset: boolean
    lastLoginAt: string | null
  }
  logs: {
    id: string
    action: string
    metadata: Record<string, string> | null
    ip: string | null
    createdAt: string
  }[]
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
        chapter: { number: number; book: { name: string; slug: string; testament: string } }
      }
    }
  }
}

interface ProposalContrib {
  id: string
  proposedText: string
  status: string
  createdAt: string
  translation: {
    verse: {
      id: string
      number: number
      chapter: { number: number; book: { name: string; slug: string; testament: string } }
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
    chapter: { number: number; book: { name: string; slug: string; testament: string } }
  } | null
  parent: {
    verse: {
      id: string
      number: number
      chapter: { number: number; book: { name: string; slug: string; testament: string } }
    } | null
    creator: { username: string } | null
  } | null
}

interface ActivityDay {
  date: string
  count: number
}

function getVerseUrl(
  book: { slug: string; testament: string },
  chapterNumber: number,
  verseNumber?: number,
  options?: { wordId?: string; verseId?: string; tab?: string }
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

function ActivityGraph({ activity }: { activity: ActivityDay[] }) {
  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  
  // Grouper par mois sur 12 mois
  const today = new Date()
  const monthData: { label: string; count: number; month: number; year: number }[] = []
  
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const year = d.getFullYear()
    const month = d.getMonth()
    const count = activity
      .filter(a => {
        const date = new Date(a.date)
        return date.getFullYear() === year && date.getMonth() === month
      })
      .reduce((sum, a) => sum + Number(a.count), 0)
    monthData.push({ label: months[month], count, month, year })
  }

  const max = Math.max(...monthData.map(m => m.count), 1)
  const total = monthData.reduce((sum, m) => sum + m.count, 0)

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '6px',
        height: '80px',
        marginBottom: '8px',
      }}>
        {monthData.map((m, i) => (
          <div key={i} style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            height: '100%',
            justifyContent: 'flex-end',
          }}>
            <div style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '8px',
              color: 'var(--ink-muted)',
            }}>
              {m.count > 0 ? m.count : ''}
            </div>
            <div
              title={`${m.label} ${m.year} : ${m.count} contribution${m.count !== 1 ? 's' : ''}`}
              style={{
                width: '100%',
                height: `${Math.max((m.count / max) * 60, m.count > 0 ? 4 : 2)}px`,
                borderRadius: '3px 3px 0 0',
                background: m.count === 0
                  ? 'var(--parchment-deep)'
                  : m.count === max
                  ? 'var(--gold)'
                  : `rgba(184,132,58,${0.3 + (m.count / max) * 0.7})`,
                cursor: m.count > 0 ? 'pointer' : 'default',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.7'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
            />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        {monthData.map((m, i) => (
          <div key={i} style={{
            flex: 1,
            textAlign: 'center',
            fontFamily: 'DM Mono, monospace',
            fontSize: '8px',
            color: 'var(--ink-muted)',
          }}>
            {m.label}
          </div>
        ))}
      </div>
      <div style={{
        fontFamily: 'DM Mono, monospace',
        fontSize: '9px',
        color: 'var(--ink-muted)',
        marginTop: '10px',
        textAlign: 'right',
      }}>
        {total} contribution{total !== 1 ? 's' : ''} sur 12 mois
      </div>
    </div>
  )
}

function InlineField({ label, value, type, onSave }: {
  label: string
  value: string
  type: string
  onSave: (value: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)

  return (
    <div style={{ marginBottom: '12px', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '8px', background: 'white' }}>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--ink-muted)', marginBottom: '6px' }}>
        {label}
      </div>
      {editing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type={type}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            autoFocus
            style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--gold)', borderRadius: '6px', fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink)', outline: 'none', background: 'var(--gold-pale)' }}
          />
          <button
            onClick={async () => {
              if (!draft.trim() || draft === value) { setEditing(false); return }
              setSaving(true)
              await onSave(draft.trim())
              setSaving(false)
              setEditing(false)
            }}
            disabled={saving}
            style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: 'var(--green-valid)', color: 'white', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            {saving ? '…' : '✓'}
          </button>
          <button
            onClick={() => { setEditing(false); setDraft(value) }}
            style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid var(--border)', background: 'transparent', color: 'var(--ink-muted)', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            ✕
          </button>
        </div>
      ) : (
        <div
          onClick={() => { setEditing(true); setDraft(value) }}
          style={{ fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink)', cursor: 'pointer', padding: '2px 0', borderBottom: '1px dashed var(--border)', display: 'inline-block' }}
          title="Cliquer pour modifier"
        >
          {value}
        </div>
      )}
    </div>
  )
}

function PasswordField({ onSave }: { onSave: (current: string, newPwd: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [current, setCurrent] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  return (
    <div style={{ marginBottom: '12px', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '8px', background: 'white' }}>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--ink-muted)', marginBottom: '6px' }}>
        Mot de passe
      </div>
      {editing ? (
        <div>
          {err && <div style={{ fontFamily: 'Spectral, serif', fontSize: '12px', color: 'var(--red-soft)', marginBottom: '8px' }}>{err}</div>}
          {[
            { label: 'Actuel', value: current, setter: setCurrent },
            { label: 'Nouveau', value: newPwd, setter: setNewPwd },
            { label: 'Confirmer', value: confirm, setter: setConfirm },
          ].map(f => (
            <div key={f.label} style={{ marginBottom: '8px' }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '8px', color: 'var(--ink-muted)', marginBottom: '3px' }}>{f.label}</div>
              <input
                type="password"
                value={f.value}
                onChange={e => f.setter(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontFamily: 'Spectral, serif', fontSize: '13px', color: 'var(--ink)', outline: 'none' }}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button
              onClick={async () => {
                setErr('')
                if (newPwd !== confirm) { setErr('Les mots de passe ne correspondent pas'); return }
                if (newPwd.length < 8) { setErr('8 caractères minimum'); return }
                setSaving(true)
                await onSave(current, newPwd)
                setSaving(false)
                setEditing(false)
                setCurrent(''); setNewPwd(''); setConfirm('')
              }}
              disabled={saving}
              style={{ padding: '6px 14px', background: 'var(--green-valid)', color: 'white', border: 'none', borderRadius: '6px', fontFamily: 'DM Mono, monospace', fontSize: '9px', cursor: 'pointer' }}
            >
              {saving ? '…' : '✓ Enregistrer'}
            </button>
            <button
              onClick={() => { setEditing(false); setCurrent(''); setNewPwd(''); setConfirm(''); setErr('') }}
              style={{ padding: '6px 14px', background: 'transparent', color: 'var(--ink-muted)', border: '1px solid var(--border)', borderRadius: '6px', fontFamily: 'DM Mono, monospace', fontSize: '9px', cursor: 'pointer' }}
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => setEditing(true)}
          style={{ fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-muted)', cursor: 'pointer', padding: '2px 0', borderBottom: '1px dashed var(--border)', display: 'inline-block', fontStyle: 'italic' }}
          title="Cliquer pour modifier"
        >
          ••••••••
        </div>
      )}
    </div>
  )
}

export default function UserProfilePage() {
  const params = useParams()
  const router = useRouter()
  const username = params.username as string
  const { user: currentUser, setUser, setToken } = useAuthStore()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [wordTranslations, setWordTranslations] = useState<WordTranslationContrib[]>([])
  const [proposals, setProposals] = useState<ProposalContrib[]>([])
  const [comments, setComments] = useState<CommentContrib[]>([])
  const [activity, setActivity] = useState<ActivityDay[]>([])
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [activeTab, setActiveTab] = useState<'contributions' | 'info' | 'password' | 'admin'>('contributions')
  const [wordPage, setWordPage] = useState(1)
  const [proposalPage, setProposalPage] = useState(1)
  const [commentPage, setCommentPage] = useState(1)
  const [wordFilter, setWordFilter] = useState<'ALL' | 'VALIDATED' | 'PROPOSED'>('ALL')
  const [proposalFilter, setProposalFilter] = useState<'ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED'>('ALL')
  const [filterTestament, setFilterTestament] = useState<'ALL' | 'AT' | 'NT'>('ALL')
  const [filterBook, setFilterBook] = useState<string>('')
  const [filterChapter, setFilterChapter] = useState<string>('')
  const [filterVerse, setFilterVerse] = useState<string>('')

  // Formulaire profil (seulement si c'est sa propre page)
  const [editUsername, setEditUsername] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileError, setProfileError] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const [localUser, setLocalUser] = useState<{ username: string; role: string } | null>(null)

  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const [expandedLogCats, setExpandedLogCats] = useState<Set<string>>(new Set())

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (savedUser) setLocalUser(JSON.parse(savedUser))
  }, [])

  const isOwnProfile = localUser?.username === username
  const isAdmin = localUser?.role === 'ADMIN'

  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (token && savedUser) {
      setToken(token)
      setUser(JSON.parse(savedUser))
    }
    loadData()
  }, [username])

  async function loadData() {
    setLoading(true)
    try {
      const [profileRes, contribRes] = await Promise.all([
        api.get(`/api/users/${username}`),
        api.get(`/api/users/${username}/contributions`),
      ])
      setProfile(profileRes.data)
      setWordTranslations(contribRes.data.wordTranslations)
      setProposals(contribRes.data.proposals)
      setComments(contribRes.data.comments)
      setActivity(contribRes.data.activity)

      // Si admin, charger les infos admin
      const savedUser = localStorage.getItem('user')
      if (savedUser && JSON.parse(savedUser).role === 'ADMIN') {
        try {
          const adminRes = await api.get(`/api/users/${username}/admin`)
          setAdminInfo(adminRes.data)
          setEditUsername(adminRes.data.user.username)
          setEditEmail(adminRes.data.user.email)
        } catch (e) {
          console.error(e)
        }
      } else if (savedUser && JSON.parse(savedUser).username === username) {
        const adminRes = await api.get(`/api/profile`)
        setEditUsername(adminRes.data.username)
        setEditEmail(adminRes.data.email)
      }
    } catch (error: unknown) {
      const e = error as { response?: { status?: number } }
      if (e.response?.status === 404) setNotFound(true)
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function handleChangePassword() {
    setPasswordError('')
    setPasswordSuccess('')
    if (newPassword !== confirmPassword) { setPasswordError('Les mots de passe ne correspondent pas'); return }
    try {
      await api.patch('/api/profile/password', { currentPassword, newPassword })
      setPasswordSuccess('Mot de passe modifié')
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      setPasswordError(error.response?.data?.error || 'Erreur')
    }
  }

  // Extraire tous les versets uniques des contributions
  const allVerseRefs = [
    ...wordTranslations.map(t => ({
      testament: t.wordToken.verseText.verse.chapter.book.testament,
      book: t.wordToken.verseText.verse.chapter.book.name,
      chapter: t.wordToken.verseText.verse.chapter.number,
      verse: t.wordToken.verseText.verse.number,
    })),
    ...proposals.map(p => ({
      testament: p.translation.verse.chapter.book.testament,
      book: p.translation.verse.chapter.book.name,
      chapter: p.translation.verse.chapter.number,
      verse: p.translation.verse.number,
    })),
    ...comments.map(c => {
      const v = c.verse || c.parent?.verse
      return v ? {
        testament: v.chapter.book.testament,
        book: v.chapter.book.name,
        chapter: v.chapter.number,
        verse: v.number,
      } : null
    }).filter(Boolean),
  ]

  // Options disponibles en cascade
  const availableBooks = [...new Set(
    allVerseRefs
      .filter(r => filterTestament === 'ALL' || r!.testament === filterTestament)
      .map(r => r!.book)
  )].sort()

  const availableChapters = [...new Set(
    allVerseRefs
      .filter(r => filterTestament === 'ALL' || r!.testament === filterTestament)
      .filter(r => !filterBook || r!.book === filterBook)
      .map(r => r!.chapter)
  )].sort((a, b) => a - b)

  const availableVerses = [...new Set(
    allVerseRefs
      .filter(r => filterTestament === 'ALL' || r!.testament === filterTestament)
      .filter(r => !filterBook || r!.book === filterBook)
      .filter(r => !filterChapter || r!.chapter === Number(filterChapter))
      .map(r => r!.verse)
  )].sort((a, b) => a - b)

  // Appliquer les filtres
  const matchesFilter = (testament: string, book: string, chapter: number, verse: number) => {
    if (filterTestament !== 'ALL' && testament !== filterTestament) return false
    if (filterBook && book !== filterBook) return false
    if (filterChapter && chapter !== Number(filterChapter)) return false
    if (filterVerse && verse !== Number(filterVerse)) return false
    return true
  }

  const filteredWords = wordTranslations
    .filter(t => wordFilter === 'ALL' ? true : wordFilter === 'VALIDATED' ? t.isValidated : !t.isValidated)
    .filter(t => matchesFilter(
      t.wordToken.verseText.verse.chapter.book.testament,
      t.wordToken.verseText.verse.chapter.book.name,
      t.wordToken.verseText.verse.chapter.number,
      t.wordToken.verseText.verse.number,
    ))
  const pagedWords = filteredWords.slice(0, wordPage * ITEMS_PER_PAGE)

  const filteredProposals = proposals
    .filter(p => proposalFilter === 'ALL' ? true : p.status === proposalFilter)
    .filter(p => matchesFilter(
      p.translation.verse.chapter.book.testament,
      p.translation.verse.chapter.book.name,
      p.translation.verse.chapter.number,
      p.translation.verse.number,
    ))
  const pagedProposals = filteredProposals.slice(0, proposalPage * ITEMS_PER_PAGE)

  const filteredComments = comments.filter(c => {
    const v = c.verse || c.parent?.verse
    if (!v) return filterTestament === 'ALL' && !filterBook && !filterChapter && !filterVerse
    return matchesFilter(v.chapter.book.testament, v.chapter.book.name, v.chapter.number, v.number)
  })
  const pagedComments = filteredComments.slice(0, commentPage * ITEMS_PER_PAGE)

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--parchment)', fontFamily: 'Spectral, serif', fontStyle: 'italic', color: 'var(--ink-muted)' }}>
      Chargement...
    </div>
  )

  if (notFound) return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--parchment)', gap: '16px' }}>
      <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '32px', color: 'var(--ink-muted)' }}>Utilisateur introuvable</div>
      <Link href="/" style={{ color: 'var(--gold)', fontFamily: 'DM Mono, monospace', fontSize: '11px' }}>← Retour</Link>
    </div>
  )

  const tabs = [
    { key: 'contributions', label: 'Contributions' },
    ...(isOwnProfile ? [
      { key: 'info', label: 'Mon profil' },
    ] : []),
    ...(isAdmin ? [{ key: 'admin', label: 'Admin' }] : []),
  ] as const

  return (
    <div style={{ minHeight: '100vh', background: 'var(--parchment)' }}>
      {/* Topbar */}
      <div style={{ background: 'var(--ink)', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center', gap: '24px' }}>
        <Link href="/" style={{ fontFamily: 'Crimson Pro, serif', fontSize: '22px', fontWeight: '300', color: 'var(--gold-light)', letterSpacing: '0.06em', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ opacity: 0.7, fontStyle: 'italic' }}>בּ</span>
          Biblia
        </Link>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
          {currentUser?.role === 'ADMIN' && (
            <Link href="/admin" style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#e88', letterSpacing: '0.08em', textDecoration: 'none', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(122,42,42,0.3)', background: 'rgba(122,42,42,0.15)' }}>
              Administration
            </Link>
          )}
          {currentUser && ['EXPERT', 'ADMIN'].includes(currentUser.role) && <NotificationBell />}
          {currentUser && (
            <Link href={`/profile/${currentUser.username}`} style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>
              {currentUser.username}
            </Link>
          )}
          {currentUser && (
            <button onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('refreshToken'); localStorage.removeItem('user'); router.push('/login') }}
              style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'rgba(255,255,255,0.4)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              Déconnexion
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px' }}>
        {/* Header */}
        {profile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px', flexWrap: 'wrap' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: getRoleColor(profile.role), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace', fontSize: '20px', color: 'white', flexShrink: 0 }}>
              {profile.username.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '28px', fontWeight: '300', color: 'var(--ink)', marginBottom: '4px' }}>
                {profile.username}
                {isOwnProfile && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--gold)', marginLeft: '10px' }}>(vous)</span>}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', padding: '3px 10px', borderRadius: '20px', background: getRoleBackground(profile.role), color: getRoleColor(profile.role), border: `1px solid ${getRoleBorder(profile.role)}` }}>
                  {profile.role}
                </span>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--ink-muted)' }}>
                  Membre depuis {new Date(profile.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </span>
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              {[
                { label: 'Traductions', value: profile._count.wordTranslations },
                { label: 'Propositions', value: profile._count.proposals },
                { label: 'Commentaires', value: profile._count.comments },
                { label: 'Votes', value: profile._count.votes },
              ].map(stat => (
                <div key={stat.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '28px', fontWeight: '300', color: 'var(--gold)' }}>{stat.value}</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--ink-muted)' }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Graphique d'activité */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--ink-muted)', marginBottom: '16px' }}>
            Activité — 12 derniers mois
          </div>
          <ActivityGraph activity={activity} />
        </div>

        {/* Onglets */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '32px' }}>
          {tabs.map(tab => (
            <div key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)}
              style={{ padding: '12px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: activeTab === tab.key ? 'var(--gold)' : 'var(--ink-muted)', cursor: 'pointer', borderBottom: activeTab === tab.key ? '2px solid var(--gold)' : '2px solid transparent', marginBottom: '-1px' }}>
              {tab.label}
            </div>
          ))}
        </div>

        {/* ONGLET CONTRIBUTIONS */}
        {activeTab === 'contributions' && (
          <div>
            {/* Filtres en cascade */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Testament */}
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['ALL', 'AT', 'NT'] as const).map(t => (
                  <button key={t} onClick={() => { setFilterTestament(t); setFilterBook(''); setFilterChapter(''); setFilterVerse(''); setWordPage(1); setProposalPage(1); setCommentPage(1) }}
                    style={{ padding: '5px 10px', borderRadius: '20px', border: `1px solid ${filterTestament === t ? 'var(--gold)' : 'var(--border)'}`, background: filterTestament === t ? 'var(--gold-pale)' : 'transparent', fontFamily: 'DM Mono, monospace', fontSize: '9px', color: filterTestament === t ? 'var(--gold)' : 'var(--ink-muted)', cursor: 'pointer' }}>
                    {t === 'ALL' ? 'Tout' : t}
                  </button>
                ))}
              </div>

              {/* Livre */}
              {availableBooks.length > 0 && (
                <select
                  value={filterBook}
                  onChange={e => { setFilterBook(e.target.value); setFilterChapter(''); setFilterVerse(''); setWordPage(1); setProposalPage(1); setCommentPage(1) }}
                  style={{ padding: '5px 10px', border: `1px solid ${filterBook ? 'var(--gold)' : 'var(--border)'}`, borderRadius: '6px', background: filterBook ? 'var(--gold-pale)' : 'white', fontFamily: 'DM Mono, monospace', fontSize: '9px', color: filterBook ? 'var(--gold)' : 'var(--ink-muted)', cursor: 'pointer', outline: 'none' }}
                >
                  <option value="">Tous les livres</option>
                  {availableBooks.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              )}

              {/* Chapitre */}
              {filterBook && availableChapters.length > 0 && (
                <select
                  value={filterChapter}
                  onChange={e => { setFilterChapter(e.target.value); setFilterVerse(''); setWordPage(1); setProposalPage(1); setCommentPage(1) }}
                  style={{ padding: '5px 10px', border: `1px solid ${filterChapter ? 'var(--gold)' : 'var(--border)'}`, borderRadius: '6px', background: filterChapter ? 'var(--gold-pale)' : 'white', fontFamily: 'DM Mono, monospace', fontSize: '9px', color: filterChapter ? 'var(--gold)' : 'var(--ink-muted)', cursor: 'pointer', outline: 'none' }}
                >
                  <option value="">Tous les chapitres</option>
                  {availableChapters.map(c => <option key={c} value={c}>Chapitre {c}</option>)}
                </select>
              )}

              {/* Verset */}
              {filterChapter && availableVerses.length > 0 && (
                <select
                  value={filterVerse}
                  onChange={e => { setFilterVerse(e.target.value); setWordPage(1); setProposalPage(1); setCommentPage(1) }}
                  style={{ padding: '5px 10px', border: `1px solid ${filterVerse ? 'var(--gold)' : 'var(--border)'}`, borderRadius: '6px', background: filterVerse ? 'var(--gold-pale)' : 'white', fontFamily: 'DM Mono, monospace', fontSize: '9px', color: filterVerse ? 'var(--gold)' : 'var(--ink-muted)', cursor: 'pointer', outline: 'none' }}
                >
                  <option value="">Tous les versets</option>
                  {availableVerses.map(v => <option key={v} value={v}>Verset {v}</option>)}
                </select>
              )}

              {/* Reset */}
              {(filterTestament !== 'ALL' || filterBook || filterChapter || filterVerse) && (
                <button onClick={() => { setFilterTestament('ALL'); setFilterBook(''); setFilterChapter(''); setFilterVerse(''); setWordPage(1); setProposalPage(1); setCommentPage(1) }}
                  style={{ padding: '5px 10px', borderRadius: '20px', border: '1px solid rgba(122,42,42,0.2)', background: 'var(--red-light)', fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--red-soft)', cursor: 'pointer' }}>
                  ✕ Réinitialiser
                </button>
              )}
            </div>
            {/* Traductions */}
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--ink-muted)' }}>
                  Traductions de mots ({profile?._count.wordTranslations || 0})
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {(['ALL', 'VALIDATED', 'PROPOSED'] as const).map(f => (
                    <button key={f} onClick={() => { setWordFilter(f); setWordPage(1) }}
                      style={{ padding: '2px 8px', borderRadius: '20px', border: `1px solid ${wordFilter === f ? 'var(--gold)' : 'var(--border)'}`, background: wordFilter === f ? 'var(--gold-pale)' : 'transparent', fontFamily: 'DM Mono, monospace', fontSize: '9px', color: wordFilter === f ? 'var(--gold)' : 'var(--ink-muted)', cursor: 'pointer' }}>
                      {f === 'ALL' ? 'Toutes' : f === 'VALIDATED' ? 'Validées' : 'Proposées'}
                    </button>
                  ))}
                </div>
              </div>
              {pagedWords.length === 0 ? (
                <div style={{ fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-faint)', fontStyle: 'italic' }}>Aucune traduction.</div>
              ) : (
                <>
                  {pagedWords.map(t => {
                    const verse = t.wordToken.verseText.verse
                    const url = getVerseUrl(verse.chapter.book, verse.chapter.number, verse.number, { wordId: t.wordToken.id, tab: 'word' })
                    return (
                      <Link key={t.id} href={url} style={{ textDecoration: 'none' }}>
                        <div style={{ padding: '10px 14px', border: `1px solid ${t.isValidated ? 'rgba(45,90,58,0.3)' : 'var(--border)'}`, borderRadius: '8px', background: t.isValidated ? 'var(--green-light)' : 'white', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'opacity 0.15s' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                              <span style={{ fontFamily: 'Spectral, serif', fontSize: '15px', fontStyle: 'italic', color: 'var(--ink)' }}>{t.translation}</span>
                              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', padding: '1px 6px', borderRadius: '20px', background: t.isValidated ? 'var(--green-light)' : 'var(--amber-light)', color: t.isValidated ? 'var(--green-valid)' : 'var(--amber-pending)', border: `1px solid ${t.isValidated ? 'rgba(45,90,58,0.2)' : 'rgba(122,90,26,0.2)'}` }}>
                                {t.isValidated ? 'Validée' : 'Proposée'}
                              </span>
                              {!t.isValidated && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--ink-muted)' }}>{t.voteCount} vote{t.voteCount !== 1 ? 's' : ''}</span>}
                            </div>
                            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--ink-muted)' }}>
                              {t.wordToken.word} · {verse.chapter.book.name} {verse.chapter.number}:{verse.number}
                            </div>
                          </div>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--ink-faint)', flexShrink: 0, marginLeft: '12px' }}>
                            {new Date(t.createdAt).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                  {pagedWords.length < filteredWords.length && (
                    <button onClick={() => setWordPage(p => p + 1)} style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px dashed var(--border-strong)', borderRadius: '6px', fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--ink-muted)', cursor: 'pointer', marginTop: '4px' }}>
                      Voir plus ({filteredWords.length - pagedWords.length} restantes)
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Propositions */}
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--ink-muted)' }}>
                  Reformulations de versets ({profile?._count.proposals || 0})
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {(['ALL', 'PENDING', 'ACCEPTED', 'REJECTED'] as const).map(f => (
                    <button key={f} onClick={() => { setProposalFilter(f); setProposalPage(1) }}
                      style={{ padding: '2px 8px', borderRadius: '20px', border: `1px solid ${proposalFilter === f ? 'var(--gold)' : 'var(--border)'}`, background: proposalFilter === f ? 'var(--gold-pale)' : 'transparent', fontFamily: 'DM Mono, monospace', fontSize: '9px', color: proposalFilter === f ? 'var(--gold)' : 'var(--ink-muted)', cursor: 'pointer' }}>
                      {f === 'ALL' ? 'Toutes' : f === 'PENDING' ? 'En attente' : f === 'ACCEPTED' ? 'Acceptées' : 'Rejetées'}
                    </button>
                  ))}
                </div>
              </div>
              {pagedProposals.length === 0 ? (
                <div style={{ fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-faint)', fontStyle: 'italic' }}>Aucune proposition.</div>
              ) : (
                <>
                  {pagedProposals.map(p => {
                    const verse = p.translation.verse
                    const url = getVerseUrl(verse.chapter.book, verse.chapter.number, verse.number, { verseId: verse.id, tab: 'verse' })
                    return (
                      <Link key={p.id} href={url} style={{ textDecoration: 'none' }}>
                        <div style={{ padding: '10px 14px', border: `1px solid ${p.status === 'ACCEPTED' ? 'rgba(45,90,58,0.3)' : p.status === 'REJECTED' ? 'rgba(122,42,42,0.2)' : 'var(--border)'}`, borderRadius: '8px', background: p.status === 'ACCEPTED' ? 'var(--green-light)' : p.status === 'REJECTED' ? 'var(--red-light)' : 'white', marginBottom: '8px', cursor: 'pointer', transition: 'opacity 0.15s' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--ink-muted)' }}>
                              {verse.chapter.book.name} {verse.chapter.number}:{verse.number}
                            </span>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', padding: '1px 6px', borderRadius: '20px', background: p.status === 'ACCEPTED' ? 'var(--green-light)' : p.status === 'REJECTED' ? 'var(--red-light)' : 'var(--amber-light)', color: p.status === 'ACCEPTED' ? 'var(--green-valid)' : p.status === 'REJECTED' ? 'var(--red-soft)' : 'var(--amber-pending)', border: `1px solid ${p.status === 'ACCEPTED' ? 'rgba(45,90,58,0.2)' : p.status === 'REJECTED' ? 'rgba(122,42,42,0.2)' : 'rgba(122,90,26,0.2)'}` }}>
                                {p.status === 'ACCEPTED' ? 'Acceptée' : p.status === 'REJECTED' ? 'Rejetée' : 'En attente'}
                              </span>
                              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--ink-faint)' }}>
                                {new Date(p.createdAt).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                          </div>
                          <div style={{ fontFamily: 'Spectral, serif', fontSize: '13px', fontStyle: 'italic', color: 'var(--ink-soft)', lineHeight: '1.6' }}>
                            {p.proposedText}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                  {pagedProposals.length < filteredProposals.length && (
                    <button onClick={() => setProposalPage(p => p + 1)} style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px dashed var(--border-strong)', borderRadius: '6px', fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--ink-muted)', cursor: 'pointer', marginTop: '4px' }}>
                      Voir plus ({filteredProposals.length - pagedProposals.length} restantes)
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Commentaires */}
            <div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--ink-muted)', marginBottom: '12px' }}>
                Commentaires ({filteredComments.length})
              </div>
              {pagedComments.length === 0 ? (
                <div style={{ fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-faint)', fontStyle: 'italic' }}>Aucun commentaire.</div>
              ) : (
                <>
                  {pagedComments.map(c => {
                    const verse = c.verse || c.parent?.verse || null
                    const url = verse ? getVerseUrl(verse.chapter.book, verse.chapter.number, verse.number, { verseId: verse.id, tab: 'comments' }) : null
                    return url ? (
                      <Link key={c.id} href={url} style={{ textDecoration: 'none', display: 'block' }}>
                        <div style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px', background: 'white', marginBottom: '8px', transition: 'opacity 0.15s' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
                          {verse && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--ink-muted)', marginBottom: '4px' }}>
                              <span>
                                {verse.chapter.book.name} {verse.chapter.number}:{verse.number}
                                {c.parent && (
                                  <span style={{ color: 'var(--ink-faint)', marginLeft: '6px' }}>
                                    · ↩ réponse à @{c.parent.creator?.username || 'anonyme'}
                                  </span>
                                )}
                              </span>
                              <span style={{ color: 'var(--ink-faint)' }}>{new Date(c.createdAt).toLocaleDateString('fr-FR')}</span>
                            </div>
                          )}
                          <div style={{ fontFamily: 'Spectral, serif', fontSize: '13px', color: 'var(--ink-soft)', lineHeight: '1.6', pointerEvents: 'none' }}>
                            <CommentText text={c.text} disableLinks />
                          </div>
                        </div>
                      </Link>
                    ) : (
                      <div key={c.id} style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px', background: 'white', marginBottom: '8px' }}>
                        <div style={{ fontFamily: 'Spectral, serif', fontSize: '13px', color: 'var(--ink-soft)', lineHeight: '1.6' }}>
                          <CommentText text={c.text} disableLinks />
                        </div>
                      </div>
                    )
                  })}
                  {pagedComments.length < filteredComments.length && (
                    <button onClick={() => setCommentPage(p => p + 1)} style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px dashed var(--border-strong)', borderRadius: '6px', fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--ink-muted)', cursor: 'pointer', marginTop: '4px' }}>
                      Voir plus ({filteredComments.length - pagedComments.length} restants)
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ONGLET MON PROFIL */}
        {activeTab === 'info' && isOwnProfile && (
          <div style={{ maxWidth: '480px' }}>
            {profileSuccess && (
              <div style={{ padding: '10px 14px', background: 'var(--green-light)', border: '1px solid rgba(45,90,58,0.2)', borderRadius: '6px', color: 'var(--green-valid)', fontFamily: 'Spectral, serif', fontSize: '13px', marginBottom: '20px' }}>
                {profileSuccess}
              </div>
            )}
            {profileError && (
              <div style={{ padding: '10px 14px', background: 'var(--red-light)', border: '1px solid rgba(122,42,42,0.2)', borderRadius: '6px', color: 'var(--red-soft)', fontFamily: 'Spectral, serif', fontSize: '13px', marginBottom: '20px' }}>
                {profileError}
              </div>
            )}

            {/* Champs inline */}
            {[
              { label: "Nom d'utilisateur", field: 'username' as const, value: editUsername, setter: setEditUsername, type: 'text' },
              { label: 'Email', field: 'email' as const, value: editEmail, setter: setEditEmail, type: 'email' },
            ].map(item => (
              <InlineField
                key={item.field}
                label={item.label}
                value={item.value}
                type={item.type}
                onSave={async (newValue) => {
                  setProfileError('')
                  setProfileSuccess('')
                  try {
                    const payload = item.field === 'username'
                      ? { username: newValue, email: editEmail }
                      : { username: editUsername, email: newValue }
                    const res = await api.patch('/api/profile', payload)
                    setUser(res.data)
                    localStorage.setItem('user', JSON.stringify(res.data))
                    if (item.field === 'username') {
                      setEditUsername(newValue)
                      router.push(`/profile/${newValue}`)
                    } else {
                      setEditEmail(newValue)
                    }
                    setProfileSuccess(`${item.label} mis à jour`)
                  } catch (err: unknown) {
                    const error = err as { response?: { data?: { error?: string } } }
                    setProfileError(error.response?.data?.error || 'Erreur')
                  }
                }}
              />
            ))}

            {/* Mot de passe inline */}
            <PasswordField
              onSave={async (currentPwd, newPwd) => {
                setPasswordError('')
                setPasswordSuccess('')
                try {
                  await api.patch('/api/profile/password', { currentPassword: currentPwd, newPassword: newPwd })
                  setPasswordSuccess('Mot de passe modifié')
                } catch (err: unknown) {
                  const error = err as { response?: { data?: { error?: string } } }
                  setPasswordError(error.response?.data?.error || 'Erreur')
                }
              }}
            />
            {passwordSuccess && (
              <div style={{ padding: '10px 14px', background: 'var(--green-light)', border: '1px solid rgba(45,90,58,0.2)', borderRadius: '6px', color: 'var(--green-valid)', fontFamily: 'Spectral, serif', fontSize: '13px', marginTop: '12px' }}>
                {passwordSuccess}
              </div>
            )}
            {passwordError && (
              <div style={{ padding: '10px 14px', background: 'var(--red-light)', border: '1px solid rgba(122,42,42,0.2)', borderRadius: '6px', color: 'var(--red-soft)', fontFamily: 'Spectral, serif', fontSize: '13px', marginTop: '12px' }}>
                {passwordError}
              </div>
            )}
          </div>
        )}

        {/* ONGLET MOT DE PASSE */}
        {activeTab === 'password' && isOwnProfile && (
          <div style={{ maxWidth: '480px' }}>
            {passwordSuccess && <div style={{ padding: '10px 14px', background: 'var(--green-light)', border: '1px solid rgba(45,90,58,0.2)', borderRadius: '6px', color: 'var(--green-valid)', fontFamily: 'Spectral, serif', fontSize: '13px', marginBottom: '20px' }}>{passwordSuccess}</div>}
            {passwordError && <div style={{ padding: '10px 14px', background: 'var(--red-light)', border: '1px solid rgba(122,42,42,0.2)', borderRadius: '6px', color: 'var(--red-soft)', fontFamily: 'Spectral, serif', fontSize: '13px', marginBottom: '20px' }}>{passwordError}</div>}
            {[
              { label: 'Mot de passe actuel', value: currentPassword, setter: setCurrentPassword },
              { label: 'Nouveau mot de passe', value: newPassword, setter: setNewPassword },
              { label: 'Confirmer', value: confirmPassword, setter: setConfirmPassword },
            ].map(field => (
              <div key={field.label} style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--ink-muted)', marginBottom: '6px' }}>{field.label}</label>
                <input type="password" value={field.value} onChange={e => field.setter(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '6px', background: 'white', fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink)', outline: 'none' }} />
              </div>
            ))}
            <button onClick={handleChangePassword} style={{ padding: '10px 24px', background: 'var(--gold)', color: 'white', border: 'none', borderRadius: '6px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' as const, cursor: 'pointer' }}>
              Changer
            </button>
          </div>
        )}

        {/* ONGLET ADMIN */}
        {activeTab === 'admin' && isAdmin && adminInfo && (
          <div>
            {/* Statut du compte */}
            {!adminInfo.user.isActive && (
              <div style={{
                padding: '12px 16px',
                background: 'var(--red-light)',
                border: '1px solid rgba(122,42,42,0.3)',
                borderRadius: '8px',
                marginBottom: '16px',
                fontFamily: 'DM Mono, monospace',
                fontSize: '11px',
                color: 'var(--red-soft)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                ⚠ Ce compte est désactivé
              </div>
            )}
            {adminInfo.user.forcePasswordReset && (
              <div style={{
                padding: '12px 16px',
                background: 'var(--amber-light)',
                border: '1px solid rgba(122,90,26,0.3)',
                borderRadius: '8px',
                marginBottom: '16px',
                fontFamily: 'DM Mono, monospace',
                fontSize: '11px',
                color: 'var(--amber-pending)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                ⚠ Réinitialisation du mot de passe en attente
              </div>
            )}

            {/* Informations confidentielles */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--ink-muted)', marginBottom: '16px' }}>
                Informations confidentielles
              </div>
              {[
                { label: 'Email', value: adminInfo.user.email },
                { label: 'ID', value: adminInfo.user.id },
                { label: 'Inscrit le', value: new Date(adminInfo.user.createdAt).toLocaleDateString('fr-FR') },
                { label: 'Dernière co.', value: adminInfo.user.lastLoginAt ? new Date(adminInfo.user.lastLoginAt).toLocaleDateString('fr-FR') + ' ' + new Date(adminInfo.user.lastLoginAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'Jamais' },
                { label: 'Statut', value: adminInfo.user.isActive ? 'Actif' : 'Désactivé' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', gap: '12px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--ink-muted)', width: '100px', flexShrink: 0 }}>{item.label}</span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--ink)' }}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* Actions admin */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--ink-muted)', marginBottom: '20px' }}>
                Actions
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '24px', flexWrap: 'wrap' }}>
                {/* Rôle */}
                <div>
                  <label style={{ display: 'block', fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--ink-muted)', marginBottom: '8px', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Rôle</label>
                  <select
                    defaultValue={adminInfo.user.role}
                    onChange={async e => {
                      try {
                        await api.patch(`/api/admin/users/${adminInfo.user.id}/role`, { role: e.target.value })
                        setProfile(prev => prev ? { ...prev, role: e.target.value } : prev)
                      } catch (error) { console.error(error) }
                    }}
                    style={{ padding: '8px 12px', border: `1px solid ${getRoleBorder(adminInfo.user.role)}`, borderRadius: '6px', background: getRoleBackground(adminInfo.user.role), fontFamily: 'DM Mono, monospace', fontSize: '10px', color: getRoleColor(adminInfo.user.role), cursor: 'pointer', outline: 'none' }}
                  >
                    {['VISITOR', 'NOVICE', 'INTERMEDIATE', 'EXPERT', 'ADMIN'].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                {/* Séparateur */}
                <div style={{ width: '1px', height: '40px', background: 'var(--border)' }} />

                {/* Désactiver / Réactiver */}
                <div>
                  <label style={{ display: 'block', fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--ink-muted)', marginBottom: '8px', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Accès</label>
                  {adminInfo.user.isActive ? (
                    <button
                      onClick={() => setConfirmModal({
                        message: `Désactiver le compte de ${adminInfo.user.username} ? Il sera déconnecté immédiatement.`,
                        onConfirm: async () => {
                          try {
                            await api.patch(`/api/admin/users/${adminInfo.user.id}/deactivate`)
                            setConfirmModal(null)
                            setAdminInfo(prev => prev ? { ...prev, user: { ...prev.user, isActive: false } } : prev)
                          } catch (error) { console.error(error) }
                        }
                      })}
                      style={{ padding: '8px 16px', background: 'var(--red-light)', color: 'var(--red-soft)', border: '1px solid rgba(122,42,42,0.2)', borderRadius: '6px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: 'pointer', letterSpacing: '0.06em' }}
                    >
                      ✕ Désactiver
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmModal({
                        message: `Réactiver le compte de ${adminInfo.user.username} ?`,
                        onConfirm: async () => {
                          try {
                            await api.patch(`/api/admin/users/${adminInfo.user.id}/reactivate`)
                            setConfirmModal(null)
                            setAdminInfo(prev => prev ? { ...prev, user: { ...prev.user, isActive: true } } : prev)
                          } catch (error) { console.error(error) }
                        }
                      })}
                      style={{ padding: '8px 16px', background: 'var(--green-light)', color: 'var(--green-valid)', border: '1px solid rgba(45,90,58,0.2)', borderRadius: '6px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: 'pointer', letterSpacing: '0.06em' }}
                    >
                      ✓ Réactiver
                    </button>
                  )}
                </div>

                {/* Séparateur */}
                <div style={{ width: '1px', height: '40px', background: 'var(--border)' }} />

                {/* Reset mdp */}
                <div>
                  <label style={{ display: 'block', fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--ink-muted)', marginBottom: '8px', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Sécurité</label>
                  <button
                    onClick={() => setConfirmModal({
                      message: `Forcer la réinitialisation du mot de passe de ${adminInfo.user.username} ?`,
                      onConfirm: async () => {
                        try {
                          await api.patch(`/api/admin/users/${adminInfo.user.id}/force-reset`)
                          setConfirmModal(null)
                          setAdminInfo(prev => prev ? { ...prev, user: { ...prev.user, forcePasswordReset: true } } : prev)
                        } catch (error) { console.error(error) }
                      }
                    })}
                    disabled={adminInfo.user.forcePasswordReset}
                    style={{ padding: '8px 16px', background: adminInfo.user.forcePasswordReset ? 'var(--parchment-deep)' : 'var(--amber-light)', color: adminInfo.user.forcePasswordReset ? 'var(--ink-faint)' : 'var(--amber-pending)', border: `1px solid ${adminInfo.user.forcePasswordReset ? 'var(--border)' : 'rgba(122,90,26,0.2)'}`, borderRadius: '6px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: adminInfo.user.forcePasswordReset ? 'not-allowed' : 'pointer', letterSpacing: '0.06em' }}
                  >
                    🔑 {adminInfo.user.forcePasswordReset ? 'Reset en attente' : 'Reset mdp'}
                  </button>
                </div>
              </div>
            </div>
            {/* Logs */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--ink-muted)' }}>
                  Historique d&apos;activité
                </div>
                <button
                  onClick={async () => {
                    try {
                      const adminRes = await api.get(`/api/users/${username}/admin`)
                      setAdminInfo(adminRes.data)
                    } catch (e) { console.error(e) }
                  }}
                  style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'transparent', fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--ink-muted)', cursor: 'pointer' }}
                >
                  ↻ Rafraîchir
                </button>
              </div>
              {adminInfo.logs.length === 0 ? (
                <div style={{ fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-faint)', fontStyle: 'italic' }}>Aucun log.</div>
              ) : (
                <div>
                  {(() => {
                    const grouped = adminInfo.logs.reduce((acc, log) => {
                      const cat = log.action === 'PASSWORD_CHANGE' && log.metadata?.forced === 'true'
                        ? 'ROLE_CHANGE'
                        : ['PASSWORD_CHANGE', 'EMAIL_CHANGE', 'USERNAME_CHANGE'].includes(log.action)
                        ? 'PROFILE_CHANGE'
                        : ['TRANSLATION_ADDED', 'TRANSLATION_VALIDATED', 'TRANSLATION_DELETED', 'PROPOSAL_ADDED', 'PROPOSAL_ACCEPTED', 'PROPOSAL_REJECTED', 'PROPOSAL_DELETED', 'COMMENT_ADDED', 'COMMENT_DELETED'].includes(log.action)
                        ? 'CONTRIBUTIONS'
                        : log.action
                      if (!acc[cat]) acc[cat] = []
                      acc[cat].push(log)
                      return acc
                    }, {} as Record<string, typeof adminInfo.logs>)

                    const catLabels: Record<string, { label: string; bg: string; color: string }> = {
                      LOGIN: { label: 'Connexions', bg: 'var(--green-light)', color: 'var(--green-valid)' },
                      LOGOUT: { label: 'Déconnexions', bg: 'var(--parchment-deep)', color: 'var(--ink-muted)' },
                      PROFILE_CHANGE: { label: 'Modifications du profil', bg: 'var(--amber-light)', color: 'var(--amber-pending)' },
                      REGISTER: { label: 'Inscription', bg: 'var(--blue-light)', color: 'var(--blue-sacred)' },
                      ROLE_CHANGE: { label: 'Actions administratives', bg: 'var(--red-light)', color: 'var(--red-soft)' },
                      ACCOUNT_SUSPENDED: { label: 'Activations / Désactivations', bg: 'var(--red-light)', color: 'var(--red-soft)' },
                      CONTRIBUTIONS: { label: 'Contributions', bg: 'var(--blue-light)', color: 'var(--blue-sacred)' },
                    }

                    const actionLabels: Record<string, string> = {
                      PASSWORD_CHANGE: 'Mot de passe modifié',
                      EMAIL_CHANGE: 'Email modifié',
                      USERNAME_CHANGE: 'Pseudo modifié',
                      LOGIN: 'Connexion',
                      LOGOUT: 'Déconnexion',
                      REGISTER: 'Inscription',
                      ROLE_CHANGE: 'Action admin',
                      ACCOUNT_SUSPENDED: 'Compte désactivé',
                      TRANSLATION_ADDED: 'Trad. mot ajoutée',
                      TRANSLATION_VALIDATED: 'Trad. mot validée',
                      TRANSLATION_DELETED: 'Trad. mot supprimée',
                      PROPOSAL_ADDED: 'Ref. verset ajoutée',
                      PROPOSAL_ACCEPTED: 'Ref. verset acceptée',
                      PROPOSAL_REJECTED: 'Ref. verset rejetée',
                      PROPOSAL_DELETED: 'Ref. verset supprimée',
                      COMMENT_ADDED: 'Commentaire ajouté',
                      COMMENT_DELETED: 'Commentaire supprimé',
                    }

                    return Object.entries(grouped).map(([cat, logs]) => {
                      const style = catLabels[cat] || { label: cat, bg: 'var(--parchment-deep)', color: 'var(--ink-muted)' }
                      return (
                        <div key={cat} style={{ marginBottom: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', padding: '2px 10px', borderRadius: '20px', background: style.bg, color: style.color }}>
                              {style.label}
                            </span>
                            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--ink-faint)' }}>
                              {logs.length} événement{logs.length > 1 ? 's' : ''}
                            </span>
                          </div>
                          {(expandedLogCats.has(cat) ? logs : logs.slice(0, 5)).map(log => (
                            <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '6px 10px', borderRadius: '6px', background: 'var(--parchment)', marginBottom: '4px' }}>
                              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: style.color, flexShrink: 0 }}>
                                {log.action === 'PASSWORD_CHANGE' && log.metadata?.forced === 'true'
                                  ? 'Reset mdp forcé par admin'
                                  : log.action === 'ACCOUNT_SUSPENDED' && log.metadata?.action === 'REACTIVATED'
                                  ? 'Compte réactivé'
                                  : log.action === 'ROLE_CHANGE' && log.metadata?.action === 'KICK'
                                  ? 'Kick (déconnexion forcée)'
                                  : actionLabels[log.action] || log.action}
                              </span>
                              {log.metadata && Object.keys(log.metadata).filter(k => !['forced', 'by'].includes(k)).length > 0 && (
                                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--ink-soft)', flex: 1 }}>
                                  {Object.entries(log.metadata).filter(([k]) => !['forced', 'by'].includes(k)).map(([k, v]) => `${k} : ${v}`).join(' · ')}
                                </span>
                              )}
                              {log.ip && log.ip !== '::1' && (
                                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--ink-faint)', flexShrink: 0 }}>
                                  {log.ip}
                                </span>
                              )}
                              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--ink-faint)', flexShrink: 0 }}>
                                {new Date(log.createdAt).toLocaleDateString('fr-FR')} {new Date(log.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ))}
                          {logs.length > 5 && (
                            <div
                              onClick={() => setExpandedLogCats(prev => {
                                const s = new Set(prev)
                                if (s.has(cat)) s.delete(cat)
                                else s.add(cat)
                                return s
                              })}
                              style={{
                                fontFamily: 'DM Mono, monospace',
                                fontSize: '9px',
                                color: 'var(--gold)',
                                padding: '4px 10px',
                                cursor: 'pointer',
                                userSelect: 'none' as const,
                              }}
                            >
                              {expandedLogCats.has(cat) ? '▼ Réduire' : `▶ Voir ${logs.length - 5} de plus`}
                            </div>
                          )}
                        </div>
                      )
                    })
                  })()}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {confirmModal && (
        <ConfirmModal
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  )
}