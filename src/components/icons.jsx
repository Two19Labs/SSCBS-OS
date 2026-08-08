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

export const BellIcon = ({ filled, size = 18 }) => (
  <svg {...base(filled)} width={size} height={size}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
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

export const EyeIcon = ({ size = 18 }) => (
  <svg {...base(false)} width={size} height={size} strokeWidth={1.5}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const EyeOffIcon = ({ size = 18 }) => (
  <svg {...base(false)} width={size} height={size} strokeWidth={1.5}>
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

export const WhatsAppIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
    <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" strokeLinecap="round" />
  </svg>
);

export const MessageIcon = ({ filled, size = 18 }) => (
  <svg {...base(filled)} width={size} height={size}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

export const MailIcon = ({ size = 18 }) => (
  <svg {...base(false)} width={size} height={size}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

export const CopyIcon = ({ size = 18 }) => (
  <svg {...base(false)} width={size} height={size}>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export const CheckIcon = ({ size = 18 }) => (
  <svg {...base(false)} width={size} height={size} strokeWidth={2}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const TrophyIcon = ({ filled, size = 18 }) => (
  <svg {...base(filled)} width={size} height={size}>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
  </svg>
);

export const UsersIcon = ({ filled, size = 18 }) => (
  <svg {...base(filled)} width={size} height={size}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const MoreVerticalIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <circle cx="12" cy="5" r="1.5" fill="currentColor" />
    <circle cx="12" cy="19" r="1.5" fill="currentColor" />
  </svg>
);

export const DoorIcon = ({ filled, size = 18 }) => (
  <svg {...base(filled)} width={size} height={size}>
    <path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14" />
    <path d="M2 20h20" />
    <circle cx="14" cy="12" r="1" fill="currentColor" />
  </svg>
);

export const HeartIcon = ({ filled, size = 18 }) => (
  <svg {...base(filled)} width={size} height={size}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.78-8.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

export const RefreshIcon = ({ size = 18, className = '' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.5 2v6h-6M2.5 22v-6h6" />
    <path d="M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8M22 12.5a10 10 0 0 1-18.8 4.3L2.5 16" />
  </svg>
);

export const ExternalLinkIcon = ({ size = 14 }) => (
  <svg {...base(false)} width={size} height={size} strokeWidth={1.75}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

export const MenuIcon = ({ size = 20 }) => (
  <svg {...base(false)} width={size} height={size} strokeWidth={2}>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

export const CloseIcon = ({ size = 20 }) => (
  <svg {...base(false)} width={size} height={size} strokeWidth={2}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);





