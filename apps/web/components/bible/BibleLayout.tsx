'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import TopBar from './TopBar'
import Sidebar from './Sidebar'
import VerseList from './VerseList'
import RightPanel from './RightPanel'
import WordPopover from './WordPopover'
import { useBreakpoint } from '@/lib/useBreakpoint'
import Drawer from './Drawer'
import SearchBar from './SearchBar'


interface WordToken {
  id: string
  position: number
  word: string
  lemma: string
  translit: string | null
  strongNumber: string | null
  morphology: string | null
}

interface VerseText {
  id: string
  language: string
  text: string
  wordTokens: WordToken[]
}

interface Translation {
  id: string
  textFr: string
  isActive: boolean
}

interface Verse {
  id: string
  number: number
  reference: string
  texts: VerseText[]
  translations: Translation[]
}

interface Chapter {
  id: string
  number: number
  verses: Verse[]
}

interface Book {
  id: string
  name: string
  slug: string
  testament: string
  chapterCount: number
  chapters: { id: string; number: number }[]
}

interface BibleLayoutProps {
  testament: 'AT' | 'NT'
}

interface VerseTranslation {
  id: string
  textFr: string
  isActive: boolean
  isReference: boolean
  source: string | null
  createdAt: string
}

interface Proposal {
  id: string
  proposedText: string
  status: string
  reason: string | null
  createdAt: string
  createdBy: string | null
  creator: { username: string; role: string } | null
  reviewer: { username: string; role: string } | null
  votes: { id: string; userId: string }[]
}

interface Comment {
  id: string
  text: string
  createdAt: string
  createdBy: string | null
  creator: { username: string; role: string } | null
  replies: {
    id: string
    text: string
    createdAt: string
    createdBy: string | null
    creator: { username: string; role: string } | null
  }[]
}

interface WordTranslation {
  id: string
  translation: string
  voteCount: number
  isValidated: boolean
  createdBy: string | null
  creator: { username: string; role: string } | null
}

export default function BibleLayout({ testament }: BibleLayoutProps) {
  const params = useParams()
  const book = params.book as string
  const chapter = params.chapter as string
  const searchParams = useSearchParams()
  const router = useRouter()

  const [bookData, setBookData] = useState<Book | null>(null)
  const [chapterData, setChapterData] = useState<Chapter | null>(null)
  const [allBooks, setAllBooks] = useState<Book[]>([])
  const [activeVerse, setActiveVerse] = useState<Verse | null>(null)
  const [activeWord, setActiveWord] = useState<WordToken | null>(null)
  const [activeTab, setActiveTab] = useState<'verse' | 'word' | 'comments'>('verse')
  const [loading, setLoading] = useState(true)
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [wordTranslations, setWordTranslations] = useState<WordTranslation[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [verseTranslations, setVerseTranslations] = useState<VerseTranslation[]>([])

  const bp = useBreakpoint()
  const isDesktop = bp === 'desktop'
  const isMobile = bp === 'mobile'
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => {
    loadData()
  }, [book, chapter])

  const storageKey = `scroll_pos_${book}_${chapter}`

  useEffect(() => {
    if (loading || !chapterData) return
    const hash = window.location.hash
    if (hash.startsWith('#v')) {
      const verseNumber = Number(hash.slice(2))
      setTimeout(() => {
        const el = document.getElementById(`v${verseNumber}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
      // Si pas de verse ou word dans l'URL, ouvrir le verset par son numéro
      if (!searchParams.get('verse') && !searchParams.get('word')) {
        const verse = chapterData.verses.find((v: Verse) => v.number === verseNumber)
        if (verse) {
          setActiveVerse(verse)
          setActiveTab('verse')
          Promise.all([
            api.get(`/api/verses/${verse.id}/comments`),
            api.get(`/api/verses/${verse.id}/proposals`),
          ]).then(([commentsRes, proposalsRes]) => {
            setComments(commentsRes.data)
            setProposals(proposalsRes.data.proposals)
            setVerseTranslations(proposalsRes.data.translations)
          }).catch(console.error)
        }
      }
    } else if (!searchParams.get('verse') && !searchParams.get('word')) {
      // Restaurer la position de lecture sauvegardée
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const verseNum = Number(saved)
        setTimeout(() => {
          const el = document.getElementById(`v${verseNum}`)
          if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' })
        }, 100)
      }
    }
  }, [loading, chapterData])

  useEffect(() => {
    if (!chapterData) return

    const wordId = searchParams.get('word')
    const verseId = searchParams.get('verse')
    const tab = searchParams.get('tab') as 'verse' | 'word' | 'comments' | null

    if (wordId) {
      // Trouver le token dans les données chargées
      for (const verse of chapterData.verses) {
        for (const text of verse.texts) {
          const token = text.wordTokens?.find((w: WordToken) => w.id === wordId)
          if (token) {
            setActiveWord(token)
            setActiveTab('word')
            setPopoverPos(null)
            setTimeout(() => {
              const el = document.getElementById(`v${verse.number}`)
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }, 100)
            // Charger les traductions
            api.get(`/api/words/${wordId}/translations`).then(res => {
              setWordTranslations(res.data)
            }).catch(console.error)
            return
          }
        }
      }
    }

    if (verseId && tab) {
      const verse = chapterData.verses.find((v: Verse) => v.id === verseId)
      if (verse) {
        setActiveVerse(verse)
        setActiveTab(tab)
        setTimeout(() => {
          const el = document.getElementById(`v${verse.number}`)
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
        Promise.all([
          api.get(`/api/verses/${verse.id}/comments`),
          api.get(`/api/verses/${verse.id}/proposals`),
        ]).then(([commentsRes, proposalsRes]) => {
          setComments(commentsRes.data)
          setProposals(proposalsRes.data.proposals)
          setVerseTranslations(proposalsRes.data.translations)
        }).catch(console.error)
      }
    }
  }, [chapterData])

  async function loadData() {
    setLoading(true)
    try {
      const [booksRes, bookRes, chapterRes] = await Promise.all([
        api.get('/api/books'),
        api.get(`/api/books/${book}`),
        api.get(`/api/books/${book}/chapters/${chapter}`),
      ])
      setAllBooks(booksRes.data)
      setBookData(bookRes.data)
      setChapterData(chapterRes.data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // Ouvrir un verset (clic ou clavier)
  async function openVerse(verse: Verse) {
    setActiveVerse(verse)
    setActiveTab('verse')
    if (!isDesktop) setPanelOpen(true)
    window.history.replaceState(null, '', `?verse=${verse.id}&tab=verse#v${verse.number}`)
    setTimeout(() => {
      const el = document.getElementById(`v${verse.number}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
    try {
      const [commentsRes, proposalsRes] = await Promise.all([
        api.get(`/api/verses/${verse.id}/comments`),
        api.get(`/api/verses/${verse.id}/proposals`),
      ])
      setComments(commentsRes.data)
      setProposals(proposalsRes.data.proposals)
      setVerseTranslations(proposalsRes.data.translations)
    } catch {
      setComments([])
      setProposals([])
    }
  }

  // Navigation clavier
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      const chapterNum = Number(chapter)
      const testamentBooks = allBooks.filter(b => b.testament === bookData?.testament)
      const currentBookIdx = testamentBooks.findIndex(b => b.slug === book)
      const base = testament.toLowerCase()

      switch (e.key) {
        case 'Escape':
          setActiveVerse(null)
          setActiveWord(null)
          setPopoverPos(null)
          setPanelOpen(false)
          break

        case 'ArrowLeft':
          e.preventDefault()
          if (chapterNum > 1) {
            router.push(`/${base}/${book}/${chapterNum - 1}`)
          } else if (currentBookIdx > 0) {
            const prevBook = testamentBooks[currentBookIdx - 1]
            router.push(`/${base}/${prevBook.slug}/${prevBook.chapterCount}`)
          }
          break

        case 'ArrowRight':
          e.preventDefault()
          if (bookData && chapterNum < bookData.chapterCount) {
            router.push(`/${base}/${book}/${chapterNum + 1}`)
          } else if (currentBookIdx >= 0 && currentBookIdx < testamentBooks.length - 1) {
            const nextBook = testamentBooks[currentBookIdx + 1]
            router.push(`/${base}/${nextBook.slug}/1`)
          }
          break

        case 'ArrowUp':
          e.preventDefault()
          if (!chapterData) break
          if (!activeVerse) {
            openVerse(chapterData.verses[chapterData.verses.length - 1])
          } else {
            const idx = chapterData.verses.findIndex(v => v.id === activeVerse.id)
            if (idx > 0) openVerse(chapterData.verses[idx - 1])
          }
          break

        case 'ArrowDown':
          e.preventDefault()
          if (!chapterData) break
          if (!activeVerse) {
            openVerse(chapterData.verses[0])
          } else {
            const idx = chapterData.verses.findIndex(v => v.id === activeVerse.id)
            if (idx < chapterData.verses.length - 1) openVerse(chapterData.verses[idx + 1])
          }
          break
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [book, chapter, testament, allBooks, bookData, chapterData, activeVerse, isDesktop])

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
      fontSize: '18px',
    }}>
      Chargement...
    </div>
  )

  // Props communes au RightPanel (desktop et drawer)
  const rightPanelProps = {
    activeTab,
    bookName: bookData?.name,
    chapterNumber: chapterData?.number,
    setActiveTab: (tab: 'verse' | 'word' | 'comments') => {
      setActiveTab(tab)
      if (activeVerse) {
        window.history.replaceState(null, '', `?verse=${activeVerse.id}&tab=${tab}#v${activeVerse.number}`)
      } else if (activeWord) {
        window.history.replaceState(null, '', `?word=${activeWord.id}&tab=${tab}`)
      }
    },
    activeVerse,
    activeWord,
    wordTranslations,
    comments,
    proposals,
    verseTranslations,
    onCommentAdded: async () => {
      if (activeVerse) {
        const res = await api.get(`/api/verses/${activeVerse.id}/comments`)
        setComments(res.data)
      }
    },
    onProposalUpdated: async () => {
      if (activeVerse) {
        const [commentsRes, proposalsRes, chapterRes] = await Promise.all([
          api.get(`/api/verses/${activeVerse.id}/comments`),
          api.get(`/api/verses/${activeVerse.id}/proposals`),
          api.get(`/api/books/${book}/chapters/${chapter}`),
        ])
        setComments(commentsRes.data)
        setProposals(proposalsRes.data.proposals)
        setVerseTranslations(proposalsRes.data.translations)
        setChapterData(chapterRes.data)
        const updatedVerse = chapterRes.data.verses.find((v: { id: string }) => v.id === activeVerse.id)
        if (updatedVerse) setActiveVerse(updatedVerse)
      }
    },
    onTranslationAdded: async () => {
      if (activeWord) {
        const res = await api.get(`/api/words/${activeWord.id}/translations`)
        setWordTranslations(res.data)
      }
    },
  }

  return (
    <div
      onClick={() => setPopoverPos(null)}
      style={{
        display: 'grid',
        gridTemplateColumns: isDesktop
          ? (fullscreen ? '0px 1fr' : '220px 1fr')
          : '1fr',
        gridTemplateRows: '52px 1fr',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <TopBar
        testament={testament}
        book={book}
        chapter={chapter}
        onMenuClick={!isDesktop ? () => setSidebarOpen(true) : undefined}
      />

      {/* Sidebar — dans la grille sur desktop, dans un drawer sinon */}
      {isDesktop ? (
        <Sidebar
          testament={testament}
          currentBook={book}
          currentChapter={chapter}
          bookData={bookData}
          allBooks={allBooks}
        />
      ) : (
        <Drawer open={sidebarOpen} onClose={() => setSidebarOpen(false)} side="left" width="260px">
          {/* Barre de recherche dans le drawer mobile/tablette */}
          <div style={{
            background: 'var(--ink)',
            padding: '10px 12px',
            flexShrink: 0,
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}>
            <SearchBar />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <Sidebar
              testament={testament}
              currentBook={book}
              currentChapter={chapter}
              bookData={bookData}
              allBooks={allBooks}
            />
          </div>
        </Drawer>
      )}

      <div style={{
        display: isDesktop ? 'grid' : 'block',
        gridTemplateColumns: isDesktop ? (fullscreen ? '1fr 0px' : '1fr 360px') : undefined,
        overflow: 'hidden',
        position: 'relative',
        height: !isDesktop ? '100%' : undefined,
      }}>
        {chapterData && bookData && (
          <VerseList
            verses={chapterData.verses}
            bookName={bookData.name}
            chapter={chapter}
            activeVerseId={activeVerse?.id || null}
            activeWordId={activeWord?.id || null}
            storageKey={storageKey}
            onVerseClick={openVerse}
            onWordClick={async (token, x, y) => {
              setActiveWord(token)
              window.history.replaceState(null, '', `?word=${token.id}&tab=word`)
              if (isDesktop) {
                setPopoverPos({ x, y })
              } else {
                setPopoverPos(null)
                setActiveTab('word')
                setPanelOpen(true)
              }
              try {
                const res = await api.get(`/api/words/${token.id}/translations`)
                setWordTranslations(res.data)
              } catch (error) {
                console.error(error)
                setWordTranslations([])
              }
            }}
          />
        )}

        {/* Boutons navigation chapitre + plein écran */}
        {bookData && (() => {
          const chapterNum = Number(chapter)
          const canGoPrev = chapterNum > 1
          const canGoNext = chapterNum < bookData.chapterCount
          const base = testament.toLowerCase()
          // Décalage horizontal selon desktop/fullscreen
          const offset = isDesktop ? (fullscreen ? 24 : 384) : 24
          const btnStyle = (right: number, disabled?: boolean): React.CSSProperties => ({
            position: 'fixed',
            bottom: '24px',
            right: `${right}px`,
            zIndex: 100,
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            background: 'var(--parchment-dark)',
            cursor: disabled ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ink-muted)',
            boxShadow: '0 2px 8px rgba(26,22,18,0.12)',
            transition: 'right 0.3s ease',
            opacity: disabled ? 0.3 : 1,
          })
          return (
            <>
              {/* Précédent */}
              <button
                onClick={() => canGoPrev && router.push(`/${base}/${book}/${chapterNum - 1}`)}
                title="Chapitre précédent"
                style={btnStyle(offset + 80, !canGoPrev)}
                onMouseEnter={e => { if (canGoPrev) (e.currentTarget as HTMLElement).style.background = 'var(--gold-pale)' }}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--parchment-dark)'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>

              {/* Suivant */}
              <button
                onClick={() => canGoNext && router.push(`/${base}/${book}/${chapterNum + 1}`)}
                title="Chapitre suivant"
                style={btnStyle(offset + 40, !canGoNext)}
                onMouseEnter={e => { if (canGoNext) (e.currentTarget as HTMLElement).style.background = 'var(--gold-pale)' }}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--parchment-dark)'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>

              {/* Plein écran — desktop uniquement */}
              {isDesktop && (
                <button
                  onClick={() => setFullscreen(f => !f)}
                  title={fullscreen ? 'Quitter le mode lecture' : 'Mode lecture'}
                  style={btnStyle(offset)}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--gold-pale)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--parchment-dark)'}
                >
                  {fullscreen ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="4 14 10 14 10 20"/>
                      <polyline points="20 10 14 10 14 4"/>
                      <line x1="10" y1="14" x2="3" y2="21"/>
                      <line x1="21" y1="3" x2="14" y2="10"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="15 3 21 3 21 9"/>
                      <polyline points="9 21 3 21 3 15"/>
                      <line x1="21" y1="3" x2="14" y2="10"/>
                      <line x1="3" y1="21" x2="10" y2="14"/>
                    </svg>
                  )}
                </button>
              )}
            </>
          )
        })()}

        {/* RightPanel — dans la grille sur desktop, dans un drawer sinon */}
        {isDesktop ? (
          <RightPanel {...rightPanelProps} />
        ) : (
          <Drawer
            open={panelOpen}
            onClose={() => setPanelOpen(false)}
            side={isMobile ? 'bottom' : 'right'}
            width="380px"
            height="80vh"
          >
            <RightPanel {...rightPanelProps} />
          </Drawer>
        )}
      </div>

      {isDesktop && activeWord && popoverPos && (
        <WordPopover
          word={activeWord}
          position={popoverPos}
          onClose={() => setPopoverPos(null)}
          onOpenPanel={() => setActiveTab('word')}
          translations={wordTranslations}
        />
      )}
    </div>
  )
}