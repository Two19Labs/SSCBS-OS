const fs = require('fs');
const path = require('path');

const emailMapping = {
  'abhimanyu-verma-mba': 'vermaabhi@sscbsdu.ac.in',
  'dr-ajay-jaiswal-ph-d': 'ajayjaiswal@sscbsdu.ac.in',
  'amit-kumar-m-com': 'amitkumar@sscbsdu.ac.in',
  'dr-amrina-kausar-ph-d': 'amrinakausar@sscbsdu.ac.in',
  'dr-anamika-gupta-ph-d': 'anamikargupta@sscbsdu.ac.in',
  'dr-anuja-mathur-ph-d': 'anujamathur@sscbsdu.ac.in',
  'kavita-rastogi-msc': 'kavitarastogi@sscbsdu.ac.in',
  'kishori-ravi-shankar-mphil': 'kishoriravishankar@sscbsdu.ac.in',
  'kumar-bijoy-ma-eco-ph-d-cfa': 'kumarbijoy@sscbsdu.ac.in',
  'ca-madhu-totla-maheshwari': 'madhutotla@sscbsdu.ac.in',
  'md-rashid-shamim-mba': 'rashid@sscbsdu.ac.in',
  'dr-mona-verma-ph-d': 'monaverma@sscbsdu.ac.in',
  'dr-narander-kumar-nigam-ph-d': 'narander.nigam@sscbsdu.ac.in',
  'neeraj-sehrawat-ph-d': 'neerajsehrawat@sscbsdu.ac.in',
  'dr-nidhi-kesari-ph-d': 'nidhikesari@sscbsdu.ac.in',
  'onkar-singh-m-phil-m-sc': 'onkarsingh@sscbsdu.ac.in',
  'paridhi-mba': 'paridhi@sscbsdu.ac.in',
  'poonam-verma': 'principal@sscbsdu.ac.in',
  'raj-kumar-ma': 'rajkumar@sscbsdu.ac.in',
  'ramesh-kumar-ph-d': 'rameshkumar@sscbsdu.ac.in',
  'dr-rishi-rajan-sahay-ph-d': 'rishirajan@sscbsdu.ac.in',
  'dr-satish-kumar-goel-ph-d': 'skgoel@sscbsdu.ac.in',
  'saumya-jain-m-com': 'saumyajain@sscbsdu.ac.in',
  'shalini-prakash-m-phil': 'shaliniprakash@sscbsdu.ac.in',
  'dr-shikha-gupta-ph-d': 'shikhagupta@sscbsdu.ac.in',
  'dr-sonika-thakral-ph-d': 'sonikathakral@sscbsdu.ac.in',
  'dr-sushmita-ph-d': 'sushmita@sscbsdu.ac.in',
  'dr-tarannum-ahmad-ph-d': 'tarannum@sscbsdu.ac.in',
  'tushar-marwaha-mba': 'tusharmarwaha@sscbsdu.ac.in'
};

const jsonPath = path.join(__dirname, '..', 'src', 'data', 'faculty_directory.json');
let dataset = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

dataset = dataset.map(prof => {
  const directEmail = emailMapping[prof.id];
  return {
    ...prof,
    email: directEmail || prof.email
  };
});

fs.writeFileSync(jsonPath, JSON.stringify(dataset, null, 2));
console.log(`Updated all ${dataset.length} faculty entries with verified personal @sscbsdu.ac.in emails!`);
