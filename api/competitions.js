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
  'delhi university', 'university of delhi', '(du)', 'sscbs', 'shaheed sukhdev',
  'srcc', 'shri ram college', 'stephen', 'hindu', 'hansraj', 'lsr', 'lady shri ram',
  'sggscc', 'ramjas', 'kirori mal', 'kmc', 'drc', 'daulat ram', 'gargi', 'venkateswara',
  'venky', 'sgtb khalsa', 'khalsa', 'keshav mahavidyalaya', 'deen dayal upadhyaya', 'ddu',
  'miranda', 'jesus and mary', 'jmc', 'atma ram', 'arsd', 'sbsc', 'shaheed bhagat singh',
  'motilal nehru', 'indraprastha college', 'ipcw', 'maharaja agrasen', 'ramanujan'
];

const IIM_KEYWORDS = [
  'iim', 'indian institute of management', 'iim ahmedabad', 'iim bangalore', 'iim calcutta',
  'iim lucknow', 'iim kozhikode', 'iim indore', 'iim shillong', 'iim ranchi', 'iim rohtak',
  'iim trichy', 'iim kashipur', 'iim udaipur', 'iim bodh gaya', 'iim jammu', 'iim sambalpur',
  'iim sirmaur', 'iim visakhapatnam', 'iim amritsar', 'iim nagpur', 'iim raipur'
];

const IIT_KEYWORDS = [
  'iit', 'indian institute of technology', 'iit bombay', 'iit delhi', 'iit madras',
  'iit kanpur', 'iit kharagpur', 'iit roorkee', 'iit guwahati', 'iit bhu', 'iit hyderabad',
  'iit dhanbad', 'iit indore', 'iit mandi', 'iit varanasi', 'iit gandhinagar', 'iit patna',
  'iit jodhpur', 'iit ropar', 'iit tirupati', 'iit palakkad', 'iit dharwad', 'iit bhilai',
  'iit goa', 'doms', 'dms', 'sjmsom', 'vgsom'
];

const OTHER_MBA_KEYWORDS = [
  'isb', 'indian school of business', 'xlri', 'xavier school of management', 'xavier labour',
  'xavier', 'mdi', 'management development institute', 'mdi gurgaon', 'mdi murshidabad',
  'fms', 'faculty of management studies', 'spjimr', 'sp jain', 's.p. jain', 'sibm', 'symbiosis',
  'scmhrd', 'siom', 'nmims', 'narsee monjee', 'iift', 'indian institute of foreign trade',
  'great lakes', 'glim', 'tapmi', 't. a. pai', 'imt', 'imt ghaziabad', 'gim', 'goa institute of management',
  'k j somaiya', 'somaiya', 'simsr', 'fore', 'fore school', 'lbsim', 'lal bahadur shastri',
  'bits', 'bits pilani', 'mica', 'mudra institute', 'irma', 'institute of rural management',
  'tiss', 'tata institute of social sciences', 'jbims', 'jamnalal bajaj'
];

const CORPORATE_KEYWORDS = [
  "l'oreal", 'loreal', 'brandstorm', 'tata', 'tata steel', 'tata motors', 'tata crucible',
  'tata imagination', 'tcs', 'hul', 'hindustan unilever', 'lime', 'unilever', 'itc',
  'interrobang', 'marico', 'over the wall', 'mondelez', 'reckitt', 'nestle', 'p&g',
  'procter & gamble', 'pepsico', 'coca-cola', 'coke', 'aditya birla', 'stratfresh', 'abg',
  'reliance', 'jio', 'reliance retail', 'mahindra', 'war room', 'mckinsey', 'bain', 'bcg',
  'boston consulting', 'kearney', 'oliver wyman', 'strategy&', 'ey', 'ernst & young', 'deloitte',
  'pwc', 'kpmg', 'grant thornton', 'bdo', 'amazon', 'flipkart', 'google', 'microsoft', 'apple',
  'meta', 'uber', 'swiggy', 'zomato', 'tvs', 'tvs credit', 'optum', 'stratethon', 'accenture',
  'standard chartered', 'hsbc', 'citi', 'citigroup', 'jpmorgan', 'jp morgan', 'morgan stanley',
  'goldman sachs', 'american express', 'amex', 'hdfc', 'icici', 'axis bank', 'kotak', 'bajaj',
  'bajaj finserv', 'hero', 'hero motocorp', 'airtel', 'vodafone', 'asian paints', 'berger paints',
  'wipro', 'infosys', 'cognizant', 'capgemini', 'hcl', 'corporate', 'enterprise', 'industry'
];

function matchesKeyword(text, keyword) {
  if (keyword.length <= 4 && /^[a-z0-9]+$/i.test(keyword)) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    return regex.test(text);
  }
  return text.includes(keyword);
}

export async function fetchCompetitionsFromUnstop() {
  const queryEndpoints = [
    'opportunity=competitions&subType=case-competitions&per_page=50',
    'opportunity=competitions&searchTerm=case&per_page=50',
    'opportunity=competitions&searchTerm=case study&per_page=50',
    'opportunity=competitions&searchTerm=consulting&per_page=50',
    'opportunity=competitions&searchTerm=strategy&per_page=50',
    'opportunity=competitions&searchTerm=delhi university&per_page=50',
    'opportunity=competitions&searchTerm=du&per_page=50',
    'opportunity=competitions&searchTerm=srcc&per_page=50',
    'opportunity=competitions&searchTerm=sscbs&per_page=50',
    'opportunity=competitions&searchTerm=lsr&per_page=50',
    'opportunity=competitions&searchTerm=stephen&per_page=50',
    'opportunity=competitions&searchTerm=sggscc&per_page=50',
    'opportunity=competitions&searchTerm=iim&per_page=50',
    'opportunity=competitions&searchTerm=iit&per_page=50',
    'opportunity=competitions&searchTerm=xlri&per_page=50',
    'opportunity=competitions&searchTerm=isb&per_page=50',
    'opportunity=competitions&searchTerm=mdi&per_page=50',
    'opportunity=competitions&searchTerm=corporate&per_page=50',
    'opportunity=competitions&searchTerm=loreal&per_page=50',
    'opportunity=competitions&searchTerm=b-plan&per_page=50',
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
    const isDU = DU_KEYWORDS.some(kw => matchesKeyword(combined, kw));
    const isIIM = IIM_KEYWORDS.some(kw => matchesKeyword(combined, kw));
    const isIIT = IIT_KEYWORDS.some(kw => matchesKeyword(combined, kw));
    const isIIMorIIT = isIIM || isIIT;
    const isOtherMba = OTHER_MBA_KEYWORDS.some(kw => matchesKeyword(combined, kw));
    const isCorporate = CORPORATE_KEYWORDS.some(kw => matchesKeyword(combined, kw));
    const isOtherMbaOrCorporate = (isOtherMba || isCorporate) && !isDU && !isIIMorIIT;
    const isFlagship = FLAGSHIP_KEYWORDS.some(kw => matchesKeyword(combined, kw));

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
      isIIM,
      isIIT,
      isIIMorIIT,
      isOtherMba,
      isCorporate,
      isOtherMbaOrCorporate,
      isIIMorMBA: isIIM || isOtherMba,
      isIITorTech: isIIT,
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
