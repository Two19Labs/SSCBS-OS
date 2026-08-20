const fs = require('fs');
const path = require('path');

const facultyDir = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/faculty_directory.json'), 'utf-8'));

console.log(`Total professors in directory: ${facultyDir.length}`);

// Check guest faculty mapping
const guestProfs = facultyDir.filter(p => p.designation === 'Guest Faculty');
console.log(`Guest Faculty count in JSON: ${guestProfs.length}`);

guestProfs.forEach((prof, i) => {
  console.log(`${i+1}. ID: ${prof.id} | Name: ${prof.name} | Photo: ${prof.photoUrl || 'NONE'}`);
});
