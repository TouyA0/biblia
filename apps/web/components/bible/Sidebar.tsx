'use client'

interface Book {
  id: string
  name: string
  slug: string
  testament: string
  chapterCount: number
  chapters?: { id: string; number: number }[]
}

interface SidebarProps {
  testament: 'AT' | 'NT'
  currentBook: string
  currentChapter: string
  bookData: Book | null
  allBooks: Book[]
}

export default function Sidebar({ testament, currentBook, currentChapter, bookData, allBooks }: SidebarProps) {
  const books = allBooks.filter(b => b.testament === testament)
  const prefix = testament === 'AT' ? '/at' : '/nt'

  const AT_CATEGORIES = [
    { label: 'Pentateuque', slugs: ['genese', 'exode', 'levitique', 'nombres', 'deuteronome'] },
    { label: 'Historiques', slugs: ['josue', 'juges', 'ruth', '1-samuel', '2-samuel', '1-rois', '2-rois', '1-chroniques', '2-chroniques', 'esdras', 'nehemie', 'tobie', 'judith', 'esther', '1-maccabees', '2-maccabees'] },
    { label: 'Poétiques', slugs: ['job', 'psaumes', 'proverbes', 'ecclesiaste', 'cantique', 'sagesse', 'siracide'] },
    { label: 'Prophétiques', slugs: ['isai', 'jeremie', 'lamentations', 'baruch', 'ezechiel', 'daniel', 'osee', 'joel', 'amos', 'abdias', 'jonas', 'michee', 'nahoum', 'habacuc', 'sophonie', 'aggee', 'zacharie', 'malachie'] },
  ]

  const NT_CATEGORIES = [
    { label: 'Évangiles', slugs: ['matthieu', 'marc', 'luc', 'jean'] },
    { label: 'Actes', slugs: ['actes'] },
    { label: 'Épîtres', slugs: ['romains', '1-corinthiens', '2-corinthiens', 'galates', 'ephesiens', 'philippiens', 'colossiens', '1-thessaloniciens', '2-thessaloniciens', '1-timothee', '2-timothee', 'tite', 'philemon', 'hebreux', 'jacques', '1-pierre', '2-pierre', '1-jean', '2-jean', '3-jean', 'jude'] },
    { label: 'Apocalypse', slugs: ['apocalypse'] },
  ]

  const categories = testament === 'AT' ? AT_CATEGORIES : NT_CATEGORIES

  return (
    <div style={{
      background: 'var(--parchment-dark)',
      borderRight: '1px solid var(--border)',
      overflowY: 'auto',
      padding: '20px 0',
    }}>
      {bookData && (
        <>
          <div style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: '11px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            color: 'var(--ink-muted)',
            padding: '16px 16px 8px',
          }}>
            Chapitres
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '4px',
            padding: '6px 16px 14px',
          }}>
            {(bookData.chapters || []).map(ch => (
              <a key={ch.number} href={`${prefix}/${currentBook}/${ch.number}`}
                className={`ch-num ${ch.number === parseInt(currentChapter) ? 'active' : ''}`}>
                {ch.number}
              </a>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', marginTop: '4px', paddingTop: '4px' }}>
            {categories.map(cat => {
              const catBooks = books.filter(b => cat.slugs.some(s => b.slug.startsWith(s)))
              if (catBooks.length === 0) return null
              return (
                <div key={cat.label}>
                  <div style={{
                    fontFamily: 'DM Mono, monospace',
                    fontSize: '11px',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase' as const,
                    color: 'var(--ink-faint)',
                    padding: '16px 16px 4px',
                  }}>
                    {cat.label}
                  </div>
                  {catBooks.map(b => (
                    <a key={b.slug} href={`${prefix}/${b.slug}/1`}
                      className={`book-link ${b.slug === currentBook ? 'active' : ''}`}>
                      <span>{b.name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--ink-faint)' }}>
                        {b.chapterCount}
                      </span>
                    </a>
                  ))}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}