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

// Strict eligibility check: Only allow competitions that undergraduates can participate in
function isUndergradEligible(item) {
  if (!item) return false;

  const filterNames = (item.filters || []).map(f => (f.name || '').toLowerCase().trim());
  const hasAll = filterNames.length === 0 || filterNames.includes('all');
  const hasUG = filterNames.some(f => f.includes('undergraduate'));
  const hasPG = filterNames.some(f => f.includes('postgraduate'));
  const isSchoolOnly = filterNames.length > 0 && filterNames.every(f => f.includes('school'));
  
  const title = (item.title || '').toLowerCase();
  const mbaOnlyTitle = /\b(mba\s+only|pgdm\s+only|postgraduate\s+only|only\s+for\s+mba|mba\s+students\s+only|only\s+mba)\b/i.test(title);

  // Strictly exclude if MBA/Postgraduate only, school-only, or MBA-only in title
  if ((hasPG && !hasUG && !hasAll) || mbaOnlyTitle || isSchoolOnly) {
    return false;
  }

  // Check structured registration eligibility payload from Unstop
  let regnEligibility = item.regnRequirements?.eligibility;
  if (typeof regnEligibility === 'string') {
    try {
      regnEligibility = JSON.parse(regnEligibility);
    } catch (e) {}
  }

  if (regnEligibility && typeof regnEligibility === 'object') {
    const bSchools = Array.isArray(regnEligibility.bSchools) ? regnEligibility.bSchools : [];
    const arts = Array.isArray(regnEligibility.arts) ? regnEligibility.arts : [];
    const engineering = Array.isArray(regnEligibility.engineering) ? regnEligibility.engineering : [];
    const others = Array.isArray(regnEligibility.others) ? regnEligibility.others : [];

    // If strictly restricted to B-schools with no undergrad/arts/tech access
    if (bSchools.length > 0 && arts.length === 0 && engineering.length === 0 && (others.length === 0 || (others.length === 1 && others[0] === 'all' && hasPG && !hasUG))) {
      return false;
    }
  }

  return true;
}

function classifyOpportunity(item) {
  const type = (item.type || '').toLowerCase();
  const subtype = (item.subtype || item.subType || '').toLowerCase();
  const title = (item.title || '').toLowerCase();
  const filterNames = (item.filters || []).map(f => (f.name || '').toLowerCase());

  // 1. Hackathons & Coding Contests
  if (
    type === 'hackathons' ||
    subtype === 'online_coding_challenge' ||
    filterNames.some(f => f.includes('programming') || f.includes('hackathon') || f.includes('coding')) ||
    /\b(hackathon|codefest|coding|hack\b|devfest|web dev|app dev|fullstack|machine learning|ai\/ml|data science|datathon|cybersecurity|blockchain|dapp|algorithmic|kaggle)\b/i.test(title)
  ) {
    return { category: 'hackathon', categoryLabel: 'Hackathon', categoryEmoji: '💻' };
  }

  // 2. Simulations, Auctions & Mock Stocks
  if (
    filterNames.some(f => f.includes('simulation')) ||
    /\b(auction\b|ipl auction|football auction|cricket auction|mock stock|stock trading|trading simulation|simulation game|deal room|portfolio management|bidding)\b/i.test(title)
  ) {
    return { category: 'simulation', categoryLabel: 'Simulation & Auction', categoryEmoji: '📈' };
  }

  // 3. Writing, Essays & Research Papers
  if (
    filterNames.some(f => f.includes('writing') || f.includes('essay') || f.includes('paper presentation')) ||
    /\b(article writing|essay writing|essay\b|paper presentation|research paper|editorial|journalism|case writing|call for papers|article\b|blog writing|white paper)\b/i.test(title)
  ) {
    return { category: 'writing', categoryLabel: 'Writing & Research', categoryEmoji: '✍️' };
  }

  // 4. Quizzes & Trivia
  if (
    type === 'quizzes' ||
    filterNames.some(f => f.includes('quiz') || f.includes('quizzing')) ||
    /\b(quiz\b|trivia\b|quizzing|brain teaser|inquisitive|inquizire|knowledge bowl)\b/i.test(title)
  ) {
    return { category: 'quiz', categoryLabel: 'Quiz & Trivia', categoryEmoji: '🧠' };
  }

  // 5. Debates & Model UN
  if (
    filterNames.some(f => f.includes('debate')) ||
    /\b(debate\b|debating|parliamentary debate|asian pd|turncoat|mun\b|model united nations|youth parliament|oratory)\b/i.test(title)
  ) {
    return { category: 'debate', categoryLabel: 'Debate & MUN', categoryEmoji: '🗣️' };
  }

  // 6. Case Competitions & Strategy (Core default)
  if (
    subtype === 'case_competition' ||
    subtype === 'case-competitions' ||
    filterNames.some(f => f.includes('case') || f.includes('strategy') || f.includes('business plan') || f.includes('marketing') || f.includes('entrepreneurship')) ||
    /\b(case\b|case study|case competition|consulting|strategy|b-plan|business plan|pitch deck|pitch\b|valuation|shark tank|ideathon|venture|entrepreneurship|consultant)\b/i.test(title)
  ) {
    return { category: 'case', categoryLabel: 'Case Comp', categoryEmoji: '📊' };
  }

  return { category: 'general', categoryLabel: 'General Comp', categoryEmoji: '🎯' };
}

export async function fetchCompetitionsFromUnstop() {
  const queryEndpoints = [
    // Category & Core Theme Keywords
    'opportunity=competitions&subType=case-competitions&per_page=50',
    'opportunity=competitions&searchTerm=case competitions&per_page=50',
    'opportunity=competitions&searchTerm=case study&per_page=50',
    'opportunity=competitions&searchTerm=case&per_page=50',
    'opportunity=competitions&searchTerm=consulting&per_page=50',
    'opportunity=competitions&searchTerm=strategy&per_page=50',
    'opportunity=competitions&searchTerm=b-plan&per_page=50',
    'opportunity=competitions&searchTerm=challenge&per_page=50',

    // Hackathons & Coding Contests
    'opportunity=hackathons&per_page=50',
    'opportunity=competitions&searchTerm=hackathon&per_page=50',
    'opportunity=competitions&searchTerm=coding&per_page=50',

    // Simulations, Auctions & Mock Stocks
    'opportunity=competitions&searchTerm=auction&per_page=50',
    'opportunity=competitions&searchTerm=mock stock&per_page=50',
    'opportunity=competitions&searchTerm=trading&per_page=50',

    // Writing, Research & Papers
    'opportunity=competitions&searchTerm=article writing&per_page=50',
    'opportunity=competitions&searchTerm=essay&per_page=50',
    'opportunity=competitions&searchTerm=paper presentation&per_page=50',

    // Quizzes & Trivia
    'opportunity=quizzes&per_page=50',
    'opportunity=competitions&searchTerm=quiz&per_page=50',

    // Debates & MUNs
    'opportunity=competitions&searchTerm=debate&per_page=50',
    'opportunity=competitions&searchTerm=mun&per_page=50',

    // Delhi University Circuit (Top Colleges)
    'opportunity=competitions&searchTerm=delhi university&per_page=50',
    'opportunity=competitions&searchTerm=du&per_page=50',
    'opportunity=competitions&searchTerm=sscbs&per_page=50',
    'opportunity=competitions&searchTerm=srcc&per_page=50',
    'opportunity=competitions&searchTerm=hindu&per_page=50',
    'opportunity=competitions&searchTerm=miranda&per_page=50',
    'opportunity=competitions&searchTerm=hansraj&per_page=50',
    'opportunity=competitions&searchTerm=kirori mal&per_page=50',
    'opportunity=competitions&searchTerm=ramjas&per_page=50',
    'opportunity=competitions&searchTerm=lsr&per_page=50',
    'opportunity=competitions&searchTerm=stephen&per_page=50',
    'opportunity=competitions&searchTerm=sggscc&per_page=50',
    'opportunity=competitions&searchTerm=venky&per_page=50',
    'opportunity=competitions&searchTerm=gargi&per_page=50',

    // Premier National B-Schools & Tech
    'opportunity=competitions&searchTerm=iim&per_page=50',
    'opportunity=competitions&searchTerm=iit&per_page=50',
    'opportunity=competitions&searchTerm=xlri&per_page=50',
    'opportunity=competitions&searchTerm=isb&per_page=50',
    'opportunity=competitions&searchTerm=mdi&per_page=50',

    // Corporate Challenges
    'opportunity=competitions&searchTerm=corporate&per_page=50',
    'opportunity=competitions&searchTerm=loreal&per_page=50'
  ];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
  };

  const fetchChunk = (chunk) =>
    Promise.all(
      chunk.map(q =>
        fetch(`https://unstop.com/api/public/opportunity/search-result?${q}`, { headers })
          .then(res => (res.ok ? res.json() : null))
          .then(json => (json?.data?.data || []))
          .catch(err => {
            console.warn(`Error querying Unstop for [${q}]:`, err.message);
            return [];
          })
      )
    );

  const chunk1 = queryEndpoints.slice(0, 12);
  const chunk2 = queryEndpoints.slice(12, 24);
  const chunk3 = queryEndpoints.slice(24);
  const [res1, res2, res3] = await Promise.all([
    fetchChunk(chunk1),
    fetchChunk(chunk2),
    fetchChunk(chunk3)
  ]);
  const batches = [...res1, ...res2, ...res3];
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

      // Strictly exclude non-undergraduate (MBA/PG only, school only) competitions
      if (!isUndergradEligible(item)) continue;

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

    // Multi-track discipline classification
    const { category, categoryLabel, categoryEmoji } = classifyOpportunity(item);

    const minTeam = item.regnRequirements?.min_team_size || 1;
    const maxTeam = item.regnRequirements?.max_team_size || 4;
    const isFree = !item.isPaid;
    const isFirstYearFriendly = isFree && (maxTeam >= 1 && maxTeam <= 5);

    // Extract prizes: calculate true cumulative cash pool across all positions
    let prizeDisplay = 'Certificates & Recognition';
    if (Array.isArray(item.prizes) && item.prizes.length > 0) {
      const totalCash = item.prizes.reduce((sum, p) => sum + (Number(p.cash) || 0), 0);
      if (totalCash > 0) {
        prizeDisplay = `₹${totalCash.toLocaleString('en-IN')} Cash Pool`;
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
      category,
      categoryLabel,
      categoryEmoji,
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
      isUndergradEligible: true,
    };
  });

  // Sort: Exact closing deadline timestamp first, then by registrations
  formatted.sort((a, b) => {
    const timeA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const timeB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    const validA = !isNaN(timeA) ? timeA : Infinity;
    const validB = !isNaN(timeB) ? timeB : Infinity;
    if (validA !== validB) return validA - validB;
    return (b.registeredCount || 0) - (a.registeredCount || 0);
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
