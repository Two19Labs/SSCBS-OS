const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '..', 'src', 'data', 'faculty_directory.json');
let dataset = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

const phoneMap = {
  "dr-anamika-gupta-ph-d": "+91-981-071-9720",
  "kavita-rastogi-msc": "+91-981-051-0518",
  "kishori-ravi-shankar-mphil": "+91-996-806-7846",
  "kumar-bijoy-ma-eco-ph-d-cfa": "+91-981-045-2266",
  "ca-madhu-totla-maheshwari": "+91-955-575-9554",
  "md-rashid-shamim-mba": "+91-882-695-6640",
  "dr-narander-kumar-nigam-ph-d": "+91-987-304-1007",
  "neeraj-sehrawat-ph-d": "+91-701-544-8335",
  "dr-nidhi-kesari-ph-d": "+91-886-055-0930",
  "onkar-singh-m-phil-m-sc": "+91-991-122-9493",
  "paridhi-mba": "+91-995-827-7936",
  "raj-kumar-ma": "+91-971-147-3663",
  "ramesh-kumar-ph-d": "+91-989-130-0888",
  "dr-rishi-rajan-sahay-ph-d": "+91-981-801-1766",
  "dr-satish-kumar-goel-ph-d": "+91-989-198-9391",
  "saumya-jain-m-com": "+91-844-746-2648",
  "shalini-prakash-m-phil": "+91-987-342-4231",
  "dr-sonika-thakral-ph-d": "+91-987-303-3306",
  "dr-tarannum-ahmad-ph-d": "+91-981-114-7285",
  "tushar-marwaha-mba": "+91-987-137-1441"
};

dataset = dataset.map(prof => ({
  ...prof,
  phone: phoneMap[prof.id] || null
}));

fs.writeFileSync(jsonPath, JSON.stringify(dataset, null, 2));

const count = dataset.filter(p => p.phone).length;
console.log(`Cleaned dataset! Total professors with verified mobile numbers: ${count}`);
