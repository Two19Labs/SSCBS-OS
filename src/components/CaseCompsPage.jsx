import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, hasValidCredentials } from '../lib/supabaseClient';
import { trackCaseCompsEvent } from '../lib/analytics';

const LOCAL_STORAGE_KEY = 'sscbs_bookmarked_case_comps';

// Self-contained SVG Icons to guarantee zero bundler chunking collisions or export mismatches
const BackIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const BookmarkIcon = ({ size = 16, filled = false, className = '' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

const SearchIcon = ({ size = 18, className = '' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <line x1="16.5" y1="16.5" x2="21" y2="21" />
  </svg>
);

const ExternalLinkIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const TrophyIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
  </svg>
);

const UsersIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const FlameIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z" />
  </svg>
);

const SparklesIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
    <path d="M19 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" />
  </svg>
);

const ClockIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const CalendarIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const GraduationCapIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10 12 5 2 10l10 5 10-5v6" />
    <path d="M6 12v5c0 1.657 2.686 3 6 3s6-1.343 6-3v-5" />
  </svg>
);

const ArrowUpDownIcon = ({ size = 14, className = '' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="m21 16-4 4-4-4" />
    <path d="M17 20V4" />
    <path d="m3 8 4-4 4 4" />
    <path d="M7 4v16" />
  </svg>
);

const ChevronDownIcon = ({ size = 12, className = '' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const RotateCcwIcon = ({ size = 12, className = '' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

const CheckIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CopyIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const BriefcaseIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

const FilterIcon = ({ size = 15, className = '' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const XCloseIcon = ({ size = 13, className = '' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CIRCUIT_OPTIONS = [
  { id: 'du', label: 'DU Circuit', countKey: 'du' },
  { id: 'iim-iit-premier', label: 'IIMs, IITs & Premier', countKey: 'iimIitPremier' },
  { id: 'corporate-global', label: 'Corporate & Global', countKey: 'corporateGlobal' },
  { id: 'others', label: 'Others', countKey: 'others' },
];

const TRACK_OPTIONS = [
  { id: 'case', label: 'Case Comps', icon: '📊', countKey: 'cases' },
  { id: 'hackathon', label: 'Hackathons', icon: '💻', countKey: 'hackathons' },
  { id: 'writing', label: 'Writing & Research', icon: '✍️', countKey: 'writing' },
  { id: 'quiz', label: 'Quizzes', icon: '🧠', countKey: 'quizzes' },
  { id: 'simulation', label: 'Simulations', icon: '📈', countKey: 'simulations' },
  { id: 'debate', label: 'Debates', icon: '🗣️', countKey: 'debates' },
];
import './CaseCompsPage.css';

const DU_KEYWORDS = [
  'delhi university', 'university of delhi', '(du)', 'sscbs', 'shaheed sukhdev',
  'srcc', 'shri ram college', 'stephen', 'hindu', 'hansraj', 'lsr', 'lady shri ram',
  'sggscc', 'ramjas', 'kirori mal', 'kmc', 'drc', 'daulat ram', 'gargi', 'venkateswara',
  'venky', 'sgtb khalsa', 'khalsa', 'keshav mahavidyalaya', 'deen dayal upadhyaya', 'ddu',
  'miranda', 'jesus and mary', 'jmc', 'atma ram', 'arsd', 'sbsc', 'shaheed bhagat singh',
  'motilal nehru', 'indraprastha college', 'ipcw', 'maharaja agrasen', 'ramanujan', 'kalindi', 'kamala nehru'
];

const IIM_IIT_PREMIER_KEYWORDS = [
  // IIMs (All 21 Indian Institutes of Management & IIM Mumbai / NITIE)
  'iim', 'indian institute of management', 'nitie',
  // IITs & Premier Research
  'iit', 'indian institute of technology', 'doms', 'dms', 'sjmsom', 'vgsom', 'iisc', 'indian institute of science', 'techkriti', 'ism dhanbad',
  // BITS Pilani (All campuses: Pilani, Goa, Hyderabad)
  'bits pilani', 'birla institute of technology & science', 'birla institute of technology and science', 'bits goa', 'bits hyderabad', 'bits',
  // NITs (All National Institutes of Technology)
  'nit ', 'nit,', 'nit)', 'nit -', 'nit-', 'national institute of technology', 'vnit', 'mnit', 'mnnit', 'svnit', 'manit',
  // IIITs (Indian Institutes of Information Technology)
  'iiit', 'iiit-delhi', 'iiitd', 'iiith', 'iiitb', 'iiit hyderabad', 'iiit bangalore', 'iiit delhi', 'iiit allahabad',
  // Top Tier 1 & Prominent B-Schools
  'xlri', 'xavier school of management', 'xavier labour',
  'isb', 'indian school of business',
  'fms', 'faculty of management studies',
  'spjimr', 'sp jain', 's.p. jain', 's p jain',
  'mdi', 'management development institute',
  'iift', 'indian institute of foreign trade',
  'nmims', 'narsee monjee', 'sbm',
  'sibm', 'scmhrd', 'siib', 'siom', 'scit',
  'tiss', 'tata institute of social sciences',
  'jbims', 'jamnalal bajaj',
  'mica', 'mudra institute',
  'imt', 'imt ghaziabad', 'imt nagpur', 'imt hyderabad',
  'great lakes', 'glim',
  'tapmi', 't. a. pai', 't a pai',
  'ximb', 'xim university', 'xavier institute of management',
  'gim', 'goa institute of management',
  'k j somaiya', 'kj somaiya', 'somaiya', 'simsr', 'kj sim',
  'fore', 'fore school',
  'lbsim', 'lal bahadur shastri',
  'irma', 'institute of rural management',
  'imi', 'international management institute',
  'bimtech', 'birla institute of management',
  'liba', 'loyola institute of business administration',
  'welingkar', 'weschool',
  'ibs', 'icfai business school', 'icfai',
  'masters union', "masters' union",
  'soil institute', 'ifmr', 'krea university',
  'nibm', 'nia pune', 'bimm', 'balaji institute',
  'iiswbm', 'iifm', 'indian institute of forest management',
  'ksom', 'kiit school of management', 'bvimr', 'gl bajaj institute of management',
  'commerce and business management, osmania',
  // Premier State / Central Tech Universities
  'nsut', 'netaji subhas', 'dtu', 'delhi technological university', 'dce',
  'bit mesra', 'birla institute of technology (bit), mesra', 'birla institute of technology, mesra',
  'punjab engineering college', 'pec ', 'pec,', 'pec)', 'coep', 'vjti',
  'jadavpur university', 'anna university', 'ceg guindy', 'thapar',
  'psg tech', 'psg college of technology', 'rvce', 'bmsce', 'msrit', 'mit manipal', 'mahe',
  // Premier Autonomous & Multidisciplinary Colleges
  'st. xavier', 'st xavier', "xavier's college", 'xaviers college',
  'ashoka university', 'ashoka', 'christ university', 'christ (deemed to be university)',
  'loyola college', 'madras christian college', 'mcc chennai',
  'presidency college', 'presidency university', 'jindal global', 'o.p. jindal',
  'shiv nadar', 'snu', 'plaksha',
  // Premier Law / NLUs
  'nlsiu', 'nalsar', 'nujs', 'nlu delhi', 'nlu jodhpur', 'gnlu',
  // Premier Science & Statistics
  'indian statistical institute', 'isi kolkata', 'cmi', 'tifr', 'iiser', 'niser'
];

const CORPORATE_KEYWORDS = [
  // Management Consulting & Professional Services
  'mckinsey', 'bain', 'bcg', 'boston consulting', 'kearney', 'oliver wyman', 'strategy&',
  'deloitte', 'pwc', 'pricewaterhousecoopers', 'ey', 'ernst & young', 'kpmg', 'grant thornton', 'bdo', 'accenture',
  // FMCG & Consumer Brands
  "l'oreal", 'loreal', 'brandstorm', 'hul', 'hindustan unilever', 'lime', 'unilever',
  'itc', 'interrobang', 'marico', 'over the wall', 'mondelez', 'reckitt', 'nestle', 'p&g', 'procter & gamble',
  'pepsico', 'coca-cola', 'coke', 'aditya birla', 'stratfresh', 'abg', 'dabur', 'godrej', 'asian paints', 'berger paints', 'britannia',
  // Tech, E-commerce, Telecom & Semis
  'amazon', 'flipkart', 'google', 'microsoft', 'apple', 'meta', 'uber', 'swiggy', 'zomato',
  'qualcomm', 'intel', 'cisco', 'ibm', 'infosys', 'wipro', 'hcl', 'cognizant', 'capgemini', 'tech mahindra',
  'airtel', 'jio', 'vodafone', 'supervity', 'salesforce', 'adobe',
  // Conglomerates & Industrial
  'tata group', 'tata steel', 'tata motors', 'tcs', 'tata crucible', 'tata imagination', 'tata',
  'reliance', 'reliance retail', 'mahindra', 'war room', 'mahindra rise', 'tvs', 'tvs credit',
  'hero motocorp', 'hero colabs', 'hero', 'bajaj finserv', 'bajaj auto', 'l&t', 'larsen & toubro', 'vedanta', 'adani', 'jsw',
  // Banking & Financial Services
  'goldman sachs', 'jpmorgan', 'jp morgan', 'morgan stanley', 'citi', 'citigroup', 'hsbc',
  'american express', 'amex', 'standard chartered', 'barclays', 'deutsche bank',
  'hdfc', 'icici', 'axis bank', 'kotak', 'optum', 'stratethon', 'raam group',
  // Startups, Platforms & Corporate entities
  'cogniza', 'wonksknow', 'noobsync', 'invoqe', 'upforge', 'jetlearn', 'languify',
  'product space', 'mhtechin', 'monomousumi', 'kartexa', 'skilled sapiens', 'indiastox',
  'godstockss', 'acecubing', 'campusorbit', 'pharmaorbit', 'boss console', 'hackathon raptors',
  'heritage vastra', 'code-x-novas', 'elite coders', 'wecodecoders', 'interactup', 'internhill',
  'innovation hacks', 'gradient learnings', 'bharat academix', 'cyber hx'
];

const GLOBAL_KEYWORDS = [
  // Top Global Universities & International B-Schools
  'harvard', 'stanford', 'wharton', 'massachusetts institute of technology', 'yale',
  'columbia university', 'oxford', 'cambridge', 'london school of economics', 'london business school',
  'insead', 'national university of singapore', 'nanyang technological university', 'hult prize',
  'hec paris', 'nyu stern', 'kellogg', 'chicago booth', 'berkeley haas', 'mit sloan',
  'imperial college', 'eth zurich', 'monash', 'melbourne university', 'sydney university', 'toronto university',
  // Prestigious Global Case Challenges & Flagships
  'unilever future leaders', 'brandstorm', 'imagine cup', 'solution challenge',
  'world bank', 'bloomberg global', 'cfa institute research challenge', 'schneider go green',
  'international case competition', 'global challenge', 'worldwide challenge'
];

function isMatch(text, kw) {
  if (kw.length <= 4 && /^[a-z0-9]+$/i.test(kw)) {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    return regex.test(text);
  }
  return text.includes(kw);
}

function isDUComp(comp) {
  if (comp.isDU) return true;
  const combined = `${comp.orgName || ''} ${comp.title || ''}`.toLowerCase();
  return DU_KEYWORDS.some(kw => isMatch(combined, kw));
}

function isIIMorIITorPremierComp(comp) {
  if (isDUComp(comp)) return false;
  if (typeof comp.isPremier === 'boolean') return comp.isPremier;
  if (typeof comp.isIIMorIITorPremier === 'boolean') return comp.isIIMorIITorPremier;
  if (typeof comp.isBschool === 'boolean') return comp.isBschool;
  if (typeof comp.isIIMorIIT === 'boolean' && comp.isIIMorIIT) return true;
  const combined = `${comp.orgName || ''} ${comp.title || ''}`.toLowerCase();
  return IIM_IIT_PREMIER_KEYWORDS.some(kw => isMatch(combined, kw));
}

const isIIMorIITorBschoolComp = isIIMorIITorPremierComp;

function isCorporateOrGlobalComp(comp) {
  if (isDUComp(comp) || isIIMorIITorPremierComp(comp)) return false;
  if (typeof comp.isCorporateOrGlobal === 'boolean') return comp.isCorporateOrGlobal;
  const combined = `${comp.orgName || ''} ${comp.title || ''}`.toLowerCase();
  return (
    CORPORATE_KEYWORDS.some(kw => isMatch(combined, kw)) ||
    GLOBAL_KEYWORDS.some(kw => isMatch(combined, kw)) ||
    /\b(pvt ltd|private limited|technologies pvt|solutions pvt)\b/i.test(combined) ||
    (comp.isCorporate && !/\b(college|university|institute|school of|academy)\b/i.test(comp.orgName || ''))
  );
}

function parsePrizeAmount(prizesStr) {
  if (!prizesStr) return 0;
  const cleaned = prizesStr.replace(/,/g, '');
  const match = cleaned.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function getCountdownDetails(deadlineStr, fallbackRemainText, nowMs) {
  if (!deadlineStr) {
    return {
      text: fallbackRemainText || 'Ongoing',
      exactDateStr: 'Ongoing',
      urgencyClass: 'green',
      hoursLeft: 9999,
      daysLeft: 999,
    };
  }

  try {
    const deadlineDate = new Date(deadlineStr);
    const deadlineMs = deadlineDate.getTime();
    if (isNaN(deadlineMs)) {
      return {
        text: fallbackRemainText || 'Ongoing',
        exactDateStr: 'Ongoing',
        urgencyClass: 'green',
        hoursLeft: 9999,
        daysLeft: 999,
      };
    }

    const diffMs = deadlineMs - nowMs;
    const exactDateStr = deadlineDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    if (diffMs <= 0) {
      return {
        text: 'Ending Soon',
        exactDateStr,
        urgencyClass: 'red',
        hoursLeft: 0,
        daysLeft: 0,
      };
    }

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const minutes = totalMinutes % 60;

    let text = '';
    if (days > 6) {
      text = `${days}d left`;
    } else if (days >= 1) {
      text = `${days}d ${hours}h left`;
    } else if (totalHours >= 1) {
      text = `${totalHours}h ${minutes}m left`;
    } else {
      text = `${minutes}m left`;
    }

    // Color thresholds:
    // Red: approaching (<= 48 hours / 2 days)
    // Yellow: medium time (3 to 6 days / <= 144 hours)
    // Green: lots of time (7+ days)
    let urgencyClass = 'green';
    if (totalHours <= 48) {
      urgencyClass = 'red';
    } else if (totalHours <= 144) {
      urgencyClass = 'yellow';
    } else {
      urgencyClass = 'green';
    }

    return {
      text,
      exactDateStr,
      urgencyClass,
      hoursLeft: totalHours,
      daysLeft: days,
    };
  } catch {
    return {
      text: fallbackRemainText || 'Ongoing',
      exactDateStr: 'Ongoing',
      urgencyClass: 'green',
      hoursLeft: 9999,
      daysLeft: 999,
    };
  }
}

function getCompCircuitKey(comp) {
  if (isDUComp(comp)) return 'du';
  if (isIIMorIITorPremierComp(comp)) return 'iim-iit-premier';
  if (isCorporateOrGlobalComp(comp)) return 'corporate-global';
  return 'others';
}

function getCardCircuit(comp) {
  if (isDUComp(comp)) return { type: 'du', label: 'DU Circuit', icon: '🎓' };
  if (isIIMorIITorPremierComp(comp)) return { type: 'iim-iit', label: 'IIMs, IITs & Premier Colleges', icon: '🏛️' };
  if (isCorporateOrGlobalComp(comp)) return { type: 'corporate-global', label: 'Corporate & Global', icon: '🏢' };
  return { type: 'others', label: 'Others', icon: '🏫' };
}

export default function CaseCompsPage({ onBack, onNavigate, headerAction }) {
  const { user } = useAuth();
  const userKeySuffix = user?.email ? `_${user.email.toLowerCase()}` : '';
  const bookmarksKey = `${LOCAL_STORAGE_KEY}${userKeySuffix}`;

  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCircuits, setSelectedCircuits] = useState([]); // [] = All circuits; otherwise: 'du' | 'iim-iit-premier' | 'corporate-global' | 'others'
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [selectedTracks, setSelectedTracks] = useState([]); // [] = All tracks; otherwise: 'case' | 'hackathon' | 'writing' | 'quiz' | 'simulation' | 'debate'
  const [teamFilter, setTeamFilter] = useState('all'); // 'all' | 'solo' | 'team'
  const [feeFilter, setFeeFilter] = useState('all'); // 'all' | 'free' | 'paid'
  const [sortBy, setSortBy] = useState('closing-soonest'); // 'closing-soonest' | 'closing-latest' | 'title-asc' | 'title-desc' | 'prize-highest' | 'popular'
  const [copiedId, setCopiedId] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [openSections, setOpenSections] = useState({
    circuits: true,
    tracks: true,
    format: true,
    fee: true,
  });
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  // Debounced search query telemetry
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) return;
    const timer = setTimeout(() => {
      trackCaseCompsEvent('search', {
        query: searchQuery.trim(),
        length: searchQuery.trim().length,
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Bookmarks state with user-scoped storage & fallback
  const [bookmarkedIds, setBookmarkedIds] = useState(() => {
    try {
      if (user?.email) {
        const userKey = `${LOCAL_STORAGE_KEY}_${user.email.toLowerCase()}`;
        const saved = localStorage.getItem(userKey);
        if (saved !== null) return JSON.parse(saved);
      }
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved !== null) return JSON.parse(saved);
    } catch (err) {
      console.error('Error reading saved case comp bookmarks:', err);
    }
    return [];
  });

  // Sync bookmarks to cloud across devices
  const syncProgressToCloud = useCallback(async (newBookmarks) => {
    if (!user || !hasValidCredentials) return;
    try {
      // 1. Update Supabase auth user metadata
      const { data, error } = await supabase.auth.updateUser({
        data: {
          case_comp_bookmarks: newBookmarks,
        },
      });

      // 2. Update user_progress settings table for backup
      if (!error && data?.user?.id) {
        const { data: progressData } = await supabase
          .from('user_progress')
          .select('settings')
          .eq('user_id', data.user.id)
          .maybeSingle();

        const existingSettings = progressData?.settings || {};
        const newSettings = {
          ...existingSettings,
          case_comp_bookmarks: newBookmarks,
          email: data.user.email,
        };

        await supabase
          .from('user_progress')
          .update({ settings: newSettings })
          .eq('user_id', data.user.id);
      }
    } catch (err) {
      console.warn('Error syncing case comp bookmarks to cloud:', err);
    }
  }, [user]);

  // Sync bookmarks to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(bookmarksKey, JSON.stringify(bookmarkedIds));
      if (!userKeySuffix) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(bookmarkedIds));
      }
    } catch (err) {
      console.error('Error saving case comp bookmarks:', err);
    }
  }, [bookmarkedIds, bookmarksKey, userKeySuffix]);

  // Hydrate from cloud metadata when user logs in
  useEffect(() => {
    if (!user) return;
    const cloudBookmarks = user.user_metadata?.case_comp_bookmarks;
    if (Array.isArray(cloudBookmarks)) {
      setBookmarkedIds(cloudBookmarks);
      try {
        localStorage.setItem(bookmarksKey, JSON.stringify(cloudBookmarks));
      } catch (e) {
        console.error('Failed to cache bookmarks in local storage', e);
      }
    }
  }, [user, bookmarksKey]);

  // Toggle bookmark handler
  const toggleBookmark = useCallback((id, e) => {
    if (e?.stopPropagation) e.stopPropagation();
    if (e?.preventDefault) e.preventDefault();
    setBookmarkedIds((prev) => {
      const willAdd = !prev.includes(id);
      trackCaseCompsEvent(willAdd ? 'bookmark_added' : 'bookmark_removed', { comp_id: id });
      const next = willAdd ? [...prev, id] : prev.filter((item) => item !== id);
      syncProgressToCloud(next);
      return next;
    });
  }, [syncProgressToCloud]);

  useEffect(() => {
    // Tick every 30 seconds for live countdown accuracy
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const fetchOpportunities = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const res = await fetch(`/api/competitions?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to reach Unstop`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setCompetitions(data.data);
        setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } else {
        throw new Error(data.error || 'Empty response received from Unstop');
      }
    } catch (err) {
      console.error('Error fetching live Unstop competitions:', err);
      setFetchError(err.message || 'Unable to load real-time competitions from Unstop.');
      setCompetitions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  const handleShare = (comp, e) => {
    e.stopPropagation();
    trackCaseCompsEvent('share_clicked', { comp_id: comp.id, title: comp.title });
    const details = [
      `🏆 ${comp.title || 'Case Competition'}`,
      comp.orgName ? `🏛️ Organized by: ${comp.orgName}` : null,
      comp.prizes ? `💰 Prizes: ${comp.prizes}` : null,
      comp.teamSizeDisplay ? `👥 Format: ${comp.teamSizeDisplay}` : null,
      comp.remainDaysText ? `⏰ Deadline: ${comp.remainDaysText}` : null,
      `🔗 Apply on Unstop: ${comp.unstopUrl}`,
    ].filter(Boolean).join('\n');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(details);
      setCopiedId(comp.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleFindTeammates = (comp, e) => {
    if (e?.stopPropagation) e.stopPropagation();
    trackCaseCompsEvent('find_teammates_clicked', { comp_id: comp.id, title: comp.title });
    const teamSize = Math.max(2, Math.min(5, comp.maxTeam || 4));
    const orgSuffix = comp.orgName ? ` (${comp.orgName})` : '';
    const prefill = {
      competition_name: comp.title || '',
      organizer: comp.orgName || '',
      competition_link: comp.unstopUrl || '',
      title: `Team for ${comp.title || 'Case Competition'}`,
      description: `Building a squad for ${comp.title || 'Case Competition'}${orgSuffix}`,
      total_members: teamSize,
      spots_left: Math.max(1, teamSize - 1),
    };

    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('sscbs_team_finder_prefill', JSON.stringify(prefill));
      }
    } catch (err) {
      console.warn('Could not cache prefill in sessionStorage', err);
    }

    if (onNavigate) {
      onNavigate('team-finder', prefill);
    }
  };

  // Metrics computation from 100% real Unstop competitions
  const metrics = useMemo(() => {
    const total = competitions.length;
    const du = competitions.filter((c) => isDUComp(c)).length;
    const iimIitPremier = competitions.filter((c) => isIIMorIITorPremierComp(c)).length;
    const corporateGlobal = competitions.filter((c) => isCorporateOrGlobalComp(c)).length;
    const others = competitions.filter((c) => !isDUComp(c) && !isIIMorIITorPremierComp(c) && !isCorporateOrGlobalComp(c)).length;
    const bookmarked = competitions.filter((c) => bookmarkedIds.includes(c.id)).length;
    const cases = competitions.filter((c) => c.category === 'case').length;
    const hackathons = competitions.filter((c) => c.category === 'hackathon').length;
    const writing = competitions.filter((c) => c.category === 'writing').length;
    const quizzes = competitions.filter((c) => c.category === 'quiz').length;
    const simulations = competitions.filter((c) => c.category === 'simulation').length;
    const debates = competitions.filter((c) => c.category === 'debate').length;
    return {
      total,
      du,
      iimIitPremier,
      iimIitBschools: iimIitPremier,
      corporateGlobal,
      others,
      bookmarked,
      cases,
      hackathons,
      writing,
      quizzes,
      simulations,
      debates,
    };
  }, [competitions, bookmarkedIds]);

  const toggleSection = (sectionKey) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const toggleCircuit = (circuitKey) => {
    if (circuitKey === 'all') {
      setSelectedCircuits([]);
      setBookmarkedOnly(false);
      return;
    }
    setSelectedCircuits((prev) => {
      if (prev.includes(circuitKey)) {
        return prev.filter((k) => k !== circuitKey);
      }
      return [...prev, circuitKey];
    });
  };

  const isAllCircuitsSelected = selectedCircuits.length === CIRCUIT_OPTIONS.length;
  const handleToggleAllCircuits = () => {
    if (isAllCircuitsSelected) {
      setSelectedCircuits([]);
    } else {
      setSelectedCircuits(CIRCUIT_OPTIONS.map((c) => c.id));
    }
  };

  const toggleTrack = (trackKey) => {
    if (trackKey === 'all') {
      setSelectedTracks([]);
      return;
    }
    setSelectedTracks((prev) => {
      if (prev.includes(trackKey)) {
        return prev.filter((k) => k !== trackKey);
      }
      return [...prev, trackKey];
    });
  };

  const isAllTracksSelected = selectedTracks.length === TRACK_OPTIONS.length;
  const handleToggleAllTracks = () => {
    if (isAllTracksSelected) {
      setSelectedTracks([]);
    } else {
      setSelectedTracks(TRACK_OPTIONS.map((t) => t.id));
    }
  };

  const toggleBookmarkedOnly = () => {
    setBookmarkedOnly((prev) => !prev);
  };

  const getCircuitLabel = (id) => {
    const found = CIRCUIT_OPTIONS.find((c) => c.id === id);
    return found ? found.label : id;
  };

  const getTrackLabel = (id) => {
    const found = TRACK_OPTIONS.find((t) => t.id === id);
    return found ? `${found.icon} ${found.label}` : id;
  };

  const activeFilterCount =
    (selectedCircuits.length > 0 && selectedCircuits.length < CIRCUIT_OPTIONS.length ? selectedCircuits.length : 0) +
    (selectedTracks.length > 0 && selectedTracks.length < TRACK_OPTIONS.length ? selectedTracks.length : 0) +
    (teamFilter !== 'all' ? 1 : 0) +
    (feeFilter !== 'all' ? 1 : 0);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    (selectedCircuits.length > 0 && selectedCircuits.length < CIRCUIT_OPTIONS.length) ||
    (selectedTracks.length > 0 && selectedTracks.length < TRACK_OPTIONS.length) ||
    teamFilter !== 'all' ||
    feeFilter !== 'all' ||
    sortBy !== 'closing-soonest';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCircuits([]);
    setSelectedTracks([]);
    setTeamFilter('all');
    setFeeFilter('all');
    setSortBy('closing-soonest');
  };

  // Filtering & Sorting
  const filteredCompetitions = useMemo(() => {
    const result = competitions.filter((comp) => {
      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = comp.title?.toLowerCase().includes(q);
        const matchesOrg = comp.orgName?.toLowerCase().includes(q);
        const matchesPrize = comp.prizes?.toLowerCase().includes(q);
        const matchesCat = comp.categoryLabel?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesOrg && !matchesPrize && !matchesCat) return false;
      }

      // Circuit filter (multi-select)
      if (selectedCircuits.length > 0 && selectedCircuits.length < CIRCUIT_OPTIONS.length) {
        const compCircuit = getCompCircuitKey(comp);
        const matchesCircuit = selectedCircuits.some(
          (c) => c === compCircuit || (c === 'iim-iit-bschool' && compCircuit === 'iim-iit-premier')
        );
        if (!matchesCircuit) return false;
      }

      // Bookmarked filter
      if (bookmarkedOnly) {
        if (!bookmarkedIds.includes(comp.id)) return false;
      }

      // Discipline track filter (multi-select)
      if (selectedTracks.length > 0 && selectedTracks.length < TRACK_OPTIONS.length) {
        if (!selectedTracks.includes(comp.category)) return false;
      }

      // Team filter
      if (teamFilter === 'solo' && comp.maxTeam > 1) return false;
      if (teamFilter === 'team' && comp.maxTeam <= 1) return false;

      // Fee filter
      if (feeFilter === 'free' && !comp.isFree) return false;
      if (feeFilter === 'paid' && comp.isFree) return false;

      // Undergraduate eligibility check
      if (comp.isUndergradEligible === false) return false;

      return true;
    });

    function getDeadlineTimestamp(comp) {
      if (!comp || !comp.deadline) return Infinity;
      const t = new Date(comp.deadline).getTime();
      return isNaN(t) ? Infinity : t;
    }

    // Sort order
    result.sort((a, b) => {
      switch (sortBy) {
        case 'title-asc':
          return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
        case 'title-desc':
          return (b.title || '').localeCompare(a.title || '', undefined, { sensitivity: 'base' });
        case 'closing-soonest': {
          const timeA = getDeadlineTimestamp(a);
          const timeB = getDeadlineTimestamp(b);
          if (timeA !== timeB) return timeA - timeB;
          return (b.registeredCount || 0) - (a.registeredCount || 0);
        }
        case 'closing-latest': {
          const timeA = getDeadlineTimestamp(a);
          const timeB = getDeadlineTimestamp(b);
          if (timeA === Infinity && timeB === Infinity) return 0;
          if (timeA === Infinity) return 1;
          if (timeB === Infinity) return -1;
          if (timeA !== timeB) return timeB - timeA;
          return (b.registeredCount || 0) - (a.registeredCount || 0);
        }
        case 'prize-highest': {
          const prizeA = parsePrizeAmount(a.prizes);
          const prizeB = parsePrizeAmount(b.prizes);
          if (prizeA !== prizeB) return prizeB - prizeA;
          return (b.registeredCount || 0) - (a.registeredCount || 0);
        }
        case 'popular':
          return (b.registeredCount || 0) - (a.registeredCount || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [competitions, searchQuery, selectedCircuits, bookmarkedOnly, selectedTracks, teamFilter, feeFilter, sortBy, bookmarkedIds]);

  return (
    <div className="case-comps-container">
      {/* ── Top Header ── */}
      <header className="cc-header">
        <div className="cc-header-left">
          {onBack && (
            <button className="cc-back-btn" onClick={onBack} aria-label="Go back">
              <BackIcon size={18} />
            </button>
          )}
          <div>
            <div className="cc-title-row">
              <h1 className="cc-title">Competitions</h1>
            </div>
            <p className="cc-subtitle">
              It's competitions season! Find opportunities relevant to CBS folks right here, synced with and pulled from Unstop, all filterable! :)
            </p>
          </div>
        </div>
        {headerAction && (
          <div className="cc-header-right desktop-only-notif">
            {headerAction}
          </div>
        )}
      </header>

      {/* ── Very Visible Notice: Unstop Exclusivity & Undergrad Filter ── */}
      <div className="cc-unstop-notice-banner">
        <span className="cc-unstop-notice-tag">UNSTOP ONLY</span>
        <span className="cc-unstop-notice-text">
          <strong>Notice:</strong> Curated for <strong>Undergraduate eligibility</strong>, synced directly from <strong>Unstop</strong>. External opportunities are not shown.
        </span>
      </div>

      {/* ── Two-Column Layout (Left: Accordion Filters, Right: Listings) ── */}
      <div className="cc-layout-wrapper">
        {/* ── Filter Sidebar (Card-based Accordions matching reference image) ── */}
        <aside className={`cc-filter-sidebar ${isMobileFiltersOpen ? 'mobile-open' : ''}`}>
          {/* Mobile Drawer Header */}
          <div className="cc-mobile-filter-header">
            <div className="cc-mobile-filter-title">
              <FilterIcon size={16} />
              <span>Filters {activeFilterCount > 0 && `(${activeFilterCount})`}</span>
            </div>
            <div className="cc-mobile-filter-actions">
              {hasActiveFilters && (
                <button type="button" className="cc-filter-reset-link" onClick={handleResetFilters}>
                  Reset All
                </button>
              )}
              <button
                type="button"
                className="cc-mobile-filter-close"
                onClick={() => setIsMobileFiltersOpen(false)}
                aria-label="Close filters"
              >
                <XCloseIcon size={16} />
              </button>
            </div>
          </div>

          {/* Card 1: Target Circuits (Top Accordion Card) */}
          <div className="cc-filter-card">
            <button
              type="button"
              className={`cc-accordion-header ${openSections.circuits ? 'open' : ''}`}
              onClick={() => toggleSection('circuits')}
              aria-expanded={openSections.circuits}
            >
              <div className="cc-accordion-header-left">
                <ChevronDownIcon size={14} className="cc-accordion-chevron" />
                <span className="cc-accordion-title">Circuits</span>
              </div>
              {selectedCircuits.length > 0 && selectedCircuits.length < CIRCUIT_OPTIONS.length && (
                <span className="cc-active-count-badge">{selectedCircuits.length}</span>
              )}
            </button>

            {openSections.circuits && (
              <div className="cc-accordion-content">
                <label className="cc-filter-checkbox-row cc-select-all-row">
                  <input
                    type="checkbox"
                    className="cc-filter-checkbox-input"
                    checked={isAllCircuitsSelected}
                    onChange={handleToggleAllCircuits}
                  />
                  <span className="cc-custom-checkbox">
                    {isAllCircuitsSelected && <CheckIcon size={11} />}
                  </span>
                  <span className="cc-checkbox-label-text">Select All</span>
                </label>

                <div className="cc-checkbox-list">
                  {CIRCUIT_OPTIONS.map((opt) => {
                    const isChecked = selectedCircuits.includes(opt.id);
                    return (
                      <label key={opt.id} className="cc-filter-checkbox-row">
                        <input
                          type="checkbox"
                          className="cc-filter-checkbox-input"
                          checked={isChecked}
                          onChange={() => toggleCircuit(opt.id)}
                        />
                        <span className="cc-custom-checkbox">
                          {isChecked && <CheckIcon size={11} />}
                        </span>
                        <span className="cc-checkbox-label-text">{opt.label}</span>
                        <span className="cc-filter-num">({metrics[opt.countKey] || 0})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Card 2: More Filters (Categories, Format, Fee, Bookmarks) */}
          <div className="cc-filter-card">
            <div className="cc-filter-card-header">
              <span className="cc-card-heading">Filters</span>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="cc-filter-reset-link"
                  onClick={handleResetFilters}
                  title="Reset all filters"
                >
                  Reset All
                </button>
              )}
            </div>

            {/* Section: Categories & Tracks */}
            <div className="cc-filter-subgroup">
              <button
                type="button"
                className={`cc-accordion-header ${openSections.tracks ? 'open' : ''}`}
                onClick={() => toggleSection('tracks')}
                aria-expanded={openSections.tracks}
              >
                <div className="cc-accordion-header-left">
                  <ChevronDownIcon size={14} className="cc-accordion-chevron" />
                  <span className="cc-accordion-title">Categories</span>
                </div>
                {selectedTracks.length > 0 && selectedTracks.length < TRACK_OPTIONS.length && (
                  <span className="cc-active-count-badge">{selectedTracks.length}</span>
                )}
              </button>

              {openSections.tracks && (
                <div className="cc-accordion-content">
                  <label className="cc-filter-checkbox-row cc-select-all-row">
                    <input
                      type="checkbox"
                      className="cc-filter-checkbox-input"
                      checked={isAllTracksSelected}
                      onChange={handleToggleAllTracks}
                    />
                    <span className="cc-custom-checkbox">
                      {isAllTracksSelected && <CheckIcon size={11} />}
                    </span>
                    <span className="cc-checkbox-label-text">Select All</span>
                  </label>

                  <div className="cc-checkbox-list">
                    {TRACK_OPTIONS.map((opt) => {
                      const isChecked = selectedTracks.includes(opt.id);
                      return (
                        <label key={opt.id} className="cc-filter-checkbox-row">
                          <input
                            type="checkbox"
                            className="cc-filter-checkbox-input"
                            checked={isChecked}
                            onChange={() => toggleTrack(opt.id)}
                          />
                          <span className="cc-custom-checkbox">
                            {isChecked && <CheckIcon size={11} />}
                          </span>
                          <span className="cc-checkbox-label-text">
                            <span className="cc-cat-emoji">{opt.icon}</span> {opt.label}
                          </span>
                          <span className="cc-filter-num">({metrics[opt.countKey] || 0})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Section: Format */}
            <div className="cc-filter-subgroup">
              <button
                type="button"
                className={`cc-accordion-header ${openSections.format ? 'open' : ''}`}
                onClick={() => toggleSection('format')}
                aria-expanded={openSections.format}
              >
                <div className="cc-accordion-header-left">
                  <ChevronDownIcon size={14} className="cc-accordion-chevron" />
                  <span className="cc-accordion-title">Participation</span>
                </div>
                {teamFilter !== 'all' && <span className="cc-active-count-badge">1</span>}
              </button>

              {openSections.format && (
                <div className="cc-accordion-content">
                  <div className="cc-checkbox-list">
                    <label className="cc-filter-checkbox-row">
                      <input
                        type="checkbox"
                        className="cc-filter-checkbox-input"
                        checked={teamFilter === 'solo'}
                        onChange={() => setTeamFilter((prev) => (prev === 'solo' ? 'all' : 'solo'))}
                      />
                      <span className="cc-custom-checkbox">
                        {teamFilter === 'solo' && <CheckIcon size={11} />}
                      </span>
                      <span className="cc-checkbox-label-text">👤 Solo Participation</span>
                    </label>

                    <label className="cc-filter-checkbox-row">
                      <input
                        type="checkbox"
                        className="cc-filter-checkbox-input"
                        checked={teamFilter === 'team'}
                        onChange={() => setTeamFilter((prev) => (prev === 'team' ? 'all' : 'team'))}
                      />
                      <span className="cc-custom-checkbox">
                        {teamFilter === 'team' && <CheckIcon size={11} />}
                      </span>
                      <span className="cc-checkbox-label-text">👥 Teams (2+)</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Section: Registration Fee */}
            <div className="cc-filter-subgroup">
              <button
                type="button"
                className={`cc-accordion-header ${openSections.fee ? 'open' : ''}`}
                onClick={() => toggleSection('fee')}
                aria-expanded={openSections.fee}
              >
                <div className="cc-accordion-header-left">
                  <ChevronDownIcon size={14} className="cc-accordion-chevron" />
                  <span className="cc-accordion-title">Entry Fee</span>
                </div>
                {feeFilter !== 'all' && <span className="cc-active-count-badge">1</span>}
              </button>

              {openSections.fee && (
                <div className="cc-accordion-content">
                  <div className="cc-checkbox-list">
                    <label className="cc-filter-checkbox-row">
                      <input
                        type="checkbox"
                        className="cc-filter-checkbox-input"
                        checked={feeFilter === 'free'}
                        onChange={() => setFeeFilter((prev) => (prev === 'free' ? 'all' : 'free'))}
                      />
                      <span className="cc-custom-checkbox">
                        {feeFilter === 'free' && <CheckIcon size={11} />}
                      </span>
                      <span className="cc-checkbox-label-text">🟢 Free Entry</span>
                    </label>

                    <label className="cc-filter-checkbox-row">
                      <input
                        type="checkbox"
                        className="cc-filter-checkbox-input"
                        checked={feeFilter === 'paid'}
                        onChange={() => setFeeFilter((prev) => (prev === 'paid' ? 'all' : 'paid'))}
                      />
                      <span className="cc-custom-checkbox">
                        {feeFilter === 'paid' && <CheckIcon size={11} />}
                      </span>
                      <span className="cc-checkbox-label-text">💳 Paid Entry</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Backdrop for mobile drawer */}
        {isMobileFiltersOpen && (
          <div
            className="cc-filter-backdrop"
            onClick={() => setIsMobileFiltersOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* ── Main Content Area ── */}
        <main className="cc-main-content">
          {/* Top Search & Toolbar */}
          <div className="cc-content-top-bar">
            <div className="cc-search-wrapper">
              <SearchIcon size={16} className="cc-search-icon" />
              <input
                type="text"
                className="cc-search-input"
                placeholder="Search competitions, IIM, IIT, XLRI, ISB, prizes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="cc-clear-search"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Dedicated Section Tabs: All vs Bookmarked (Section of its own next to searchbar) */}
            <div className="cc-section-tabs" role="tablist" aria-label="Competitions view section">
              <button
                type="button"
                role="tab"
                aria-selected={!bookmarkedOnly}
                className={`cc-section-tab ${!bookmarkedOnly ? 'active' : ''}`}
                onClick={() => setBookmarkedOnly(false)}
              >
                <span>All</span>
                <span className="cc-section-tab-count">{competitions.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={bookmarkedOnly}
                className={`cc-section-tab cc-section-tab-bookmark ${bookmarkedOnly ? 'active' : ''}`}
                onClick={() => setBookmarkedOnly((prev) => !prev)}
                title={bookmarkedOnly ? 'Showing bookmarked competitions (click to show all)' : 'Show bookmarked competitions'}
              >
                <BookmarkIcon size={14} filled={bookmarkedOnly || metrics.bookmarked > 0} />
                <span>Bookmarked</span>
                <span className={`cc-section-tab-count ${metrics.bookmarked > 0 ? 'has-count' : ''}`}>
                  {metrics.bookmarked}
                </span>
              </button>
            </div>

            <div className="cc-top-actions">
              {/* Mobile Filter Trigger Button */}
              <button
                type="button"
                className={`cc-mobile-filter-trigger ${activeFilterCount > 0 ? 'active' : ''}`}
                onClick={() => setIsMobileFiltersOpen(true)}
              >
                <FilterIcon size={15} />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="cc-filter-badge-count">{activeFilterCount}</span>
                )}
              </button>

              {/* Sort Selector */}
              <div className="cc-sort-box">
                <ArrowUpDownIcon size={13} className="cc-sort-icon" />
                <label htmlFor="cc-sort-select" className="cc-sort-label">Sort:</label>
                <div className="cc-sort-select-wrapper">
                  <select
                    id="cc-sort-select"
                    className="cc-sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="closing-soonest">⏳ Closing Soonest</option>
                    <option value="closing-latest">📅 Closing Latest</option>
                    <option value="title-asc">🔤 Title: A → Z</option>
                    <option value="title-desc">🔤 Title: Z → A</option>
                    <option value="prize-highest">🏆 Highest Prize Pool</option>
                    <option value="popular">🔥 Most Applied (Popular)</option>
                  </select>
                  <ChevronDownIcon size={11} className="cc-sort-chevron" />
                </div>
              </div>
            </div>
          </div>

          {/* Active Filter Pills Bar (Colored pills matching reference screenshot) */}
          {hasActiveFilters && (
            <div className="cc-active-pills-bar">
              <div className="cc-active-pills-list">
                {searchQuery.trim() && (
                  <span className="cc-active-pill pill-search">
                    Search: "{searchQuery.trim()}"
                    <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search query">✕</button>
                  </span>
                )}
                {selectedCircuits.length > 0 && selectedCircuits.length < CIRCUIT_OPTIONS.length && selectedCircuits.map((circuitKey) => (
                  <span key={circuitKey} className="cc-active-pill pill-circuit">
                    {getCircuitLabel(circuitKey)}
                    <button type="button" onClick={() => toggleCircuit(circuitKey)} aria-label={`Remove ${getCircuitLabel(circuitKey)} filter`}>✕</button>
                  </span>
                ))}
                {selectedTracks.length > 0 && selectedTracks.length < TRACK_OPTIONS.length && selectedTracks.map((trackKey) => (
                  <span key={trackKey} className="cc-active-pill pill-track">
                    {getTrackLabel(trackKey)}
                    <button type="button" onClick={() => toggleTrack(trackKey)} aria-label={`Remove ${getTrackLabel(trackKey)} filter`}>✕</button>
                  </span>
                ))}
                {teamFilter !== 'all' && (
                  <span className="cc-active-pill pill-format">
                    {teamFilter === 'solo' ? '👤 Solo' : '👥 Teams (2+)'}
                    <button type="button" onClick={() => setTeamFilter('all')} aria-label="Remove format filter">✕</button>
                  </span>
                )}
                {feeFilter !== 'all' && (
                  <span className="cc-active-pill pill-fee">
                    {feeFilter === 'free' ? '🟢 Free Entry' : '💳 Paid'}
                    <button type="button" onClick={() => setFeeFilter('all')} aria-label="Remove fee filter">✕</button>
                  </span>
                )}
              </div>

              <button
                type="button"
                className="cc-clear-all-pill-btn"
                onClick={handleResetFilters}
                title="Clear all active filters"
              >
                <RotateCcwIcon size={11} />
                <span>Reset</span>
              </button>
            </div>
          )}

          {/* Inline Opportunities Count */}
          {!loading && !fetchError && (
            <div className="cc-inline-count">
              <span className="cc-pulse-dot" title="Live Unstop sync active"></span>
              <span>
                Showing <strong>{filteredCompetitions.length}</strong>{' '}
                {filteredCompetitions.length === 1 ? 'opportunity' : 'opportunities'}
              </span>
            </div>
          )}

      {/* ── Competitions Grid ── */}
      {loading ? (
        <div className="cc-loading-state">
          <div className="cc-spinner"></div>
          <p className="cc-loading-title">Fetching live competitions from Unstop...</p>
          <p className="cc-loading-subtitle">Pulling direct listings across DU, IIMs, IITs & premier colleges</p>
        </div>
      ) : fetchError ? (
        <div className="cc-empty-state error">
          <div className="cc-empty-icon">
            <TrophyIcon size={36} />
          </div>
          <h3 className="cc-empty-title">Could not load live competitions</h3>
          <p className="cc-empty-desc">{fetchError}</p>
          <button className="cc-empty-btn" onClick={() => fetchOpportunities(false)}>
            Retry Connection to Unstop
          </button>
        </div>
      ) : filteredCompetitions.length === 0 ? (
        <div className="cc-empty-state">
          <div className="cc-empty-icon">
            {bookmarkedOnly ? <BookmarkIcon size={36} filled={false} /> : <TrophyIcon size={36} />}
          </div>
          <h3 className="cc-empty-title">
            {bookmarkedOnly ? 'No bookmarked competitions match' : 'No competitions match your filter'}
          </h3>
          <p className="cc-empty-desc">
            {bookmarkedOnly
              ? 'Click the bookmark button on any competition card to save it here and keep track of deadlines and teams!'
              : 'Try searching a different keyword, selecting additional filters, or resetting criteria.'}
          </p>
          <button
            className="cc-empty-btn"
            onClick={handleResetFilters}
          >
            {bookmarkedOnly ? 'Explore All Competitions' : 'Clear All Filters'}
          </button>
        </div>
      ) : (
        <div className="cc-grid">
          {filteredCompetitions.map((comp) => {
            const circuit = getCardCircuit(comp);
            const countdown = getCountdownDetails(comp.deadline, comp.remainDaysText, nowMs);
            const isSolo = comp.maxTeam === 1 || (comp.teamSizeDisplay && comp.teamSizeDisplay.toLowerCase().startsWith('solo'));
            const isBookmarked = bookmarkedIds.includes(comp.id);

            return (
              <article key={comp.id} className={`cc-card cc-card-${circuit.type} ${isBookmarked ? 'is-bookmarked' : ''}`}>
                <div className="cc-card-inner">
                  {/* Top Bar: Host Profile & Bookmark Button */}
                  <div className="cc-card-top-bar">
                    <div className="cc-host-identity">
                      {comp.orgLogo ? (
                        <img
                          src={comp.orgLogo}
                          alt=""
                          className="cc-host-logo"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className={`cc-host-avatar ${circuit.type}`}>
                          {(comp.orgName ? comp.orgName.charAt(0) : 'A').toUpperCase()}
                        </div>
                      )}
                      <div className="cc-host-meta">
                        <span className="cc-host-name" title={comp.orgName || 'Academic Host'}>
                          {comp.orgName || 'Academic Host'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`cc-card-bookmark-btn ${isBookmarked ? 'active' : ''}`}
                      onClick={(e) => toggleBookmark(comp.id, e)}
                      title={isBookmarked ? 'Remove bookmark' : 'Bookmark this competition'}
                      aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this competition'}
                    >
                      <BookmarkIcon size={16} filled={isBookmarked} />
                    </button>
                  </div>

                  {/* Competition Title */}
                  <h2 className="cc-card-title" title={comp.title || 'Case Competition'}>
                    {comp.title || 'Case Competition'}
                  </h2>

                  {/* Featured Prize & Entry Bar */}
                  <div className="cc-prize-bar">
                    <div className="cc-prize-left">
                      <TrophyIcon size={14} className="cc-prize-trophy" />
                      <span className="cc-prize-text" title={comp.prizes || 'Certificates & Recognition'}>
                        {comp.prizes || 'Certificates & Recognition'}
                      </span>
                    </div>
                    <span className={`cc-entry-tag ${comp.isFree ? 'free' : 'paid'}`}>
                      {comp.isFree ? 'Free Entry' : 'Paid'}
                    </span>
                  </div>

                  {/* Metadata: Format & Exact Deadline */}
                  <div className="cc-specs-row">
                    <div className="cc-spec-item" title={comp.teamSizeDisplay || 'Solo / Team'}>
                      <UsersIcon size={13} />
                      <span>{comp.teamSizeDisplay || 'Solo / Team'}</span>
                    </div>
                    <div className="cc-spec-dot" />
                    <div className="cc-spec-item" title={`Exact Deadline: ${countdown.exactDateStr}`}>
                      <CalendarIcon size={13} />
                      <span>Ends {countdown.exactDateStr}</span>
                    </div>
                  </div>

                  {/* Social Proof + Deadline Status */}
                  <div className="cc-card-footer-metric">
                    <div className="cc-footer-metric-left">
                      {Number(comp.registeredCount || 0) > 0 ? (
                        <span className="cc-reg-count">
                          <FlameIcon size={12} className="cc-reg-icon" />
                          <strong>{Number(comp.registeredCount).toLocaleString()}</strong> registrations
                        </span>
                      ) : (
                        <span className="cc-meta-fresh">⚡ Recently Listed</span>
                      )}
                    </div>

                    <span
                      className={`cc-countdown-chip ${countdown.urgencyClass}`}
                      title={`Exact Deadline: ${countdown.exactDateStr}`}
                    >
                      <span className="cc-status-dot" />
                      <ClockIcon size={12} className="cc-timer-icon" />
                      <span>{countdown.text}</span>
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="cc-card-actions">
                    <a
                      href={comp.unstopUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cc-action-btn cc-btn-apply"
                      onClick={() => trackCaseCompsEvent('apply_clicked', { comp_id: comp.id, title: comp.title, url: comp.unstopUrl })}
                    >
                      <span>Apply on Unstop</span>
                      <ExternalLinkIcon size={12} />
                    </a>

                    {!isSolo && (
                      <button
                        type="button"
                        className="cc-action-btn cc-btn-team"
                        onClick={(e) => handleFindTeammates(comp, e)}
                        title="Find batchmates on Team Finder"
                      >
                        <UsersIcon size={13} />
                        <span>Find Teammates</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className={`cc-share-icon-btn ${copiedId === comp.id ? 'copied' : ''}`}
                      onClick={(e) => handleShare(comp, e)}
                      title={copiedId === comp.id ? 'Details copied!' : 'Copy competition details & link'}
                      aria-label="Copy competition details and link"
                    >
                      {copiedId === comp.id ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
        </main>
      </div>
    </div>
  );
}
