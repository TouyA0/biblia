export function getRoleColor(role: string): string {
  switch (role) {
    case 'ADMIN': return 'var(--red-soft)'
    case 'EXPERT': return 'var(--green-valid)'
    case 'INTERMEDIATE': return 'var(--amber-pending)'
    case 'NOVICE': return 'var(--blue-sacred)'
    default: return 'var(--ink-muted)'
  }
}

export function getRoleBackground(role: string): string {
  switch (role) {
    case 'ADMIN': return 'var(--red-light)'
    case 'EXPERT': return 'var(--green-light)'
    case 'INTERMEDIATE': return 'var(--amber-light)'
    case 'NOVICE': return 'var(--blue-light)'
    default: return 'var(--parchment-deep)'
  }
}

export function getRoleBorder(role: string): string {
  switch (role) {
    case 'ADMIN': return 'rgba(122,42,42,0.2)'
    case 'EXPERT': return 'rgba(45,90,58,0.2)'
    case 'INTERMEDIATE': return 'rgba(122,90,26,0.2)'
    case 'NOVICE': return 'rgba(42,74,122,0.2)'
    default: return 'var(--border)'
  }
}