// api/competitions.js
// Vercel Serverless Function to fetch, filter and serve 100% REAL active case competitions directly from Unstop

const FLAGSHIP_KEYWORDS = [
  'iim', 'iit', 'srcc', 'sscbs', 'shri ram', 'bits', 'xlri', 'fms',
  'stephen', 'hansraj', 'hindu', 'lsr', 'lady shri ram', 'sggscc',
  'nsut', 'dtu', "l'oreal", 'loreal', 'tata', 'hul', 'hindustan unilever',
  'aditya birla', 'mckinsey', 'bain', 'bcg', 'boston consulting', 'kearney',
  'ey', 'deloitte', 'pwc', 'kpmg', 'reliance', 'amazon', 'flipkart',
  'google', 'microsoft', 'tvs', 'optum', 'marico', 'itc', 'mondelez',
  'reckitt', 'accenture', 'sibm', 'spjimr', 'mdi', 'great lakes', 'glim'
];

const DU_KEYWORDS = [
  'delhi university', 'university of delhi', 'sscbs', 'srcc', 'stephen',
  'hindu', 'hansraj', 'lsr', 'lady shri ram', 'sggscc', 'ramjas', 'kirori mal',
  'drc', 'daulat ram', 'gargi', 'venkateswara', 'sgtb khalsa', 'keshav mahavidyalaya',
  'deen dayal upadhyaya', 'ddu'
];

const IIM_MBA_KEYWORDS = [
  'iim', 'indian institute of management', 'xlri', 'fms', 'faculty of management',
  'sibm', 'symbiosis', 'spjimr', 'sp jain', 'mdi', 'gurgaon', 'great lakes', 'glim',
  'nmims', 'iift', 'iim rohtak', 'iim bangalore', 'iim ahmedabad', 'iim calcutta',
  'iim lucknow', 'iim kozhikode', 'iim indore', 'iim shillong', 'iim ranchi',
  'iim trichy', 'iim kashipur', 'iim udaipur', 'iim bodh gaya', 'iim jammu', 'iim sambalpur',
  'iim sirmaur', 'iim visakhapatnam', 'iim amritsar', 'iim nagpur', 'iim raipur',
  'iit delhi dms', 'doms', 'sjmsom', 'vgsom'
];

const IIT_TECH_KEYWORDS = [
  'iit', 'indian institute of technology', 'bits', 'birla institute', 'nsut',
  'dtu', 'delhi technological', 'nit', 'national institute of technology', 'iiit'
];

export async function fetchCompetitionsFromUnstop() {
  const queryEndpoints = [
    'opportunity=competitions&subType=case-competitions&per_page=50',
    'opportunity=competitions&searchTerm=case&per_page=50',
    'opportunity=competitions&searchTerm=case study&per_page=50',
    'opportunity=competitions&searchTerm=consulting&per_page=50',
    'opportunity=competitions&searchTerm=strategy&per_page=50',
    'opportunity=competitions&searchTerm=iim&per_page=50',
    'opportunity=competitions&searchTerm=iit&per_page=50',
    'opportunity=competitions&searchTerm=challenge&per_page=50'
  ];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
  };

  const fetchPromises = queryEndpoints.map(q =>
    fetch(`https://unstop.com/api/public/opportunity/search-result?${q}`, { headers })
      .then(res => (res.ok ? res.json() : null))
      .then(json => (json?.data?.data || []))
      .catch(err => {
        console.warn(`Error querying Unstop for [${q}]:`, err.message);
        return [];
      })
  );

  const batches = await Promise.all(fetchPromises);
  const now = Date.now();

  const map = new Map();

  for (const list of batches) {
    for (const item of list) {
      if (!item || !item.id) continue;
      if (map.has(item.id)) continue;

      const regStatus = item.regnRequirements?.reg_status;
      const remainDays = item.regnRequirements?.remain_days || '';

      // Strictly ignore finished or ended competitions
      if (regStatus === 'FINISHED') continue;
      if (remainDays.toLowerCase().includes('ended')) continue;

      if (item.regnRequirements?.end_regn_dt) {
        const deadlineTime = new Date(item.regnRequirements.end_regn_dt).getTime();
        if (deadlineTime < now) continue;
      }

      map.set(item.id, item);
    }
  }

  const rawList = Array.from(map.values());

  const formatted = rawList.map(item => {
    const orgName = item.organisation?.name || 'Academic Institution';
    const lowerOrg = orgName.toLowerCase();
    const lowerTitle = (item.title || '').toLowerCase();
    const combined = `${lowerOrg} ${lowerTitle}`;

    // Tag categorization
    const isDU = DU_KEYWORDS.some(kw => combined.includes(kw));
    const isIIMorMBA = IIM_MBA_KEYWORDS.some(kw => combined.includes(kw));
    const isIITorTech = IIT_TECH_KEYWORDS.some(kw => combined.includes(kw));
    const isFlagship = FLAGSHIP_KEYWORDS.some(kw => combined.includes(kw));

    const minTeam = item.regnRequirements?.min_team_size || 1;
    const maxTeam = item.regnRequirements?.max_team_size || 4;
    const isFree = !item.isPaid;
    const isFirstYearFriendly = isFree && (maxTeam >= 1 && maxTeam <= 5);

    // Extract prizes
    let prizeDisplay = 'Certificates & Recognition';
    if (Array.isArray(item.prizes) && item.prizes.length > 0) {
      const maxCash = item.prizes.reduce((max, p) => (p.cash && p.cash > max ? p.cash : max), 0);
      if (maxCash > 0) {
        prizeDisplay = `₹${maxCash.toLocaleString('en-IN')} Cash Pool`;
      } else if (item.prizes.some(p => p.rank)) {
        prizeDisplay = item.prizes.map(p => p.rank).filter(Boolean).slice(0, 2).join(' · ');
      }
    }

    // Remaining days & urgency
    const remainDaysText = item.regnRequirements?.remain_days || 'Ongoing';
    let daysRemainingNum = 999;
    if (item.regnRequirements?.end_regn_dt) {
      const diffMs = new Date(item.regnRequirements.end_regn_dt).getTime() - now;
      daysRemainingNum = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    const urgency = daysRemainingNum <= 2 ? 'high' : daysRemainingNum <= 5 ? 'medium' : 'normal';

    return {
      id: item.id || item.short_id,
      title: item.title,
      orgName,
      orgLogo: item.organisation?.logoUrl2 || item.organisation?.logoUrl || null,
      bannerUrl: item.logoUrl2 || null,
      unstopUrl: item.seo_url || `https://unstop.com/o/${item.short_id || item.id}`,
      deadline: item.regnRequirements?.end_regn_dt || item.end_date,
      remainDaysText,
      daysRemainingNum,
      urgency,
      minTeam,
      maxTeam,
      teamSizeDisplay: minTeam === maxTeam 
        ? (minTeam === 1 ? 'Solo / Individual' : `${minTeam} Members`) 
        : `${minTeam} - ${maxTeam} Members`,
      prizes: prizeDisplay,
      isFree,
      isFlagship,
      isDU,
      isIIMorMBA,
      isIITorTech,
      isFirstYearFriendly,
      registeredCount: item.registerCount || 0,
      viewsCount: item.viewsCount || 0,
    };
  });

  // Sort: Urgency / closing soon first, then by registrations
  formatted.sort((a, b) => {
    if (a.daysRemainingNum !== b.daysRemainingNum) {
      return a.daysRemainingNum - b.daysRemainingNum;
    }
    return b.registeredCount - a.registeredCount;
  });

  return formatted;
}

export default async function handler(req, res) {
  try {
    const competitions = await fetchCompetitionsFromUnstop();

    // Cache on Vercel Edge CDN for 30 minutes
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json({
      success: true,
      count: competitions.length,
      updatedAt: new Date().toISOString(),
      data: competitions,
    });
  } catch (error) {
    console.error('Error fetching competitions from Unstop:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch competitions from Unstop',
    });
  }
}
