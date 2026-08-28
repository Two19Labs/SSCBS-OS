// SSCBS Society Recruitment Data Store - Official Full Names & Direct LinkedIn Page Links

export const OFFICIAL_COLLEGE_SOCIETIES_URL = 'https://sscbs.du.ac.in/societies/';

export const CATEGORIES = [
  { id: 'all', label: 'All Domains (47)', icon: '⚡' },
  { id: 'finance', label: 'Finance & Accounting', icon: '📈' },
  { id: 'consulting', label: 'Consulting & Analytics', icon: '💼' },
  { id: 'ecell', label: 'Startups & Social Impact', icon: '🚀' },
  { id: 'tech', label: 'Tech & IT', icon: '💻' },
  { id: 'marketing', label: 'Marketing, PR & Corporate', icon: '📣' },
  { id: 'economics', label: 'Economics, Law & Policy', icon: '🌐' },
  { id: 'debating', label: 'Debating, Media & Lit', icon: '🎙️' },
  { id: 'cultural', label: 'Arts & Culture', icon: '🎭' },
  { id: 'wellness', label: 'Inclusion & Sports', icon: '🤝' },
];

export const DEMO_SOCIETIES = [
  // --- 1. ACM SSCBS Chapter ---
  {
    id: 'acm-sscbs',
    pocs: [
      {
        "name": "Kalpana Chauhan",
        "phone": "9729886159"
      },
      {
        "name": "Ishika Mandhar",
        "phone": "7505346807"
      }
    ],
    name: 'ACM SSCBS Student Chapter',
    shortName: 'ACM',
    category: 'tech',
    categoryLabel: 'Tech & IT',
    categories: ['tech', 'consulting'],
    categoryLabels: ['Tech & IT', 'Consulting & Analytics'],
    description: 'Official student chapter of Association for Computing Machinery. Recruitments will start soon, forms and info will come here soon!',
    recruitmentFormUrl: null,
    deadline: null,
    statusText: 'Recruitments will start soon, forms and info will come here soon!',
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbZ5twHyO9E/?igsh=MTF4MXdwM3o4bDJwbw==&igsi=MTF4MXdwM3o4bDJwbw==',
    linkedinUrl: 'https://www.linkedin.com/company/acm-sscbs',
    defaultBookmarked: false,
    accentColor: '#8b5cf6',
  },

  // --- 2. Alumni Relations and Outreach Cell ---
  {
    id: 'alumni-cell',
    pocs: [
      {
        "name": "Krishna Pransukhka",
        "phone": "9586061867"
      },
      {
        "name": "Avani Gupta",
        "phone": "9810660939"
      }
    ],
    name: 'Alumni Relations and Outreach Cell (AROC), SSCBS',
    shortName: 'Alumni Cell',
    category: 'marketing',
    categoryLabel: 'Marketing, PR & Corporate',
    categories: ['marketing', 'consulting'],
    categoryLabels: ['Marketing, PR & Corporate', 'Consulting & Analytics'],
    description: 'Connecting alumni networks and mentorship programs. Recruitments will start soon, forms and info will come here soon!',
    recruitmentFormUrl: null,
    deadline: null,
    statusText: 'Recruitments will start soon, forms and info will come here soon!',
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/Dbim_ziOhex/?igsh=MTh6aTh2NnMwczhwcg==&igsi=MTh6aTh2NnMwczhwcg==',
    linkedinUrl: 'https://www.linkedin.com/company/aroc-sscbs',
    defaultBookmarked: false,
    accentColor: '#e11d48',
  },

  // --- 3. Anthropos ---
  {
    id: 'anthropos-hrd',
    pocs: [
      {
        "name": "Lala Dhruv Raj",
        "phone": "7011661221"
      },
      {
        "name": "Abhigya Yadav",
        "phone": "8076467727"
      }
    ],
    name: 'Anthropos – The Human Resource Development Cell of SSCBS',
    shortName: 'Anthropos',
    category: 'consulting',
    categoryLabel: 'Consulting & Analytics',
    categories: ['consulting', 'marketing'],
    categoryLabels: ['Consulting & Analytics', 'Marketing, PR & Corporate'],
    description: 'Human Resource Development cell (PoorvAbhyas mock interviews). Recruitments will start soon, forms and info will come here soon!',
    recruitmentFormUrl: null,
    deadline: null,
    statusText: 'Recruitments will start soon, forms and info will come here soon!',
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/anthroposhrdc?igsh=bDdkdjh0d2Jzbzd3&igsi=bDdkdjh0d2Jzbzd3',
    linkedinUrl: 'https://www.linkedin.com/company/anthropos-cbs',
    defaultBookmarked: false,
    accentColor: '#3b82f6',
  },

  // --- 4. Blitz (Dance Society) ---
  {
    id: 'blitz-dance',
    pocs: [
      {
        "name": "Avantika Goel",
        "phone": "7982226421"
      },
      {
        "name": "Shreyansh Sharma",
        "phone": "8340546557"
      }
    ],
    name: 'Blitz – The Western Dance Society of SSCBS',
    shortName: 'Blitz',
    category: 'cultural',
    categoryLabel: 'Arts & Culture',
    categories: ['cultural'],
    categoryLabels: ['Arts & Culture'],
    description: 'Western choreography and urban dance society. Recruitments will start soon, forms and info will come here soon!',
    recruitmentFormUrl: null,
    deadline: null,
    statusText: 'Recruitments will start soon, forms and info will come here soon!',
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbVhG6pyQph/?igsh=MWlweThkazFheHkzZA==&igsi=MWlweThkazFheHkzZA==',
    linkedinUrl: 'https://www.linkedin.com/company/blitz-the-western-dance-society-of-sscbs',
    defaultBookmarked: false,
    accentColor: '#06b6d4',
  },

  // --- 5. CBS Model United Nations ---
  {
    id: 'cbsmun',
    pocs: [
      {
        "name": "Rithik Palthiya",
        "phone": "9398681351"
      },
      {
        "name": "Kartik Kumar",
        "phone": "9266391356"
      }
    ],
    name: 'CBS Model United Nations (CBSMUN)',
    shortName: 'CBSMUN',
    category: 'economics',
    categoryLabel: 'Economics, Law & Policy',
    categories: ['economics', 'debating'],
    categoryLabels: ['Economics, Law & Policy', 'Debating, Media & Lit'],
    description: 'Simulating global diplomacy, international security, and MUN fests. Recruitments will start soon, forms and info will come here soon!',
    recruitmentFormUrl: null,
    deadline: null,
    statusText: 'Recruitments will start soon, forms and info will come here soon!',
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/cbsmun_du/',
    linkedinUrl: 'https://www.linkedin.com/company/cbsmun',
    defaultBookmarked: false,
    accentColor: '#0369a1',
  },

  // --- 6. CII YI Chapter ---
  {
    id: 'cii-yi',
    pocs: [
      {
        "name": "Soyal Dhawle",
        "phone": "8602383455"
      },
      {
        "name": "Keerthi Dumpala",
        "phone": "9650550141"
      }
    ],
    name: 'CII Yi Chapter – Confederation of Indian Industry Young Indians, SSCBS',
    shortName: 'CII YI',
    category: 'marketing',
    categoryLabel: 'Marketing, PR & Corporate',
    categories: ['marketing', 'ecell'],
    categoryLabels: ['Marketing, PR & Corporate', 'Startups & Social Impact'],
    scheduledForm: {
      liveFrom: '2026-08-28T17:00:00+05:30',
      recruitmentFormUrl: 'https://forms.gle/uAez4N2X6DhySucy8',
      deadline: '2026-08-29T23:59:59+05:30',
    },
    get recruitmentFormUrl() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.recruitmentFormUrl;
      }
      return null;
    },
    get deadline() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.deadline;
      }
      return null;
    },
    get statusText() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return null;
      }
      return 'Recruitments will start soon, forms and info will come here soon!';
    },
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbVjFiFIuNL/?utm_source=ig_web_copy_link',
    linkedinUrl: 'https://www.linkedin.com/company/yi-yuva-sscbs',
    defaultBookmarked: false,
    accentColor: '#fb7185',
  },

  // --- 7. Collegiate Entrepreneurs Organisation (CEO, DU) ---
  {
    id: 'ceo-du',
    pocs: [
      {
        "name": "Shreya Choudhary",
        "phone": "8899552223"
      },
      {
        "name": "Arjun Sethi",
        "phone": "8800616929"
      }
    ],
    name: 'CEO DU – Collegiate Entrepreneurs\' Organisation, Delhi University (SSCBS Chapter)',
    shortName: 'CEO DU',
    category: 'ecell',
    categoryLabel: 'Startups & Social Impact',
    categories: ['ecell', 'consulting'],
    categoryLabels: ['Startups & Social Impact', 'Consulting & Analytics'],
    description: 'Fostering startup founders and incubation mentorship. Recruitments will start soon, forms and info will come here soon!',
    scheduledForm: {
      liveFrom: '2026-08-28T17:00:00+05:30',
      recruitmentFormUrl: 'https://forms.gle/6SwWBJFsrzJAXUcz9',
      deadline: '2026-08-29T23:59:59+05:30',
    },
    get recruitmentFormUrl() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.recruitmentFormUrl;
      }
      return null;
    },
    get deadline() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.deadline;
      }
      return null;
    },
    get statusText() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return null;
      }
      return 'Recruitments will start soon, forms and info will come here soon!';
    },
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DNBVwNypSlm/?igsh=d2xmZ2xjOTVpd2sy',
    linkedinUrl: 'https://www.linkedin.com/company/the-collegiate-entrepreneurs-organisation-delhi-university',
    defaultBookmarked: false,
    accentColor: '#d97706',
  },

  // --- 8. Communique (The Promotion Cell / Prodigy) ---
  {
    id: 'communique-pr',
    pocs: [
      {
        "name": "Madhav Singhal",
        "phone": "8595552700"
      },
      {
        "name": "Chinar Ahuja",
        "phone": "8800265955"
      }
    ],
    name: 'Communiqué – The Branding & Communication Cell of SSCBS',
    shortName: 'Communique',
    category: 'marketing',
    categoryLabel: 'Marketing, PR & Corporate',
    categories: ['marketing', 'consulting', 'finance'],
    categoryLabels: ['Marketing, PR & Corporate', 'Consulting & Analytics', 'Finance & Accounting'],
    scheduledForm: {
      liveFrom: '2026-08-28T17:00:00+05:30',
      recruitmentFormUrl: 'https://tally.so/r/RGybvJ',
      deadline: '2026-08-29T12:00:00+05:30',
    },
    get recruitmentFormUrl() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.recruitmentFormUrl;
      }
      return null;
    },
    get deadline() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.deadline;
      }
      return null;
    },
    get statusText() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return null;
      }
      return 'Recruitments will start soon, forms and info will come here soon!';
    },
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbYBdyZS6Vb/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==',
    linkedinUrl: 'https://www.linkedin.com/company/communique-the-public-relations-cell-of-sscbs',
    defaultBookmarked: false,
    accentColor: '#db2777',
  },

  // --- 9. Convergence (College Seminar) ---
  {
    id: 'convergence-seminar',
    pocs: [
      {
        "name": "Suditi Sharma",
        "phone": "9560287817"
      },
      {
        "name": "Harsh Raj",
        "phone": "9661294118"
      }
    ],
    name: 'Convergence – The Annual Leadership Summit Committee of SSCBS',
    shortName: 'Convergence',
    category: 'marketing',
    categoryLabel: 'Marketing, PR & Corporate',
    categories: ['marketing', 'consulting'],
    categoryLabels: ['Marketing, PR & Corporate', 'Consulting & Analytics'],
    description: 'Organizing committee for SSCBS flagship national leadership seminars. Recruitments will start soon, forms and info will come here soon!',
    recruitmentFormUrl: null,
    deadline: null,
    statusText: 'Recruitments will start soon, forms and info will come here soon!',
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbVWQ7nTBQs/?igsh=MWE1d2wxaTc2bGk4Zg==',
    linkedinUrl: 'https://www.linkedin.com/company/convergencesscbs',
    defaultBookmarked: false,
    accentColor: '#fda4af',
  },

  // --- 11. Darkroom (Photography Society) ---
  {
    id: 'darkroom-photography',
    pocs: [
      {
        "name": "Gajanan Ingewad",
        "phone": "9763907304"
      },
      {
        "name": "Prikshit Maan",
        "phone": "9518167519"
      }
    ],
    name: 'The Darkroom – The Photography & Visual Arts Society of SSCBS',
    shortName: 'Darkroom',
    category: 'cultural',
    categoryLabel: 'Arts & Culture',
    categories: ['cultural', 'debating'],
    categoryLabels: ['Arts & Culture', 'Debating, Media & Lit'],
    description: 'Visual arts, photojournalism, filmmaking, and video editing. Recruitments will start soon, forms and info will come here soon!',
    recruitmentFormUrl: null,
    deadline: null,
    statusText: 'Recruitments will start soon, forms and info will come here soon!',
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbaG3aMpQB9/?igsh=MWkwMDhsbGNiNnp3cA==',
    linkedinUrl: 'https://www.linkedin.com/company/the-darkroom-cbs',
    defaultBookmarked: false,
    accentColor: '#164e63',
  },

  // --- 12. Debating Society ---
  {
    id: 'debating-society',
    pocs: [
      {
        "name": "Sneh Shukla",
        "phone": "9560089840"
      },
      {
        "name": "Aiwin CT",
        "phone": "9037466409"
      }
    ],
    name: 'CBS DebSoc – The Debating Society of SSCBS',
    shortName: 'DebSoc',
    category: 'debating',
    categoryLabel: 'Debating, Media & Lit',
    categories: ['debating', 'economics'],
    categoryLabels: ['Debating, Media & Lit', 'Economics, Law & Policy'],
    description: 'Parliamentary debating and oratorical competitions. Recruitments will start soon, forms and info will come here soon!',
    scheduledForm: {
      liveFrom: '2026-08-28T17:00:00+05:30',
      recruitmentFormUrl: 'https://forms.gle/5q4LDUYQBafCeeoE6',
      initialDeadline: '2026-08-29T13:00:00+05:30',
      extensionTrigger: '2026-08-29T12:55:00+05:30',
      extendedDeadline: '2026-08-29T17:00:00+05:30',
    },
    get recruitmentFormUrl() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.recruitmentFormUrl;
      }
      return null;
    },
    get deadline() {
      if (!this.scheduledForm) return null;
      const now = new Date();
      if (now < new Date(this.scheduledForm.liveFrom)) {
        return null;
      }
      if (this.scheduledForm.extensionTrigger && now >= new Date(this.scheduledForm.extensionTrigger)) {
        return this.scheduledForm.extendedDeadline;
      }
      return this.scheduledForm.initialDeadline;
    },
    get statusText() {
      if (!this.scheduledForm) return 'Recruitments will start soon, forms and info will come here soon!';
      const now = new Date();
      if (now < new Date(this.scheduledForm.liveFrom)) {
        return 'Recruitments will start soon, forms and info will come here soon!';
      }
      return null;
    },
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/cbsdebsoc/',
    linkedinUrl: 'https://www.linkedin.com/company/cbs-debating-society',
    defaultBookmarked: false,
    accentColor: '#831843',
  },

  // --- 13. Dhwani (Music Society) ---
  {
    id: 'dhwani-music',
    pocs: [
      {
        "name": "Shreya Pandey",
        "phone": "8454843952"
      },
      {
        "name": "Trisha Singh",
        "phone": "7428240131"
      }
    ],
    name: 'Dhwani – The Music Society of SSCBS',
    shortName: 'Dhwani',
    category: 'cultural',
    categoryLabel: 'Arts & Culture',
    categories: ['cultural'],
    categoryLabels: ['Arts & Culture'],
    description: 'Vocalists, instrumentalists, and college band performances. Recruitments will start soon, forms and info will come here soon!',
    recruitmentFormUrl: null,
    deadline: null,
    statusText: 'Recruitments will start soon, forms and info will come here soon!',
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbV_shCBMco/?utm_source=ig_web_copy_link',
    linkedinUrl: 'https://www.linkedin.com/company/dhwani-sscbs',
    defaultBookmarked: false,
    accentColor: '#0891b2',
  },

  // --- 14. Ecovision (Economics Society) ---
  {
    id: 'ecovision-economics',
    pocs: [
      {
        "name": "Kanish Garg",
        "phone": "7206704994"
      },
      {
        "name": "Dhriti Singla",
        "phone": "9665131422"
      }
    ],
    name: 'Ecovision – The Economics Society of SSCBS',
    shortName: 'Ecovision',
    category: 'economics',
    categoryLabel: 'Economics, Law & Policy',
    categories: ['economics', 'consulting'],
    categoryLabels: ['Economics, Law & Policy', 'Consulting & Analytics'],
    description: 'Macroeconomic research, policy debates, and EcoSummit. Recruitments will start soon, forms and info will come here soon!',
    scheduledForm: {
      liveFrom: '2026-08-28T17:00:00+05:30',
      recruitmentFormUrl: 'https://bit.ly/Ecovision_Recruitments_2026-27',
      deadline: '2026-08-29T23:59:59+05:30',
    },
    get recruitmentFormUrl() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.recruitmentFormUrl;
      }
      return null;
    },
    get deadline() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.deadline;
      }
      return null;
    },
    get statusText() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return null;
      }
      return 'Recruitments will start soon, forms and info will come here soon!';
    },
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbWBRpFykcl/?utm_source=ig_web_copy_link',
    linkedinUrl: 'https://www.linkedin.com/company/ecovisioncbs',
    defaultBookmarked: false,
    accentColor: '#0284c7',
  },

  // --- 15. Enactus ---
  {
    id: 'enactus-sscbs',
    pocs: [
      {
        name: 'Enactus POC',
        phone: '7467840660'
      }
    ],
    name: 'Enactus SSCBS',
    shortName: 'Enactus',
    category: 'ecell',
    categoryLabel: 'Startups & Social Impact',
    categories: ['ecell', 'consulting', 'finance'],
    categoryLabels: ['Startups & Social Impact', 'Consulting & Analytics', 'Finance & Accounting'],
    description: 'World Cup winning social entrepreneurship society launching sustainable business ventures. Recruitments will start soon, forms and info will come here soon!',
    recruitmentFormUrl: null,
    deadline: null,
    statusText: 'Recruitments will start soon, forms and info will come here soon!',
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbaPwlIzUG6/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==&igsi=MzRlODBiNWFlZA==',
    linkedinUrl: 'https://www.linkedin.com/company/enactus-sscbs',
    defaultBookmarked: false,
    accentColor: '#f59e0b',
  },

  // --- 16. FMA ---
  {
    id: 'fma-finance',
    pocs: [
      {
        "name": "Chirag Malhotra",
        "phone": "9310803388"
      },
      {
        "name": "Arnuv Gupta",
        "phone": "9354959517"
      }
    ],
    name: 'FMA – Financial Management Association, SSCBS',
    shortName: 'FMA',
    category: 'finance',
    categoryLabel: 'Finance & Accounting',
    categories: ['finance', 'consulting'],
    categoryLabels: ['Finance & Accounting', 'Consulting & Analytics'],
    description: 'Financial Management Association fostering practical corporate finance modeling. Recruitments will start soon, forms and info will come here soon!',
    scheduledForm: {
      liveFrom: '2026-08-28T17:00:00+05:30',
      recruitmentFormUrl: 'https://forms.gle/cE3C7ypU7k5x6Lgs5',
      initialDeadline: '2026-08-29T02:00:00+05:30',
      extensionTrigger: '2026-08-29T01:55:00+05:30',
      extendedDeadline: '2026-08-29T09:00:00+05:30',
    },
    get recruitmentFormUrl() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.recruitmentFormUrl;
      }
      return null;
    },
    get deadline() {
      if (!this.scheduledForm) return null;
      const now = new Date();
      if (now < new Date(this.scheduledForm.liveFrom)) {
        return null;
      }
      if (this.scheduledForm.extensionTrigger && now >= new Date(this.scheduledForm.extensionTrigger)) {
        return this.scheduledForm.extendedDeadline;
      }
      return this.scheduledForm.initialDeadline;
    },
    get statusText() {
      if (!this.scheduledForm) return 'Recruitments will start soon, forms and info will come here soon!';
      const now = new Date();
      if (now < new Date(this.scheduledForm.liveFrom)) {
        return 'Recruitments will start soon, forms and info will come here soon!';
      }
      return null;
    },
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbYzG9mzd03/?igsh=dmMzcm5ja281Ynpx',
    linkedinUrl: 'https://www.linkedin.com/company/fma-du-sscbs',
    defaultBookmarked: false,
    accentColor: '#047857',
  },

  // --- 17. Finx (Finance Society) ---
  {
    id: 'finx-finance',
    pocs: [
      {
        "name": "Viddushi Kheraa",
        "phone": "7290096206"
      },
      {
        "name": "Norvin Chowdhary",
        "phone": "9990048844"
      }
    ],
    name: 'FinX – The Finance Society of SSCBS',
    shortName: 'Finx',
    category: 'finance',
    categoryLabel: 'Finance & Accounting',
    categories: ['finance', 'consulting'],
    categoryLabels: ['Finance & Accounting', 'Consulting & Analytics'],
    description: 'Premier finance society running student investment funds and FinWiz. Recruitments will start soon, forms and info will come here soon!',
    scheduledForm: {
      liveFrom: '2026-08-28T17:00:00+05:30',
      recruitmentFormUrl: 'https://forms.gle/2xjVngeJpyEFDpEG9',
      deadline: '2026-08-29T11:00:00+05:30',
    },
    get recruitmentFormUrl() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.recruitmentFormUrl;
      }
      return null;
    },
    get deadline() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.deadline;
      }
      return null;
    },
    get statusText() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return null;
      }
      return 'Recruitments will start soon, forms and info will come here soon!';
    },
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbYWiMCh784/?igsh=MXJyd2VjamVrMWJxOA==',
    linkedinUrl: 'https://www.linkedin.com/company/finx---the-finance-society-of-sscbs',
    defaultBookmarked: false,
    accentColor: '#10b981',
  },

  // --- 18. Fourth Wall (Dramatics Society) ---
  {
    id: 'fourth-wall-dramatics',
    pocs: [
      {
        "name": "Sarthak Pandey",
        "phone": "8766614877"
      },
      {
        "name": "Harish Mathan",
        "phone": "7550120316"
      }
    ],
    name: 'Fourth Wall Productions – The Dramatics Society of SSCBS',
    shortName: 'Fourth Wall',
    category: 'cultural',
    categoryLabel: 'Arts & Culture',
    categories: ['cultural', 'debating'],
    categoryLabels: ['Arts & Culture', 'Debating, Media & Lit'],
    description: 'Stage play and dramatics society crafting theatrical productions. Recruitments will start soon, forms and info will come here soon!',
    scheduledForm: {
      liveFrom: '2026-08-28T17:00:00+05:30',
      recruitmentFormUrl: 'https://forms.gle/7FFRqNhAidduHtUG8',
      deadline: '2026-08-30T23:59:59+05:30',
    },
    get recruitmentFormUrl() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.recruitmentFormUrl;
      }
      return null;
    },
    get deadline() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.deadline;
      }
      return null;
    },
    get statusText() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return null;
      }
      return 'Recruitments will start soon, forms and info will come here soon!';
    },
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/p/DbYF1FCT50J/',
    linkedinUrl: 'https://www.linkedin.com/company/4-wall-productions/',
    defaultBookmarked: false,
    accentColor: '#0e7490',
  },

  // --- 19. GIRL UP RUHI ---
  {
    id: 'girl-up-ruhi',
    pocs: [
      {
        "name": "Tanisha Meena",
        "phone": "8595015661"
      },
      {
        "name": "Shobhit Jaiswal",
        "phone": "9305464459"
      }
    ],
    name: 'Girl Up Ruhi SSCBS',
    shortName: 'Girl Up',
    category: 'wellness',
    categoryLabel: 'Inclusion & Sports',
    categories: ['wellness', 'ecell'],
    categoryLabels: ['Inclusion & Sports', 'Startups & Social Impact'],
    description: 'UN Foundation initiative focused on women empowerment and leadership. Recruitments will start soon, forms and info will come here soon!',
    recruitmentFormUrl: null,
    deadline: null,
    statusText: 'Recruitments will start soon, forms and info will come here soon!',
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbbWxhzPp_M/?igsh=MWVlcTN3cmx6cG45OA==',
    linkedinUrl: 'https://www.linkedin.com/company/girl-up-ruhi',
    defaultBookmarked: false,
    accentColor: '#c084fc',
  },

  // --- 20. Grandeur ---
  {
    id: 'grandeur-consulting',
    pocs: [
      {
        "name": "Harshit Chandnani",
        "phone": "9311705389"
      },
      {
        "name": "Samay Bothra",
        "phone": "9354139883"
      }
    ],
    name: 'Grandeur – The Consulting & Knowledge Cell of SSCBS',
    shortName: 'Grandeur',
    category: 'consulting',
    categoryLabel: 'Consulting & Analytics',
    categories: ['consulting', 'finance', 'marketing'],
    categoryLabels: ['Consulting & Analytics', 'Finance & Accounting', 'Marketing, PR & Corporate'],
    description: 'DU’s oldest consulting cell engaged in live corporate strategy projects. Recruitments will start soon, forms and info will come here soon!',
    scheduledForm: {
      liveFrom: '2026-08-28T17:00:00+05:30',
      recruitmentFormUrl: 'https://docs.google.com/forms/d/1ImV_zGDWcIZW_rc5SaPowByyturiFYSJXJeh9VsEjD4/viewform',
      initialDeadline: '2026-08-29T02:00:00+05:30',
      extensionTrigger: '2026-08-29T01:55:00+05:30',
      extendedDeadline: '2026-08-29T10:00:00+05:30',
    },
    get recruitmentFormUrl() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.recruitmentFormUrl;
      }
      return null;
    },
    get deadline() {
      if (!this.scheduledForm) return null;
      const now = new Date();
      if (now < new Date(this.scheduledForm.liveFrom)) {
        return null;
      }
      if (now >= new Date(this.scheduledForm.extensionTrigger)) {
        return this.scheduledForm.extendedDeadline;
      }
      return this.scheduledForm.initialDeadline;
    },
    get statusText() {
      if (!this.scheduledForm) return 'Recruitments will start soon, forms and info will come here soon!';
      const now = new Date();
      if (now < new Date(this.scheduledForm.liveFrom)) {
        return 'Recruitments will start soon, forms and info will come here soon!';
      }
      if (now >= new Date(this.scheduledForm.extensionTrigger)) {
        return '⏰ DEADLINE EXTENDED TO AUG 29 10:00 AM!';
      }
      return null;
    },
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbX2Xcisn90/?igsh=MXJieDUxMmx1a3E0Mw==',
    linkedinUrl: 'https://www.linkedin.com/company/grandeursscbs',
    defaultBookmarked: false,
    accentColor: '#1d4ed8',
  },

  // --- 21. IFSA Network India ---
  {
    id: 'ifsa-network',
    pocs: [
      {
        "name": "Ekam Singh",
        "phone": "9560606930"
      },
      {
        "name": "Akshit Singla",
        "phone": "8076747967"
      }
    ],
    name: 'IFSA Network India (SSCBS Chapter)',
    shortName: 'IFSA',
    category: 'finance',
    categoryLabel: 'Finance & Accounting',
    categories: ['finance', 'consulting'],
    categoryLabels: ['Finance & Accounting', 'Consulting & Analytics'],
    description: 'Global financial services network focusing on capital markets & M&A. Recruitments will start soon, forms and info will come here soon!',
    scheduledForm: {
      liveFrom: '2026-08-28T17:00:00+05:30',
      recruitmentFormUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSewEr_zajO6RYpqhd8ZqylvrYiFWH3t-egJBkY3MAYf8W-8Mw/viewform?usp=sharing&ouid=113357977931873999202',
      deadline: '2026-08-29T10:00:00+05:30',
    },
    get recruitmentFormUrl() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.recruitmentFormUrl;
      }
      return null;
    },
    get deadline() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.deadline;
      }
      return null;
    },
    get statusText() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return null;
      }
      return 'Recruitments will start soon, forms and info will come here soon!';
    },
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbYosjNy7Lo/?igsh=ZGQzcnpxaXoweDd0',
    linkedinUrl: 'https://www.linkedin.com/company/ifsa-sscbs',
    defaultBookmarked: false,
    accentColor: '#059669',
  },

  // --- 22. Illuminati (Quiz Society) ---
  {
    id: 'illuminati-quiz',
    pocs: [
      {
        "name": "Mohd Maaz Naim",
        "phone": "7348656545"
      },
      {
        "name": "Mohammad Ayat",
        "phone": "9311134052"
      }
    ],
    name: 'Illuminati – The Quizzing Society of SSCBS',
    shortName: 'Illuminati',
    category: 'debating',
    categoryLabel: 'Debating, Media & Lit',
    categories: ['debating', 'cultural'],
    categoryLabels: ['Debating, Media & Lit', 'Arts & Culture'],
    description: 'The quizzing society of SSCBS hosting general, business & pop culture trivia. Recruitments will start soon, forms and info will come here soon!',
    recruitmentFormUrl: null,
    deadline: null,
    statusText: 'Recruitments will start soon, forms and info will come here soon!',
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/illuminati.sscbs/',
    linkedinUrl: 'https://www.linkedin.com/company/illuminati-cbs',
    defaultBookmarked: false,
    accentColor: '#be185d',
  },

  // --- 23. Kriti (Art Society) ---
  {
    id: 'kriti-art',
    pocs: [
      {
        "name": "Titiksha Singh",
        "phone": "9205101005"
      },
      {
        "name": "Shikhar Singh",
        "phone": "8770142304"
      }
    ],
    name: 'Kriti – The Fine Arts Society of SSCBS',
    shortName: 'Kriti',
    category: 'cultural',
    categoryLabel: 'Arts & Culture',
    categories: ['cultural'],
    categoryLabels: ['Arts & Culture'],
    description: 'Fine arts, sketching, painting, and visual decor for campus events. Recruitments will start soon, forms and info will come here soon!',
    scheduledForm: {
      liveFrom: '2026-08-28T17:00:00+05:30',
      recruitmentFormUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfcjAJAPUOrQ6yJ836gnr0ECMeCCuwLz-PFV6yZLr745q7LsQ/viewform?usp=publish-editor',
      deadline: '2026-08-29T23:59:59+05:30',
    },
    get recruitmentFormUrl() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.recruitmentFormUrl;
      }
      return null;
    },
    get deadline() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.deadline;
      }
      return null;
    },
    get statusText() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return null;
      }
      return 'Recruitments will start soon, forms and info will come here soon!';
    },
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbdBeyAzIuh/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==&igsi=MzRlODBiNWFlZA==',
    linkedinUrl: 'https://www.linkedin.com/company/kriti-fine-arts-society-of-sscbs',
    defaultBookmarked: false,
    accentColor: '#67e8f9',
  },

  // --- 24. Kronos (IT Society) ---
  {
    id: 'kronos-it',
    pocs: [
      {
        "name": "Poorvanshi Rawat",
        "phone": "9557758634"
      },
      {
        "name": "Divyam Jain",
        "phone": "9355261617"
      }
    ],
    name: 'Kronos – The IT & Tech Society of SSCBS',
    shortName: 'Kronos',
    category: 'tech',
    categoryLabel: 'Tech & IT',
    categories: ['tech', 'cultural'],
    categoryLabels: ['Tech & IT', 'Arts & Culture'],
    description: 'Specializing in Web/App Development, UI/UX design, and tech buildouts. Recruitments will start soon, forms and info will come here soon!',
    recruitmentFormUrl: null,
    deadline: null,
    statusText: 'Recruitments will start soon, forms and info will come here soon!',
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbYeHxnscdn/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==&igsi=MzRlODBiNWFlZA==',
    linkedinUrl: 'https://www.linkedin.com/company/kronosscbs',
    defaultBookmarked: false,
    accentColor: '#7c3aed',
  },

  // --- 25. Lawrence (Law Society) ---
  {
    id: 'lawrence-law',
    pocs: [
      {
        "name": "Hardik Baweja",
        "phone": "7011455707"
      },
      {
        "name": "Aryan Singla",
        "phone": "9311851579"
      }
    ],
    name: 'Lawrence – The Law & Legal Studies Society of SSCBS',
    shortName: 'Lawrence',
    category: 'economics',
    categoryLabel: 'Economics, Law & Policy',
    categories: ['economics', 'debating'],
    categoryLabels: ['Economics, Law & Policy', 'Debating, Media & Lit'],
    description: 'Legal awareness, corporate law discussions, and moot court competitions. Recruitments will start soon, forms and info will come here soon!',
    recruitmentFormUrl: null,
    deadline: null,
    statusText: 'Recruitments will start soon, forms and info will come here soon!',
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/lawrence.sscbs/',
    linkedinUrl: 'https://www.linkedin.com/school/lawrence-sscbs/',
    defaultBookmarked: false,
    accentColor: '#075985',
  },

  // --- 26. Literary Society ---
  {
    id: 'literary-society',
    pocs: [
      {
        "name": "Mayank Yadav",
        "phone": "9302023773"
      },
      {
        "name": "Girisha",
        "phone": "9599576590"
      }
    ],
    name: 'LitSoc – The Literary Society of SSCBS',
    shortName: 'LitSoc',
    category: 'debating',
    categoryLabel: 'Debating, Media & Lit',
    categories: ['debating', 'cultural'],
    categoryLabels: ['Debating, Media & Lit', 'Arts & Culture'],
    description: 'Promoting creative writing, poetry slams, and literary publications. Recruitments will start soon, forms and info will come here soon!',
    recruitmentFormUrl: null,
    deadline: null,
    statusText: 'Recruitments will start soon, forms and info will come here soon!',
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://linktr.ee/litsocsscbs?utm_source=chatgpt.com',
    linkedinUrl: 'https://www.linkedin.com/company/litsocsscbs',
    defaultBookmarked: false,
    accentColor: '#9d174d',
  },

  // --- 27. Mark-it (Marketing Society) ---
  {
    id: 'mark-it-marketing',
    pocs: [
      {
        "name": "Kashvi Aggarwal",
        "phone": "8800262621"
      },
      {
        "name": "Arjun Chowdhary",
        "phone": "9650282850"
      }
    ],
    name: 'Mark-It – The Marketing Society of SSCBS',
    shortName: 'Mark-it',
    category: 'marketing',
    categoryLabel: 'Marketing, PR & Corporate',
    categories: ['marketing', 'consulting'],
    categoryLabels: ['Marketing, PR & Corporate', 'Consulting & Analytics'],
    description: 'Specializing in brand strategy, digital marketing campaigns, and MarkCon.',
    scheduledForm: {
      liveFrom: '2026-08-28T17:00:00+05:30',
      recruitmentFormUrl: 'https://forms.gle/1wb7SoP6ZSJLhFSL9',
      initialDeadline: '2026-08-28T21:00:00+05:30',
      extensionTrigger: '2026-08-28T20:55:00+05:30',
      extendedDeadline: '2026-08-29T09:00:00+05:30',
    },
    get recruitmentFormUrl() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.recruitmentFormUrl;
      }
      return null;
    },
    get deadline() {
      if (!this.scheduledForm) return null;
      const now = new Date();
      if (now < new Date(this.scheduledForm.liveFrom)) {
        return null;
      }
      if (this.scheduledForm.extensionTrigger && now >= new Date(this.scheduledForm.extensionTrigger)) {
        return this.scheduledForm.extendedDeadline;
      }
      return this.scheduledForm.initialDeadline;
    },
    get statusText() {
      if (!this.scheduledForm) return 'Recruitments will start soon, forms and info will come here soon!';
      const now = new Date();
      if (now < new Date(this.scheduledForm.liveFrom)) {
        return 'Recruitments will start soon, forms and info will come here soon!';
      }
      return null;
    },
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbYPW3mMOXL/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==&igsi=MzRlODBiNWFlZA==',
    linkedinUrl: 'https://www.linkedin.com/company/markitsscbs',
    defaultBookmarked: false,
    accentColor: '#ec4899',
  },

  // --- 28. MIC (Management Interaction Cell) ---
  {
    id: 'mic-corporate',
    pocs: [
      {
        "name": "Kashish Raj",
        "phone": "7992425818"
      },
      {
        "name": "Dhruv Bharat Choudhary",
        "phone": "9723162825"
      }
    ],
    name: 'MIC – Management Interaction Cell of SSCBS',
    shortName: 'MIC',
    category: 'marketing',
    categoryLabel: 'Marketing, PR & Corporate',
    categories: ['marketing', 'consulting'],
    categoryLabels: ['Marketing, PR & Corporate', 'Consulting & Analytics'],
    description: 'Connecting students with corporate leaders and CXO keynotes.',
    scheduledForm: {
      liveFrom: '2026-08-28T16:59:00+05:30',
      recruitmentFormUrl: 'https://application.micsscbs.in/',
      deadline: '2026-08-29T17:00:00+05:30',
    },
    get recruitmentFormUrl() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.recruitmentFormUrl;
      }
      return null;
    },
    get deadline() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.deadline;
      }
      return null;
    },
    get statusText() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return null;
      }
      return 'Recruitments will start soon, forms and info will come here soon!';
    },
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbX7F5KzqOz/?igsh=d2NsdjVzNGd1eGFw',
    linkedinUrl: 'https://www.linkedin.com/company/management-interaction-cell-sscbs',
    defaultBookmarked: false,
    accentColor: '#f43f5e',
  },

  // --- 29. Kartavya ---
  {
    id: 'kartavya',
    pocs: [
      {
        "name": "Aaditya Bhatnagar",
        "phone": "7011634171"
      },
      {
        "name": "Manya Bhadani",
        "phone": "7463899565"
      }
    ],
    name: 'Kartavya',
    shortName: 'Kartavya',
    category: 'ecell',
    categoryLabel: 'Startups & Social Impact',
    categories: ['ecell', 'wellness'],
    categoryLabels: ['Startups & Social Impact', 'Inclusion & Sports'],
    description: 'Social welfare forum of SSCBS empowering underprivileged communities and driving social service initiatives.',
    scheduledForm: {
      liveFrom: '2026-08-28T17:00:00+05:30',
      recruitmentFormUrl: 'https://forms.gle/FUBsTaQb8u3H8TB86',
      initialDeadline: '2026-08-29T17:00:00+05:30',
      extensionTrigger: '2026-08-29T16:55:00+05:30',
      extendedDeadline: '2026-08-30T17:00:00+05:30',
    },
    get recruitmentFormUrl() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.recruitmentFormUrl;
      }
      return null;
    },
    get deadline() {
      if (!this.scheduledForm) return null;
      const now = new Date();
      if (now < new Date(this.scheduledForm.liveFrom)) {
        return null;
      }
      if (now >= new Date(this.scheduledForm.extensionTrigger)) {
        return this.scheduledForm.extendedDeadline;
      }
      return this.scheduledForm.initialDeadline;
    },
    get statusText() {
      if (!this.scheduledForm) return 'Recruitments will start soon, forms and info will come here soon!';
      const now = new Date();
      if (now < new Date(this.scheduledForm.liveFrom)) {
        return 'Recruitments will start soon, forms and info will come here soon!';
      }
      return null;
    },
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbYgVflA1zz/?igsh=N2d4dWt6OWY3eWtx',
    linkedinUrl: 'https://www.linkedin.com/company/kartavya-the-social-service-forum-of-sscbs',
    defaultBookmarked: false,
    accentColor: '#fbbf24',
  },

  // --- 29b. Connecting Dreams Foundation (CDF) ---
  {
    id: 'cdf-sscbs',
    pocs: [
      {
        "name": "Khushi Chamola",
        "phone": "9891464779"
      },
      {
        "name": "Aryaman Gupta",
        "phone": "8178967422"
      }
    ],
    name: 'Connecting Dreams Foundation SSCBS Chapter (CDF)',
    shortName: 'CDF',
    category: 'ecell',
    categoryLabel: 'Startups & Social Impact',
    categories: ['ecell', 'wellness'],
    categoryLabels: ['Startups & Social Impact', 'Inclusion & Sports'],
    description: 'Empowering youth to achieve sustainable development goals and drive social entrepreneurship. Recruitments will start soon, forms and info will come here soon!',
    recruitmentFormUrl: null,
    deadline: null,
    statusText: 'Recruitments will start soon, forms and info will come here soon!',
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbVX0gwJfQ6/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==&igsi=MzRlODBiNWFlZA==',
    linkedinUrl: 'https://www.linkedin.com/company/connecting-dreams-foundation-sscbs/',
    defaultBookmarked: false,
    accentColor: '#10b981',
  },

  // --- 30. NUCLEUS ---
  {
    id: 'nucleus-analytics',
    pocs: [
      {
        "name": "Srisham Dash",
        "phone": "7894973106"
      },
      {
        "name": "Saiyam Baheti",
        "phone": "9408785636"
      }
    ],
    name: 'Nucleus – The Analytics Society of SSCBS',
    shortName: 'Nucleus',
    category: 'consulting',
    categoryLabel: 'Consulting & Analytics',
    categories: ['consulting'],
    categoryLabels: ['Consulting & Analytics'],
    description: 'The Analytics Society of SSCBS, focusing on data driven thinking and problem solving. Recruitments starting soon, forms and info will come here soon',
    scheduledForm: {
      liveFrom: '2026-08-28T17:00:00+05:30',
      recruitmentFormUrl: 'https://tally.so/r/Y5IPZd',
      deadline: '2026-08-29T12:00:00+05:30',
    },
    get recruitmentFormUrl() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.recruitmentFormUrl;
      }
      return null;
    },
    get deadline() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.deadline;
      }
      return null;
    },
    get statusText() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return null;
      }
      return 'Recruitments will start soon, forms and info will come here soon!';
    },
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/p/DbX3S7QvBZY/',
    linkedinUrl: 'https://www.linkedin.com/company/nucleus-cbs',
    defaultBookmarked: false,
    accentColor: '#1e40af',
  },

  // --- 31. Parishram (Sports Society) ---
  {
    id: 'parishram-sports',
    pocs: [
      {
        "name": "Khushal Bansal",
        "phone": "9310059110"
      },
      {
        "name": "Arjit Rawat",
        "phone": "9873198531"
      }
    ],
    name: 'Parishram – The Sports & Athletics Society of SSCBS',
    shortName: 'Parishram',
    category: 'wellness',
    categoryLabel: 'Inclusion & Sports',
    categories: ['wellness'],
    categoryLabels: ['Inclusion & Sports'],
    description: 'Sports society organizing inter-college athletic tournaments & fitness sessions. Recruitments will start soon, forms and info will come here soon!',
    recruitmentFormUrl: null,
    deadline: null,
    statusText: 'Recruitments will start soon, forms and info will come here soon!',
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbYoVuFP4Hi/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==&igsi=MzRlODBiNWFlZA==',
    linkedinUrl: 'https://www.linkedin.com/company/parishram-sscbs',
    defaultBookmarked: false,
    accentColor: '#38bdf8',
  },

  // --- 32. QSA ---
  {
    id: 'qsa-inclusivity',
    pocs: [
      {
        "name": "Himanshu Anand",
        "phone": "8797787234"
      },
      {
        "name": "Abisha Sanwaria",
        "phone": "9599851370"
      }
    ],
    name: 'QSA – Queer Straight Alliance SSCBS',
    shortName: 'QSA',
    category: 'wellness',
    categoryLabel: 'Inclusion & Sports',
    categories: ['wellness', 'ecell'],
    categoryLabels: ['Inclusion & Sports', 'Startups & Social Impact'],
    description: 'Queer Straight Alliance fostering an inclusive and safe environment. Recruitments will start soon, forms and info will come here soon!',
    recruitmentFormUrl: null,
    deadline: null,
    statusText: 'Recruitments will start soon, forms and info will come here soon!',
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/qsa.sscbs/',
    linkedinUrl: 'https://www.linkedin.com/company/qsasscbs',
    defaultBookmarked: false,
    accentColor: '#e879f9',
  },

  // --- 33. CBS Post ---
  {
    id: 'cbs-post',
    pocs: [
      {
        "name": "Riddhima Rawat",
        "phone": "8320133074"
      },
      {
        "name": "Kanishk Kumar",
        "phone": "9315835610"
      }
    ],
    name: 'CBS Post – The Official Campus Student Newspaper of SSCBS',
    shortName: 'CBS Post',
    category: 'debating',
    categoryLabel: 'Debating, Media & Lit',
    categories: ['debating', 'marketing'],
    categoryLabels: ['Debating, Media & Lit', 'Marketing, PR & Corporate'],
    description: 'Official student journalism portal and campus newspaper. Recruitments will start soon, forms and info will come here soon!',
    recruitmentFormUrl: null,
    deadline: null,
    statusText: 'Recruitments will start soon, forms and info will come here soon!',
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbYLstvSEDR/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==&igsi=MzRlODBiNWFlZA==',
    linkedinUrl: 'https://www.linkedin.com/company/the-cbs-post',
    defaultBookmarked: false,
    accentColor: '#e11d48',
  },

  // --- 34. Rotaract SSCBS ---
  {
    id: 'rotaract-sscbs',
    pocs: [
      {
        "name": "Arshita",
        "phone": "9773817046"
      },
      {
        "name": "Lorena Kundalwal",
        "phone": "8130916949"
      }
    ],
    name: 'Rotaract Club of SSCBS',
    shortName: 'Rotaract',
    category: 'ecell',
    categoryLabel: 'Startups & Social Impact',
    categories: ['ecell', 'wellness'],
    categoryLabels: ['Startups & Social Impact', 'Inclusion & Sports'],
    description: 'Youth chapter of Rotary International executing community drives.',
    scheduledForm: {
      liveFrom: '2026-08-28T17:00:00+05:30',
      recruitmentFormUrl: 'https://forms.gle/sBrzLXVtenLREGzf9',
      initialDeadline: '2026-08-29T14:00:00+05:30',
      extensionTrigger: '2026-08-29T13:55:00+05:30',
      extendedDeadline: '2026-08-29T16:00:00+05:30',
    },
    get recruitmentFormUrl() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.recruitmentFormUrl;
      }
      return null;
    },
    get deadline() {
      if (!this.scheduledForm) return null;
      const now = new Date();
      if (now < new Date(this.scheduledForm.liveFrom)) {
        return null;
      }
      if (now >= new Date(this.scheduledForm.extensionTrigger)) {
        return this.scheduledForm.extendedDeadline;
      }
      return this.scheduledForm.initialDeadline;
    },
    get statusText() {
      if (!this.scheduledForm) return 'Recruitments will start soon, forms and info will come here soon!';
      const now = new Date();
      if (now < new Date(this.scheduledForm.liveFrom)) {
        return 'Recruitments will start soon, forms and info will come here soon!';
      }
      return null;
    },
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbYOcmaP5Te/?igsh=MTNicDZlcmlrcnJ0ZQ==',
    linkedinUrl: 'https://www.linkedin.com/company/rotaract-sscbs',
    defaultBookmarked: false,
    accentColor: '#f59e0b',
  },

  // --- 35. Synergy (The Corporate Events Society) ---
  {
    id: 'synergy-corporate',
    pocs: [
      {
        "name": "Princy Sanghvi",
        "phone": "8076362358"
      },
      {
        "name": "Nandinee Patel",
        "phone": "6352341010"
      }
    ],
    name: 'Synergy – The Corporate Society of SSCBS',
    shortName: 'Synergy',
    category: 'consulting',
    categoryLabel: 'Consulting & Analytics',
    categories: ['consulting', 'marketing'],
    categoryLabels: ['Consulting & Analytics', 'Marketing, PR & Corporate'],
    description: 'Bridging academia and corporate life via live corporate projects and Decennium. Recruitments will start soon, forms and info will come here soon!',
    scheduledForm: {
      liveFrom: '2026-08-28T17:00:00+05:30',
      recruitmentFormUrl: 'https://forms.gle/TeaKDF7hq5eBRGJC6',
      deadline: '2026-08-29T12:00:00+05:30',
    },
    get recruitmentFormUrl() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.recruitmentFormUrl;
      }
      return null;
    },
    get deadline() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.deadline;
      }
      return null;
    },
    get statusText() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return null;
      }
      return 'Recruitments will start soon, forms and info will come here soon!';
    },
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/Dbaw7pWBAb8/?igsh=emNjbGRnb2tybmRj',
    linkedinUrl: 'https://www.linkedin.com/company/synergy-the-corporate-society-of-sscbs',
    defaultBookmarked: false,
    accentColor: '#1d4ed8',
  },

  // --- 36. Verve (Street Play Society) ---
  {
    id: 'verve-streetplay',
    pocs: [
      {
        "name": "Vanshika Kumari",
        "phone": "7079835490"
      },
      {
        "name": "Harshit Goyal",
        "phone": "8690950081"
      }
    ],
    name: 'Verve – The Street Play Society of SSCBS',
    shortName: 'Verve',
    category: 'cultural',
    categoryLabel: 'Arts & Culture',
    categories: ['cultural', 'ecell'],
    categoryLabels: ['Arts & Culture', 'Startups & Social Impact'],
    description: 'Nukkad Natak street play team driving social awareness. Recruitments will start soon, forms and info will come here soon!',
    recruitmentFormUrl: null,
    deadline: null,
    statusText: 'Recruitments will start soon, forms and info will come here soon!',
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbaXmMsTDoa/?igsh=MjIwY25ibG90Ymx5',
    linkedinUrl: 'https://www.linkedin.com/company/verve-the-street-play-society-of-sscbs',
    defaultBookmarked: false,
    accentColor: '#155e75',
  },

  // --- 37. Yuva (Entrepreneurship Cell) ---
  {
    id: 'yuva-ecell',
    pocs: [
      {
        "name": "Yohan Kaul",
        "phone": "9370095931"
      },
      {
        "name": "Aashree Jain",
        "phone": "9205762615"
      }
    ],
    name: 'Yuva – The Entrepreneurship Cell (E-Cell) of SSCBS',
    shortName: 'Yuva E-Cell',
    category: 'ecell',
    categoryLabel: 'Startups & Social Impact',
    categories: ['ecell', 'consulting'],
    categoryLabels: ['Startups & Social Impact', 'Consulting & Analytics'],
    description: 'The Entrepreneurship Cell of SSCBS promoting student incubators and E-Summit.',
    scheduledForm: {
      liveFrom: '2026-08-28T17:00:00+05:30',
      initialDeadline: '2026-08-29T05:00:00+05:30',
      extensionTime: '2026-08-29T04:50:00+05:30',
      extendedDeadline: '2026-08-29T06:00:00+05:30',
      recruitmentFormUrl: 'https://www.yuvaecell.in/join',
    },
    get recruitmentFormUrl() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.recruitmentFormUrl;
      }
      return null;
    },
    get deadline() {
      if (!this.scheduledForm) return null;
      const now = new Date();
      if (now < new Date(this.scheduledForm.liveFrom)) {
        return null;
      }
      if (now >= new Date(this.scheduledForm.extensionTime)) {
        return this.scheduledForm.extendedDeadline;
      }
      return this.scheduledForm.initialDeadline;
    },
    get statusText() {
      if (!this.scheduledForm) return 'Recruitments will start soon, forms and info will come here soon!';
      const now = new Date();
      if (now < new Date(this.scheduledForm.liveFrom)) {
        return 'Recruitments will start soon, forms and info will come here soon!';
      }
      return null;
    },
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbaLTSzJ1BR/?igsh=MWFyZzJveHA5NGtwbA==',
    linkedinUrl: 'https://www.linkedin.com/company/yuva-entrepreneurship-cell-cbs',
    defaultBookmarked: false,
    accentColor: '#d97706',
  },

  // --- 38. 180 Degree Consulting ---
  {
    id: '180dc-consulting',
    pocs: [
      {
        "name": "Siddhi Garg",
        "phone": "9289045149"
      },
      {
        "name": "Sayani Jain",
        "phone": "9205288380"
      }
    ],
    name: '180 Degrees Consulting SSCBS (180DC)',
    shortName: '180DC',
    category: 'consulting',
    categoryLabel: 'Consulting & Analytics',
    categories: ['consulting', 'ecell'],
    categoryLabels: ['Consulting & Analytics', 'Startups & Social Impact'],
    description: 'Pro-bono strategy consulting for non-profits and social enterprises. Recruitments will start soon, forms and info will come here soon!',
    scheduledForm: {
      liveFrom: '2026-08-28T17:00:00+05:30',
      recruitmentFormUrl: 'https://wkf.ms/45IkCUU',
      deadline: '2026-08-29T05:00:00+05:30',
    },
    get recruitmentFormUrl() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.recruitmentFormUrl;
      }
      return null;
    },
    get deadline() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.deadline;
      }
      return null;
    },
    get statusText() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return null;
      }
      return 'Recruitments will start soon, forms and info will come here soon!';
    },
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbYbNPNo99E/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==&igsi=MzRlODBiNWFlZA==',
    linkedinUrl: 'https://www.linkedin.com/company/180dcsscbs',
    defaultBookmarked: false,
    accentColor: '#3b82f6',
  },

  // --- 39. IMA Chapter ---
  {
    id: 'ima-chapter',
    pocs: [
      {
        "name": "Nitansh Yadav",
        "phone": "8081842682"
      },
      {
        "name": "Anushka Shukla",
        "phone": "7087776803"
      }
    ],
    name: 'IMA SSCBS Student Chapter',
    shortName: 'IMA',
    category: 'finance',
    categoryLabel: 'Finance & Accounting',
    categories: ['finance', 'consulting'],
    categoryLabels: ['Finance & Accounting', 'Consulting & Analytics'],
    description: 'Institute of Management Accountants chapter focusing on management accounting. Recruitments will start soon, forms and info will come here soon!',
    scheduledForm: {
      liveFrom: '2026-08-28T17:00:00+05:30',
      recruitmentFormUrl: 'https://bit.ly/ima-recruitment-form',
      initialDeadline: '2026-08-29T15:00:00+05:30',
      extendedDeadline: '2026-08-29T17:00:00+05:30',
    },
    get recruitmentFormUrl() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.recruitmentFormUrl;
      }
      return null;
    },
    get deadline() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.extendedDeadline || this.scheduledForm.initialDeadline;
      }
      return null;
    },
    get statusText() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return null;
      }
      return 'Recruitments will start soon, forms and info will come here soon!';
    },
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbYQ2s1vIVq/?igsh=YWlzNmIxbWpkbTh3',
    linkedinUrl: 'https://www.linkedin.com/company/ima-sscbs-chapter',
    defaultBookmarked: false,
    accentColor: '#065f46',
  },

  // --- 40. APICS Chapter ---
  {
    id: 'apics-operations',
    pocs: [
      {
        "name": "Manya",
        "phone": "9540368873"
      },
      {
        "name": "Samarth Behl",
        "phone": "7814710620"
      }
    ],
    name: 'APICS SSCBS Chapter',
    shortName: 'APICS',
    category: 'consulting',
    categoryLabel: 'Consulting & Analytics',
    categories: ['consulting', 'marketing'],
    categoryLabels: ['Consulting & Analytics', 'Marketing, PR & Corporate'],
    description: 'Supply Chain & Operations Management society organizing operational case challenges. Recruitments will start soon, forms and info will come here soon!',
    scheduledForm: {
      liveFrom: '2026-08-28T17:00:00+05:30',
      recruitmentFormUrl: 'https://forms.gle/ABd5RPKV4qsFuLWt7',
      initialDeadline: '2026-08-29T02:00:00+05:30',
      extensionTrigger: '2026-08-29T01:55:00+05:30',
      extendedDeadline: '2026-08-29T09:00:00+05:30',
    },
    get recruitmentFormUrl() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.recruitmentFormUrl;
      }
      return null;
    },
    get deadline() {
      if (!this.scheduledForm) return null;
      const now = new Date();
      if (now < new Date(this.scheduledForm.liveFrom)) {
        return null;
      }
      if (now >= new Date(this.scheduledForm.extensionTrigger)) {
        return this.scheduledForm.extendedDeadline;
      }
      return this.scheduledForm.initialDeadline;
    },
    get statusText() {
      if (!this.scheduledForm) return 'Recruitments will start soon, forms and info will come here soon!';
      const now = new Date();
      if (now < new Date(this.scheduledForm.liveFrom)) {
        return 'Recruitments will start soon, forms and info will come here soon!';
      }
      if (now >= new Date(this.scheduledForm.extensionTrigger)) {
        return '⏰ DEADLINE EXTENDED TO AUG 29 9:00 AM!';
      }
      return null;
    },
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbYNOmOpmBh/?igsh=MXJubDhjM2V4OTFmbA==',
    linkedinUrl: 'https://www.linkedin.com/company/apicssscbs',
    defaultBookmarked: false,
    accentColor: '#60a5fa',
  },

  // --- 41. Eco Club ---
  {
    id: 'eco-club',
    pocs: [
      {
        "name": "Piyush Kumar Pandit",
        "phone": "9643200704"
      },
      {
        "name": "Darshna Devendra Jangle",
        "phone": "7626994926"
      }
    ],
    name: 'Eco Club SSCBS – Environmental Conservation Cell',
    shortName: 'Eco Club',
    category: 'ecell',
    categoryLabel: 'Startups & Social Impact',
    categories: ['ecell', 'wellness'],
    categoryLabels: ['Startups & Social Impact', 'Inclusion & Sports'],
    description: 'Environmental conservation cell leading green campus drives & sustainability. Recruitments will start soon, forms and info will come here soon!',
    recruitmentFormUrl: null,
    deadline: null,
    statusText: 'Recruitments will start soon, forms and info will come here soon!',
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/Dbcy1Ldhwpp/?utm_source=ig_web_copy_link',
    linkedinUrl: 'https://www.linkedin.com/company/ecoclub-sscbs',
    defaultBookmarked: false,
    accentColor: '#10b981',
  },

  // --- 42. Sadhna + Make Sense ---
  {
    id: 'sadhna-makesense',
    pocs: [
      {
        "name": "Gaurav Kumar",
        "phone": "8920477482"
      },
      {
        "name": "Hansika Singh",
        "phone": "7409107691"
      },
      {
        "name": "Adit arora",
        "phone": "8373901813"
      },
      {
        "name": "Tanisha yadav",
        "phone": "8178417627"
      }
    ],
    name: 'Sadhna & MakeSense SSCBS',
    shortName: 'Sadhna',
    category: 'ecell',
    categoryLabel: 'Startups & Social Impact',
    categories: ['ecell', 'wellness'],
    categoryLabels: ['Startups & Social Impact', 'Inclusion & Sports'],
    description: 'Wellness, yoga, and mental health initiatives for student well-being. Recruitments will start soon, forms and info will come here soon!',
    recruitmentFormUrl: null,
    deadline: null,
    statusText: 'Recruitments will start soon, forms and info will come here soon!',
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/sadhana.cbs/',
    linkedinUrl: 'https://www.linkedin.com/company/sadhana-the-yoga-society-of-sscbs',
    defaultBookmarked: false,
    accentColor: '#34d399',
  },

  // --- 43. Bridges for Enterprise ---
  {
    id: 'bridges-enterprise',
    pocs: [
      {
        "name": "Gaurang Garg",
        "phone": "9634320168"
      },
      {
        "name": "Diza Garg",
        "phone": "6284460396"
      }
    ],
    name: 'Bridges for Enterprise (BfE) New Delhi Chapter at SSCBS',
    shortName: 'BfE',
    category: 'consulting',
    categoryLabel: 'Consulting & Analytics',
    categories: ['consulting', 'ecell', 'finance'],
    categoryLabels: ['Consulting & Analytics', 'Startups & Social Impact', 'Finance & Accounting'],
    description: 'Global non-profit impact consulting chapter offering strategy advisory. Recruitments will start soon, forms and info will come here soon!',
    scheduledForm: {
      liveFrom: '2026-08-28T17:00:00+05:30',
      recruitmentFormUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfgcZFpWnHVgdvLVFXZ5vQaTvKjP0mb4bvasXDDmkMuSGymzA/viewform',
      deadline: '2026-08-29T10:00:00+05:30',
    },
    get recruitmentFormUrl() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.recruitmentFormUrl;
      }
      return null;
    },
    get deadline() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.deadline;
      }
      return null;
    },
    get statusText() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return null;
      }
      return 'Recruitments will start soon, forms and info will come here soon!';
    },
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbYp8ESBdkp/?igsh=MW10cHJ1bzY5djhlaA==',
    linkedinUrl: 'https://www.linkedin.com/company/bridges-for-enterprise-new-delhi',
    defaultBookmarked: false,
    accentColor: '#2563eb',
  },

  // --- 44. Financial Literacy Club ---
  {
    id: 'financial-literacy',
    pocs: [
      {
        "name": "Bhomik Kumar Sahu",
        "phone": "8839098183"
      },
      {
        "name": "Aayushi Gupta",
        "phone": "9211394956"
      }
    ],
    name: 'Financial Literacy Cell (FLC) SSCBS',
    shortName: 'FLC',
    category: 'finance',
    categoryLabel: 'Finance & Accounting',
    categories: ['finance', 'ecell'],
    categoryLabels: ['Finance & Accounting', 'Startups & Social Impact'],
    description: 'Spreading financial awareness, personal budgeting, and community literacy. Recruitments will start soon, forms and info will come here soon!',
    scheduledForm: {
      liveFrom: '2026-08-28T17:00:00+05:30',
      recruitmentFormUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSegL-Gx1r_dSles7qT-oY0JKLL_nWcKo2i33bYCi5_o5IYxZQ/viewform?usp=header',
      initialDeadline: '2026-08-29T18:00:00+05:30',
      extensionTrigger: '2026-08-29T17:55:00+05:30',
      extendedDeadline: '2026-08-29T23:59:59+05:30',
    },
    get recruitmentFormUrl() {
      if (this.scheduledForm && new Date() >= new Date(this.scheduledForm.liveFrom)) {
        return this.scheduledForm.recruitmentFormUrl;
      }
      return null;
    },
    get deadline() {
      if (!this.scheduledForm) return null;
      const now = new Date();
      if (now < new Date(this.scheduledForm.liveFrom)) {
        return null;
      }
      if (now >= new Date(this.scheduledForm.extensionTrigger)) {
        return this.scheduledForm.extendedDeadline;
      }
      return this.scheduledForm.initialDeadline;
    },
    get statusText() {
      if (!this.scheduledForm) return 'Recruitments will start soon, forms and info will come here soon!';
      const now = new Date();
      if (now < new Date(this.scheduledForm.liveFrom)) {
        return 'Recruitments will start soon, forms and info will come here soon!';
      }
      if (now >= new Date(this.scheduledForm.extensionTrigger)) {
        return '⏰ DEADLINE EXTENDED TO AUG 29 EOD!';
      }
      return null;
    },
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/reel/DbYwuBWywMI/?igsh=Nno5YnRyZDlld2dl',
    linkedinUrl: 'https://www.linkedin.com/company/flcs-scbs',
    defaultBookmarked: false,
    accentColor: '#34d399',
  },

  // --- 45. Skill Development Cell ---
  {
    id: 'sdc-sscbs',
    pocs: [
      {
        "name": "Piyush Kumar (President)",
        "phone": "9643200704"
      },
      {
        "name": "Vaibhav Kumar (Vice President)",
        "phone": "9341029114"
      }
    ],
    name: 'Skill Development Cell (SDC), SSCBS',
    shortName: 'SDC',
    category: 'consulting',
    categoryLabel: 'Consulting & Analytics',
    categories: ['consulting', 'marketing'],
    categoryLabels: ['Consulting & Analytics', 'Marketing, PR & Corporate'],
    description: 'Dedicated cell for practical skill-building, corporate readiness, and organizer of flagship events like Market-Niti (bilingual marketing & case study competition). Recruitments will start soon, forms and info will come here soon!',
    recruitmentFormUrl: null,
    deadline: null,
    statusText: 'Recruitments will start soon, forms and info will come here soon!',
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/sdc.sscbs?igsh=b3lscjB1cnRoNHA3',
    linkedinUrl: 'https://www.linkedin.com/company/skill-development-cell-sscbs/',
    defaultBookmarked: false,
    accentColor: '#10b981',
  },

  // --- 46. NCC SSCBS (National Cadet Corps) ---
  {
    id: 'ncc-sscbs',
    pocs: [
      {
        name: 'Naman Yadav',
        phone: '8795325575',
      },
      {
        name: 'Mayank Yadav',
        phone: '9302023773',
      },
    ],
    name: 'NCC SSCBS – National Cadet Corps (SSCBS Chapter)',
    shortName: 'NCC',
    category: 'wellness',
    categoryLabel: 'Inclusion & Sports',
    categories: ['wellness', 'ecell', 'debating'],
    categoryLabels: ['Inclusion & Sports', 'Startups & Social Impact', 'Debating, Media & Lit'],
    description: 'Government organization focused on discipline, leadership, fitness, adventure, and nation-building across sports, culture, innovation, and defense. Open to all academic backgrounds (college society rules do not apply). Recruitment Day: 7th Sep, 12:00 PM at College Ground.',
    recruitmentFormUrl: 'https://forms.gle/1wwKFBpsu4M8QpFQ9',
    deadline: '2026-09-07T12:00:00+05:30',
    statusText: 'Forms Live! Recruitment Day: 7th Sep, 12:00 PM @ College Ground',
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/ncc_sscbs?igsi=czJwYmpheWw1MHcw',
    linkedinUrl: null,
    whatsappGroupUrl: 'https://chat.whatsapp.com/D166C6KICau4c8AocjYf5s?s=cl&p=a&mlu=4',
    defaultBookmarked: false,
    accentColor: '#15803d',
  },

  // --- 47. North East Cell (NESWC) ---
  {
    id: 'north-east-cell',
    pocs: [
      {
        name: 'Madang Sangdo',
        phone: '8798396303',
      },
      {
        name: 'Deborah',
        phone: '9402522915',
      },
    ],
    name: 'North East Cell – North East Students Welfare Committee (NESWC), SSCBS',
    shortName: 'North East Cell',
    category: 'wellness',
    categoryLabel: 'Inclusion & Sports',
    categories: ['wellness', 'cultural'],
    categoryLabels: ['Inclusion & Sports', 'Arts & Culture'],
    description: 'Promoting regional diversity, culture, and student welfare for the 8 North Eastern states (organizers of flagship event "818" and "Prelude to 818"). Recruitments will start soon, forms and info will come here soon!',
    recruitmentFormUrl: null,
    deadline: null,
    statusText: 'Recruitments will start soon, forms and info will come here soon!',
    officialPageUrl: OFFICIAL_COLLEGE_SOCIETIES_URL,
    instagramVideoUrl: 'https://www.instagram.com/neswc.sscbs/',
    linkedinUrl: 'https://www.linkedin.com/company/north-east-cell-sscbs',
    defaultBookmarked: false,
    accentColor: '#f59e0b',
  },
];

/**
 * Calculates deadline status & formatted text
 */
export function getDeadlineInfo(deadlineStr) {
  if (!deadlineStr) {
    return {
      status: 'normal',
      text: 'Recruitments start soon!',
      isExpired: false,
      daysLeft: 99,
      isSoon: true,
    };
  }

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
