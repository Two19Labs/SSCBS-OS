const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '..', 'src', 'data', 'faculty_directory.json');
let dataset = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

const guestPhotoMap = {
  'dr-ajay-kumar-guest': 'https://sscbs.du.ac.in/wp-content/uploads/2024/11/Dr.-Ajay-Kumar-236x300.jpg',
  'dr-ankita-arora-guest': 'https://sscbs.du.ac.in/wp-content/uploads/2024/11/Ankita_Photo_180315-233x300.jpg',
  'dr-ashima-gaba-guest': 'https://sscbs.du.ac.in/wp-content/uploads/2024/11/Aashima-Gaba-233x300.jpg',
  'dr-ayushi-gupta-guest': 'https://sscbs.du.ac.in/wp-content/uploads/2024/09/IMG_5347.jpg',
  'dr-deepali-dhaka-guest': 'https://sscbs.du.ac.in/wp-content/uploads/2024/09/PHOTO-2024-08-27-10-59-44-240x300.jpg',
  'ms-divya-jain-guest': 'https://sscbs.du.ac.in/wp-content/uploads/2024/11/Divya-Jain-233x300.jpg',
  'ms-divya-seth-guest': 'https://sscbs.du.ac.in/wp-content/uploads/2024/11/Divya-300x300.webp',
  'dr-guncha-sharma-guest': 'https://sscbs.du.ac.in/wp-content/uploads/2024/11/GUNCHA-SHARMA-PHOTOGRAPH-264x300.jpg',
  'ms-kajol-guest': 'https://sscbs.du.ac.in/wp-content/uploads/2024/11/KAJOL-PHOTO-250x300.jpg',
  'dr-monika-khemani-guest': 'https://sscbs.du.ac.in/wp-content/uploads/2024/11/DR.MONIKA_KHEMANI_PIC-236x300.jpeg',
  'ms-palak-baghla-guest': 'https://sscbs.du.ac.in/wp-content/uploads/2024/11/PIC-64kb-231x300.jpg',
  'ms-priyanka-guest': 'https://sscbs.du.ac.in/wp-content/uploads/2024/11/Priyanka.png',
  'dr-rama-bansal-guest': 'https://sscbs.du.ac.in/wp-content/uploads/2024/11/rama-200x300.jpg',
  'ms-ruchi-singhal-guest': 'https://sscbs.du.ac.in/wp-content/uploads/2024/11/Ruchi-Singhal.jpg',
  'dr-saima-guest': 'https://sscbs.du.ac.in/wp-content/uploads/2024/11/IMG_20240905_194320-225x300.jpg',
  'dr-shevata-sehgal-marwah-guest': null,
  'dr-shiva-kapoor-guest': 'https://sscbs.du.ac.in/wp-content/uploads/2024/11/Photo-239x300.jpeg',
  'dr-simple-arora-guest': 'https://sscbs.du.ac.in/wp-content/uploads/2024/11/IMG-20240903-WA0000-187x300.jpg',
  'mr-vineet-kumar-guest': 'https://sscbs.du.ac.in/wp-content/uploads/2024/11/Photo-3-235x300.jpg'
};

dataset = dataset.map(prof => {
  if (guestPhotoMap.hasOwnProperty(prof.id)) {
    return {
      ...prof,
      photoUrl: guestPhotoMap[prof.id]
    };
  }
  return prof;
});

fs.writeFileSync(jsonPath, JSON.stringify(dataset, null, 2));

const updatedCount = dataset.filter(p => p.designation === 'Guest Faculty' && p.photoUrl).length;
console.log(`Successfully assigned correct photo headshots to Guest Faculty members! (${updatedCount} with photos)`);
