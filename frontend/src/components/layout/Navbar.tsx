'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ScanSearch, Layers, Users, Settings2, FlaskConical, Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';

const LINKS = [
  { href: '/', label: 'Scan', icon: ScanSearch },
  { href: '/bulk', label: 'Bulk', icon: Users },
  { href: '/assignments', label: 'Assignments', icon: Layers },
  { href: '/evaluation', label: 'Evaluation', icon: FlaskConical },
  { href: '/settings', label: 'Settings', icon: Settings2 },
];

export default function Navbar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: 'var(--text-primary)',
              }}
            >
              Astra
            </span>
            <span
              style={{
                fontSize: '0.67rem',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.02em',
                marginTop: '1px',
              }}
            >
              forensic console
            </span>
          </div>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.8rem',
                fontWeight: isActive(href) ? 600 : 500,
                color: isActive(href) ? 'var(--text-primary)' : 'var(--text-muted)',
                textDecoration: 'none',
                padding: '0.4rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                background: isActive(href) ? 'var(--bg-elevated)' : 'transparent',
                border: `1px solid ${isActive(href) ? 'var(--border-default)' : 'transparent'}`,
              }}
            >
              <Icon size={13} />
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <button
          className="btn btn-ghost"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          style={{ padding: '0.35rem 0.5rem' }}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          <span style={{ fontSize: '0.75rem' }}>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
        <span className="status-dot status-dot-green pulse" />
        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>live</span>
      </div>
    </header>
  );
}
