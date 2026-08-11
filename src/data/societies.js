// SSCBS Society Recruitment Data Store

export const CATEGORIES = [
  { id: 'all', label: 'All Domains', icon: '⚡' },
  { id: 'consulting', label: 'Consulting', icon: '💼' },
  { id: 'finance', label: 'Finance & Markets', icon: '📈' },
  { id: 'ecell', label: 'E-Cell & Startups', icon: '🚀' },
  { id: 'tech', label: 'Tech & Coding', icon: '💻' },
  { id: 'debating', label: 'Debating & MUN', icon: '🎙️' },
  { id: 'cultural', label: 'Cultural & Arts', icon: '🎭' },
  { id: 'marketing', label: 'Marketing & PR', icon: '📣' },
];

export const DEMO_SOCIETIES = [
  {
    id: '180dc-sscbs',
    name: '180 Degrees Consulting SSCBS',
    shortName: '180DC',
    category: 'consulting',
    categoryLabel: 'Consulting',
    description: "World's premier student-run consultancy providing pro-bono strategy advisory to non-profits and social enterprises.",
    recruitmentFormUrl: 'https://forms.google.com',
    deadline: '2026-08-25T23:59:59',
    instagramVideoUrl: 'https://instagram.com',
    linkedinUrl: 'https://linkedin.com',
    defaultBookmarked: true,
    isUrgent: true,
    accentColor: '#3b82f6',
  },
  {
    id: 'cbs-finance-guild',
    name: 'CBS Finance Guild',
    shortName: 'CFG',
    category: 'finance',
    categoryLabel: 'Finance & Markets',
    description: 'Fostering financial literacy, equity research competitions, stock pitching, and quantitative trading simulations.',
    recruitmentFormUrl: 'https://forms.google.com',
    deadline: '2026-08-28T23:59:59',
    instagramVideoUrl: 'https://instagram.com',
    linkedinUrl: 'https://linkedin.com',
    defaultBookmarked: true,
    isUrgent: false,
    accentColor: '#10b981',
  },
  {
    id: 'yuva-ecell',
    name: 'Yuva - E-Cell SSCBS',
    shortName: 'E-Cell',
    category: 'ecell',
    categoryLabel: 'E-Cell & Startups',
    description: 'Empowering young founders, incubation mentorship, startup pitch decks, and hosting SSCBS flagship E-Summit.',
    recruitmentFormUrl: 'https://forms.google.com',
    deadline: '2026-08-30T23:59:59',
    instagramVideoUrl: 'https://instagram.com',
    linkedinUrl: 'https://linkedin.com',
    defaultBookmarked: false,
    isUrgent: false,
    accentColor: '#f59e0b',
  },
  {
    id: 'turing-club',
    name: 'Turing Club - Tech Society',
    shortName: 'Turing',
    category: 'tech',
    categoryLabel: 'Tech & Coding',
    description: 'Software engineering, AI/ML workshops, web & mobile app building, hackathons, and open source projects.',
    recruitmentFormUrl: 'https://forms.google.com',
    deadline: '2026-09-02T23:59:59',
    instagramVideoUrl: 'https://instagram.com',
    linkedinUrl: 'https://linkedin.com',
    defaultBookmarked: false,
    isUrgent: false,
    accentColor: '#8b5cf6',
  },
  {
    id: 'veritas-debating',
    name: 'Veritas - Debating Society',
    shortName: 'Veritas',
    category: 'debating',
    categoryLabel: 'Debating & MUN',
    description: 'Parliamentary debating, public policy discussions, MUN delegations, and national oratorical competitions.',
    recruitmentFormUrl: 'https://forms.google.com',
    deadline: '2026-08-24T18:00:00',
    instagramVideoUrl: 'https://instagram.com',
    linkedinUrl: 'https://linkedin.com',
    defaultBookmarked: false,
    isUrgent: true,
    accentColor: '#ec4899',
  },
  {
    id: 'kronos-cultural',
    name: 'Kronos - Cultural Society',
    shortName: 'Kronos',
    category: 'cultural',
    categoryLabel: 'Cultural & Arts',
    description: 'Music, dance, dramatics, fine arts, and organizing SSCBS’s annual inter-college cultural festival.',
    recruitmentFormUrl: 'https://forms.google.com',
    deadline: '2026-09-05T23:59:59',
    instagramVideoUrl: 'https://instagram.com',
    linkedinUrl: 'https://linkedin.com',
    defaultBookmarked: false,
    isUrgent: false,
    accentColor: '#06b6d4',
  },
];

/**
 * Calculates deadline status & formatted text
 */
export function getDeadlineInfo(deadlineStr) {
  if (!deadlineStr) return { status: 'open', text: 'No Deadline Specified', isExpired: false, daysLeft: 99 };

  const deadlineDate = new Date(deadlineStr);
  const now = new Date();
  const diffMs = deadlineDate - now;

  if (diffMs <= 0) {
    return { status: 'expired', text: 'Closed', isExpired: true, daysLeft: -1 };
  }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 24) {
    return {
      status: 'urgent',
      text: `Closing Today (${diffHours}h left)`,
      isExpired: false,
      daysLeft: 0,
      hoursLeft: diffHours,
    };
  }

  if (diffDays <= 3) {
    return {
      status: 'urgent',
      text: `Closing in ${diffDays} day${diffDays > 1 ? 's' : ''}`,
      isExpired: false,
      daysLeft: diffDays,
    };
  }

  return {
    status: 'normal',
    text: `${diffDays} days left`,
    isExpired: false,
    daysLeft: diffDays,
  };
}
