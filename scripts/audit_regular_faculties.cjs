const fs = require('fs');
const path = require('path');

const facultyDir = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/faculty_directory.json'), 'utf-8'));

const regularProfs = facultyDir.filter(p => p.designation !== 'Guest Faculty');
console.log(`Regular Faculty count in JSON: ${regularProfs.length}`);

regularProfs.forEach((prof, i) => {
  console.log(`${i+1}. ID: ${prof.id} | Name: ${prof.name} | Photo: ${prof.photoUrl || 'NONE'}`);
});
