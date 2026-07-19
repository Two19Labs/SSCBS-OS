import React from 'react';

// Consistent 1.5px-stroke icon set (Lucide-style geometry).
// `filled` renders the active-tab variant.

const base = (filled) => ({
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: filled ? 'currentColor' : 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
});

export const HomeIcon = ({ filled, size = 18 }) => (
  <svg {...base(filled)} width={size} height={size}>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
  </svg>
);

export const CalendarIcon = ({ filled, size = 18 }) => (
  <svg {...base(filled)} width={size} height={size}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <line x1="3" y1="10" x2="21" y2="10" stroke={filled ? 'var(--surface)' : 'currentColor'} />
    <line x1="8" y1="3" x2="8" y2="7" />
    <line x1="16" y1="3" x2="16" y2="7" />
  </svg>
);

export const GridIcon = ({ filled, size = 18 }) => (
  <svg {...base(filled)} width={size} height={size}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

export const UserIcon = ({ filled, size = 18 }) => (
  <svg {...base(filled)} width={size} height={size}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
  </svg>
);

export const SearchIcon = ({ filled, size = 18 }) => (
  <svg {...base(false)} width={size} height={size}>
    <circle cx="11" cy="11" r="7" fill={filled ? 'currentColor' : 'none'} />
    <line x1="16.5" y1="16.5" x2="21" y2="21" />
  </svg>
);

export const PercentIcon = ({ filled, size = 18 }) => (
  <svg {...base(false)} width={size} height={size}>
    <line x1="19" y1="5" x2="5" y2="19" />
    <circle cx="6.5" cy="6.5" r="2.5" fill={filled ? 'currentColor' : 'none'} />
    <circle cx="17.5" cy="17.5" r="2.5" fill={filled ? 'currentColor' : 'none'} />
  </svg>
);

export const CalculatorIcon = ({ filled, size = 18 }) => (
  <svg {...base(filled)} width={size} height={size}>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <line x1="8" y1="7.5" x2="16" y2="7.5" stroke={filled ? 'var(--surface)' : 'currentColor'} />
    <line x1="8" y1="12" x2="8.01" y2="12" stroke={filled ? 'var(--surface)' : 'currentColor'} />
    <line x1="12" y1="12" x2="12.01" y2="12" stroke={filled ? 'var(--surface)' : 'currentColor'} />
    <line x1="16" y1="12" x2="16.01" y2="12" stroke={filled ? 'var(--surface)' : 'currentColor'} />
    <line x1="8" y1="16" x2="8.01" y2="16" stroke={filled ? 'var(--surface)' : 'currentColor'} />
    <line x1="12" y1="16" x2="12.01" y2="16" stroke={filled ? 'var(--surface)' : 'currentColor'} />
    <line x1="16" y1="16" x2="16.01" y2="16" stroke={filled ? 'var(--surface)' : 'currentColor'} />
  </svg>
);

export const FileIcon = ({ filled, size = 18 }) => (
  <svg {...base(filled)} width={size} height={size}>
    <path d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
    <polyline points="14 2 14 7 19 7" />
  </svg>
);

export const MegaphoneIcon = ({ filled, size = 18 }) => (
  <svg {...base(filled)} width={size} height={size}>
    <path d="M3 11v3l14 4V6L3 10z" />
    <path d="M17 6a3 3 0 0 1 0 9" fill="none" />
    <path d="M7 15v4a1 1 0 0 0 1 1h2v-4" fill="none" />
  </svg>
);

export const BackIcon = ({ size = 16 }) => (
  <svg {...base(false)} width={size} height={size} strokeWidth={2}>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

export const ChevronRight = ({ size = 14 }) => (
  <svg {...base(false)} width={size} height={size} strokeWidth={2}>
    <polyline points="9 6 15 12 9 18" />
  </svg>
);

export const ShieldIcon = ({ filled, size = 18 }) => (
  <svg {...base(filled)} width={size} height={size}>
    <path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z" />
  </svg>
);
