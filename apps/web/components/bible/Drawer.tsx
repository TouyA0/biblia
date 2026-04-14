'use client'

import { useEffect } from 'react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  side: 'left' | 'right' | 'bottom'
  width?: string
  height?: string
  children: React.ReactNode
}

export default function Drawer({ open, onClose, side, width = '280px', height = '75vh', children }: DrawerProps) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const getTransform = () => {
    if (open) return 'translate(0, 0)'
    if (side === 'left') return 'translateX(-100%)'
    if (side === 'right') return 'translateX(100%)'
    return 'translateY(100%)'
  }

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 300,
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    transform: getTransform(),
    display: 'flex',
    flexDirection: 'column',
    ...(side === 'bottom' ? {
      bottom: 0,
      left: 0,
      right: 0,
      height,
      background: 'var(--parchment)',
      borderTop: '1px solid var(--border)',
      borderRadius: '16px 16px 0 0',
    } : side === 'right' ? {
      top: 0,
      right: 0,
      bottom: 0,
      width,
      background: 'var(--parchment)',
      borderLeft: '1px solid var(--border)',
      overflow: 'hidden',
    } : {
      top: 0,
      left: 0,
      bottom: 0,
      width,
      background: 'var(--parchment-dark)',
      borderRight: '1px solid var(--border)',
      overflowY: 'auto',
    }),
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 299,
          background: 'rgba(26, 22, 18, 0.5)',
          backdropFilter: 'blur(2px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />

      <div style={panelStyle}>
        {/* Handle bar pour le bottom sheet */}
        {side === 'bottom' && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '12px 0 4px',
            flexShrink: 0,
          }}>
            <div style={{
              width: '36px',
              height: '4px',
              background: 'var(--border-strong)',
              borderRadius: '2px',
            }} />
          </div>
        )}

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </div>
    </>
  )
}
