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
            fontSize: '9px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            color: 'var(--ink-muted)',
            padding: '0 16px 8px',
          }}>
            {bookData.name}
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '4px',
            padding: '6px 16px 14px',
          }}>
            {(bookData.chapters || []).map(ch => (
              <a key={ch.number} href={`${prefix}/${currentBook}/${ch.number}`} style={{
                textAlign: 'center' as const,
                padding: '5px 2px',
                fontFamily: 'DM Mono, monospace',
                fontSize: '11px',
                color: ch.number === parseInt(currentChapter) ? 'white' : 'var(--ink-soft)',
                borderRadius: '4px',
                background: ch.number === parseInt(currentChapter) ? 'var(--gold)' : 'transparent',
                textDecoration: 'none',
              }}>
                {ch.number}
              </a>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', marginTop: '8px', paddingTop: '8px' }}>
            <div style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '9px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase' as const,
              color: 'var(--ink-muted)',
              padding: '0 16px 8px',
            }}>
              Livres
            </div>
            {books.map(b => (
              <a key={b.slug} href={`${prefix}/${b.slug}/1`} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 16px',
                fontFamily: 'Spectral, serif',
                fontSize: '13.5px',
                color: b.slug === currentBook ? 'var(--ink)' : 'var(--ink-soft)',
                background: b.slug === currentBook ? 'var(--gold-pale)' : 'transparent',
                borderLeft: b.slug === currentBook ? '2px solid var(--gold)' : '2px solid transparent',
                textDecoration: 'none',
              }}>
                <span style={{ fontWeight: b.slug === currentBook ? 600 : 400 }}>{b.name}</span>
                <span style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '10px',
                  color: 'var(--ink-faint)',
                }}>
                  {b.chapterCount}
                </span>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}