const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '..', 'src', 'data', 'faculty_directory.json');
let dataset = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

const guestEntries = [
  {
    id: 'dr-ajay-kumar-guest',
    name: 'Dr. Ajay Kumar',
    qualification: 'Ph.D. (Delhi Technological University)',
    designation: 'Guest Faculty',
    room: 'Guest Faculty Office',
    email: 'ajaykumar@sscbs.du.ac.in',
    phone: null,
    expertise: ['Computer Science', 'Technical Applications'],
    photoUrl: null,
    profileUrl: 'https://sscbs.du.ac.in/guest-faculties/',
    biography: 'Dr. Ajay Kumar is a Guest Faculty at SSCBS. He holds a Ph.D. from Delhi Technological University.',
    education: ['Ph.D. from Delhi Technological University (DTU)'],
    publications: []
  },
  {
    id: 'dr-ankita-arora-guest',
    name: 'Dr. Ankita Arora',
    qualification: 'Ph.D (CIL) MIL&LS, Delhi University',
    designation: 'Guest Faculty',
    room: 'Guest Faculty Office',
    email: 'ankita@sscbs.du.ac.in',
    phone: null,
    expertise: ['Modern Indian Languages', 'Literary Studies'],
    photoUrl: null,
    profileUrl: 'https://sscbs.du.ac.in/guest-faculties/',
    biography: 'Dr. Ankita Arora is a Guest Faculty at SSCBS. She was awarded her Ph.D. from the Department of MIL & LS, University of Delhi.',
    education: ['Ph.D. (CIL), Department of MIL & LS, University of Delhi'],
    publications: []
  },
  {
    id: 'dr-ashima-gaba-guest',
    name: 'Dr. Ashima Gaba',
    qualification: 'Ph.D. in Finance (Jamia Millia Islamia)',
    designation: 'Guest Faculty',
    room: 'Guest Faculty Office',
    email: 'ashimagaba@sscbs.du.ac.in',
    phone: null,
    expertise: ['Finance', 'Corporate Finance', 'Financial Markets'],
    photoUrl: null,
    profileUrl: 'https://sscbs.du.ac.in/guest-faculties/',
    biography: 'Dr. Ashima Gaba serves as Guest Faculty at SSCBS specializing in Finance.',
    education: ['Ph.D. in Finance from Jamia Millia Islamia'],
    publications: []
  },
  {
    id: 'dr-ayushi-gupta-guest',
    name: 'Dr. Ayushi Gupta',
    qualification: 'Ph.D. (Ongoing) GGSIPU, New Delhi',
    designation: 'Guest Faculty',
    room: 'Guest Faculty Office',
    email: 'ayushigupta@sscbs.du.ac.in',
    phone: null,
    expertise: ['Internet of Things (IoT)', 'Machine Learning', 'Data Science'],
    photoUrl: null,
    profileUrl: 'https://sscbs.du.ac.in/guest-faculties/',
    biography: 'Dr. Ayushi Gupta is a Guest Faculty at SSCBS researching Internet of Things, Machine Learning, and Data Science.',
    education: ['Ph.D. (Ongoing), USIC&T, GGSIPU, New Delhi'],
    publications: []
  },
  {
    id: 'dr-deepali-dhaka-guest',
    name: 'Dr. Deepali Dhaka',
    qualification: 'Ph.D. in Computer Science (Jamia Millia Islamia)',
    designation: 'Guest Faculty',
    room: 'Guest Faculty Office',
    email: 'deepali@sscbs.du.ac.in',
    phone: null,
    expertise: ['Computer Science', 'Algorithms', 'Software Engineering'],
    photoUrl: null,
    profileUrl: 'https://sscbs.du.ac.in/guest-faculties/',
    biography: 'Dr. Deepali Dhaka is a Guest Faculty at SSCBS specializing in Computer Science.',
    education: ['Ph.D. in Computer Science from Jamia Millia Islamia, Delhi'],
    publications: []
  },
  {
    id: 'ms-divya-jain-guest',
    name: 'Ms. Divya Jain',
    qualification: 'Ph.D. (Pursuing), M.Phil.',
    designation: 'Guest Faculty',
    room: 'Guest Faculty Office',
    email: 'divyajain@sscbs.du.ac.in',
    phone: null,
    expertise: ['Management Studies', 'Business Analytics'],
    photoUrl: null,
    profileUrl: 'https://sscbs.du.ac.in/guest-faculties/',
    biography: 'Ms. Divya Jain serves as a Guest Faculty at SSCBS.',
    education: ['M.Phil.', 'Ph.D. (Pursuing)'],
    publications: []
  },
  {
    id: 'ms-divya-seth-guest',
    name: 'Ms. Divya Seth',
    qualification: 'M.A. Economics (Jamia Millia Islamia)',
    designation: 'Guest Faculty',
    room: 'Guest Faculty Office',
    email: 'divyaseth@sscbs.du.ac.in',
    phone: null,
    expertise: ['Economics', 'Microeconomics', 'Macroeconomics'],
    photoUrl: null,
    profileUrl: 'https://sscbs.du.ac.in/guest-faculties/',
    biography: 'Ms. Divya Seth is a Guest Faculty in Economics at SSCBS.',
    education: ['M.A. Economics from Jamia Millia Islamia'],
    publications: []
  },
  {
    id: 'dr-guncha-sharma-guest',
    name: 'Dr. Guncha Sharma',
    qualification: 'Ph.D. (University of Delhi)',
    designation: 'Guest Faculty',
    room: 'Guest Faculty Office',
    email: 'guncha@sscbs.du.ac.in',
    phone: null,
    expertise: ['Environmental Studies', 'Sustainability'],
    photoUrl: null,
    profileUrl: 'https://sscbs.du.ac.in/guest-faculties/',
    biography: 'Dr. Guncha Sharma serves as Guest Faculty at SSCBS in Environmental Studies.',
    education: ['Ph.D. from Department of Environmental Studies, University of Delhi'],
    publications: []
  },
  {
    id: 'ms-kajol-guest',
    name: 'Ms. Kajol',
    qualification: 'M.Com (SOL, University of Delhi)',
    designation: 'Guest Faculty',
    room: 'Guest Faculty Office',
    email: 'kajol@sscbs.du.ac.in',
    phone: null,
    expertise: ['Commerce', 'Accounting'],
    photoUrl: null,
    profileUrl: 'https://sscbs.du.ac.in/guest-faculties/',
    biography: 'Ms. Kajol is a Guest Faculty in Commerce at SSCBS.',
    education: ['M.Com from School of Open Learning, University of Delhi'],
    publications: []
  },
  {
    id: 'dr-monika-khemani-guest',
    name: 'Dr. Monika Khemani',
    qualification: 'Ph.D.',
    designation: 'Guest Faculty',
    room: 'Guest Faculty Office',
    email: 'monikakhemani@sscbs.du.ac.in',
    phone: null,
    expertise: ['Management Studies', 'Organizational Behavior'],
    photoUrl: null,
    profileUrl: 'https://sscbs.du.ac.in/guest-faculties/',
    biography: 'Dr. Monika Khemani is a Guest Faculty at SSCBS.',
    education: ['Ph.D.'],
    publications: []
  },
  {
    id: 'ms-palak-baghla-guest',
    name: 'Ms. Palak Baghla',
    qualification: 'M.A. Economics (Panjab University)',
    designation: 'Guest Faculty',
    room: 'Guest Faculty Office',
    email: 'palak@sscbs.du.ac.in',
    phone: null,
    expertise: ['Economics', 'Econometrics'],
    photoUrl: null,
    profileUrl: 'https://sscbs.du.ac.in/guest-faculties/',
    biography: 'Ms. Palak Baghla is a Guest Faculty in Economics at SSCBS.',
    education: ['M.A. Economics from Panjab University'],
    publications: []
  },
  {
    id: 'ms-priyanka-guest',
    name: 'Ms. Priyanka',
    qualification: 'M.Tech (IT)',
    designation: 'Guest Faculty',
    room: 'Guest Faculty Office',
    email: 'priyanka@sscbs.du.ac.in',
    phone: null,
    expertise: ['Information Technology', 'Software Engineering'],
    photoUrl: null,
    profileUrl: 'https://sscbs.du.ac.in/guest-faculties/',
    biography: 'Ms. Priyanka is a Guest Faculty in Information Technology at SSCBS.',
    education: ['M.Tech in Information Technology'],
    publications: []
  },
  {
    id: 'dr-rama-bansal-guest',
    name: 'Dr. Rama Bansal',
    qualification: 'Ph.D. in Computer Science',
    designation: 'Guest Faculty',
    room: 'Guest Faculty Office',
    email: 'ramabansal@sscbs.du.ac.in',
    phone: null,
    expertise: ['Computer Science', 'Data Structures'],
    photoUrl: null,
    profileUrl: 'https://sscbs.du.ac.in/guest-faculties/',
    biography: 'Dr. Rama Bansal is a Guest Faculty in Computer Science at SSCBS.',
    education: ['Ph.D. in Computer Science, Jagannath University, Haryana'],
    publications: []
  },
  {
    id: 'ms-ruchi-singhal-guest',
    name: 'Ms. Ruchi Singhal',
    qualification: 'MCA (GGSIPU)',
    designation: 'Guest Faculty',
    room: 'Guest Faculty Office',
    email: 'ruchisinghal@sscbs.du.ac.in',
    phone: null,
    expertise: ['Computer Applications', 'Web Development'],
    photoUrl: null,
    profileUrl: 'https://sscbs.du.ac.in/guest-faculties/',
    biography: 'Ms. Ruchi Singhal is a Guest Faculty in Computer Applications at SSCBS.',
    education: ['Master of Computer Applications (MCA), GGSIPU'],
    publications: []
  },
  {
    id: 'dr-saima-guest',
    name: 'Dr. Saima',
    qualification: 'Ph.D (Marketing) Jamia Millia Islamia',
    designation: 'Guest Faculty',
    room: 'Guest Faculty Office',
    email: 'saima@sscbs.du.ac.in',
    phone: null,
    expertise: ['Marketing', 'Consumer Behavior'],
    photoUrl: null,
    profileUrl: 'https://sscbs.du.ac.in/guest-faculties/',
    biography: 'Dr. Saima is a Guest Faculty specializing in Marketing at SSCBS.',
    education: ['Ph.D. in Marketing from Jamia Millia Islamia'],
    publications: []
  },
  {
    id: 'dr-shevata-sehgal-marwah-guest',
    name: 'Dr. Shevata Sehgal Marwah',
    qualification: 'Ph.D in Marketing (University of Delhi)',
    designation: 'Guest Faculty',
    room: 'Guest Faculty Office',
    email: 'shevata@sscbs.du.ac.in',
    phone: null,
    expertise: ['Marketing Management', 'Brand Strategy'],
    photoUrl: null,
    profileUrl: 'https://sscbs.du.ac.in/guest-faculties/',
    biography: 'Dr. Shevata Sehgal Marwah is a Guest Faculty in Marketing at SSCBS.',
    education: ['Ph.D. in Marketing, Department of Commerce, University of Delhi'],
    publications: []
  },
  {
    id: 'dr-shiva-kapoor-guest',
    name: 'Dr. Shiva Kapoor',
    qualification: 'Ph.D. in Optimization (University of Delhi)',
    designation: 'Guest Faculty',
    room: 'Guest Faculty Office',
    email: 'shiva@sscbs.du.ac.in',
    phone: null,
    expertise: ['Optimization', 'Mathematics', 'Operations Research'],
    photoUrl: null,
    profileUrl: 'https://sscbs.du.ac.in/guest-faculties/',
    biography: 'Dr. Shiva Kapoor is a Guest Faculty in Mathematics and Optimization at SSCBS.',
    education: ['Ph.D. in Optimization from Department of Mathematics, University of Delhi'],
    publications: []
  },
  {
    id: 'dr-simple-arora-guest',
    name: 'Dr. Simple Arora',
    qualification: 'Ph.D.',
    designation: 'Guest Faculty',
    room: 'Guest Faculty Office',
    email: 'simplearora@sscbs.du.ac.in',
    phone: null,
    expertise: ['Management Studies'],
    photoUrl: null,
    profileUrl: 'https://sscbs.du.ac.in/guest-faculties/',
    biography: 'Dr. Simple Arora is a Guest Faculty at SSCBS.',
    education: ['Ph.D.'],
    publications: []
  },
  {
    id: 'mr-vineet-kumar-guest',
    name: 'Mr. Vineet Kumar',
    qualification: 'M.Sc (Electronics), MBA, LLB, Research Scholar',
    designation: 'Guest Faculty',
    room: 'Guest Faculty Office',
    email: 'vineet@sscbs.du.ac.in',
    phone: null,
    expertise: ['Electronics', 'Marketing & Finance', 'Business Law'],
    photoUrl: null,
    profileUrl: 'https://sscbs.du.ac.in/guest-faculties/',
    biography: 'Mr. Vineet Kumar is a Guest Faculty at SSCBS with qualifications in Electronics, MBA (Marketing & Finance), LLB, and Business Management.',
    education: [
      'M.Sc. (Electronics)',
      'MBA (Marketing & Finance)',
      'LLB',
      'Research Scholar in Business Management'
    ],
    publications: []
  }
];

// Append guest entries without duplicates
let addedCount = 0;
guestEntries.forEach(guest => {
  if (!dataset.some(p => p.id === guest.id || p.email === guest.email)) {
    dataset.push(guest);
    addedCount++;
  }
});

fs.writeFileSync(jsonPath, JSON.stringify(dataset, null, 2));

console.log(`Successfully added ${addedCount} Guest Faculty members! Total faculty count is now: ${dataset.length}`);
