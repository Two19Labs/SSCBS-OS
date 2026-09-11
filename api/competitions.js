// api/competitions.js
// Vercel Serverless Function to fetch, filter and serve active case competitions from Unstop

const FLAGSHIP_KEYWORDS = [
  'iim', 'iit', 'srcc', 'sscbs', 'shri ram', 'bits', 'xlri', 'fms',
  'stephen', 'hansraj', 'hindu', "l'oreal", 'loreal', 'tata', 'hul',
  'hindustan unilever', 'aditya birla', 'mckinsey', 'bain', 'bcg',
  'boston consulting', 'kearney', 'ey', 'deloitte', 'pwc', 'kpmg',
  'reliance', 'amazon', 'flipkart', 'google', 'microsoft', 'tvs',
  'optum', 'marico', 'itc', 'mondelez', 'reckitt', 'accenture'
];

export async function fetchCompetitionsFromUnstop() {
  const url = 'https://unstop.com/api/public/opportunity/search-result?opportunity=competitions&subType=case-competitions&eligible=undergraduate-students&per_page=50';
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
    },
  });

  if (!response.ok) {
    throw new Error(`Unstop API returned status: ${response.status}`);
  }

  const json = await response.json();
  const rawList = json?.data?.data || [];
  const now = Date.now();

  const formatted = rawList
    .filter(item => {
      const regStatus = item.regnRequirements?.reg_status;
      const remainDays = item.regnRequirements?.remain_days || '';
      if (regStatus === 'FINISHED') return false;
      if (remainDays.toLowerCase().includes('ended')) return false;

      if (item.regnRequirements?.end_regn_dt) {
        const deadlineTime = new Date(item.regnRequirements.end_regn_dt).getTime();
        if (deadlineTime < now) return false;
      }
      return true;
    })
    .map(item => {
      const orgName = item.organisation?.name || 'Academic Institution';
      const lowerOrg = orgName.toLowerCase();
      const lowerTitle = (item.title || '').toLowerCase();

      const isFlagship = FLAGSHIP_KEYWORDS.some(kw => lowerOrg.includes(kw) || lowerTitle.includes(kw));

      const minTeam = item.regnRequirements?.min_team_size || 1;
      const maxTeam = item.regnRequirements?.max_team_size || 4;
      const isFree = !item.isPaid;
      const isFirstYearFriendly = isFree && (maxTeam >= 1 && maxTeam <= 5);

      let prizeDisplay = 'Certificates & Recognition';
      if (Array.isArray(item.prizes) && item.prizes.length > 0) {
        const maxCash = item.prizes.reduce((max, p) => (p.cash && p.cash > max ? p.cash : max), 0);
        if (maxCash > 0) {
          prizeDisplay = `₹${maxCash.toLocaleString('en-IN')} Cash Pool`;
        } else if (item.prizes.some(p => p.rank)) {
          prizeDisplay = item.prizes.map(p => p.rank).filter(Boolean).slice(0, 2).join(' · ');
        }
      }

      const remainDaysText = item.regnRequirements?.remain_days || 'Ongoing';
      let daysRemainingNum = 999;
      if (item.regnRequirements?.end_regn_dt) {
        const diffMs = new Date(item.regnRequirements.end_regn_dt).getTime() - now;
        daysRemainingNum = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }

      const urgency = daysRemainingNum <= 2 ? 'high' : daysRemainingNum <= 5 ? 'medium' : 'normal';

      return {
        id: item.id || item.short_id || String(Math.random()),
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
        isFirstYearFriendly,
        registeredCount: item.registerCount || 0,
        viewsCount: item.viewsCount || 0,
      };
    });

  return formatted;
}

export default async function handler(req, res) {
  try {
    const competitions = await fetchCompetitionsFromUnstop();

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
      error: error.message || 'Failed to fetch competitions',
    });
  }
}
