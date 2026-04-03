'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import api from '@/lib/api'
import TopBar from './TopBar'
import Sidebar from './Sidebar'
import VerseList from './VerseList'
import RightPanel from './RightPanel'
import WordPopover from './WordPopover'


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

  const [bookData, setBookData] = useState<Book | null>(null)
  const [chapterData, setChapterData] = useState<Chapter | null>(null)
  const [allBooks, setAllBooks] = useState<Book[]>([])
  const [activeVerse, setActiveVerse] = useState<Verse | null>(null)
  const [activeWord, setActiveWord] = useState<WordToken | null>(null)
  const [activeTab, setActiveTab] = useState<'verse' | 'word' | 'comments'>('verse')
  const [loading, setLoading] = useState(true)
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null)
  const [wordTranslations, setWordTranslations] = useState<WordTranslation[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [verseTranslations, setVerseTranslations] = useState<VerseTranslation[]>([])

  useEffect(() => {
    loadData()
  }, [book, chapter])

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

  return (
    <div
      onClick={() => setPopoverPos(null)}
      style={{
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        gridTemplateRows: '52px 1fr',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <TopBar testament={testament} book={book} chapter={chapter} />

      <Sidebar
        testament={testament}
        currentBook={book}
        currentChapter={chapter}
        bookData={bookData}
        allBooks={allBooks}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', overflow: 'hidden' }}>
        {chapterData && bookData && (
          <VerseList
            verses={chapterData.verses}
            bookName={bookData.name}
            chapter={chapter}
            activeVerseId={activeVerse?.id || null}
            activeWordId={activeWord?.id || null}
            onVerseClick={async (verse) => {
              setActiveVerse(verse)
              setActiveTab('verse')
              try {
                const [commentsRes, proposalsRes] = await Promise.all([
                  api.get(`/api/verses/${verse.id}/comments`),
                  api.get(`/api/verses/${verse.id}/proposals`),
                ])
                setComments(commentsRes.data)
                setProposals(proposalsRes.data.proposals)
                setVerseTranslations(proposalsRes.data.translations)
              } catch (error) {
                console.error(error)
                setComments([])
                setProposals([])
              }
            }}
            onWordClick={async (token, x, y) => {
              setActiveWord(token)
              setPopoverPos({ x, y })
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

        <RightPanel
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeVerse={activeVerse}
          activeWord={activeWord}
          wordTranslations={wordTranslations}
          comments={comments}
          proposals={proposals}
          verseTranslations={verseTranslations}
          onCommentAdded={async () => {
            if (activeVerse) {
              const res = await api.get(`/api/verses/${activeVerse.id}/comments`)
              setComments(res.data)
            }
          }}
          onProposalUpdated={async () => {
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
              // Mettre à jour activeVerse avec les nouvelles traductions
              const updatedVerse = chapterRes.data.verses.find((v: { id: string }) => v.id === activeVerse.id)
              if (updatedVerse) setActiveVerse(updatedVerse)
            }
          }}
          onTranslationAdded={async () => {
            if (activeWord) {
              const res = await api.get(`/api/words/${activeWord.id}/translations`)
              setWordTranslations(res.data)
            }
          }}
        />
      </div>

      {activeWord && popoverPos && (
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