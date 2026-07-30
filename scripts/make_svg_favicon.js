import fs from 'fs';

const pngPath = './public/favicon.png';
const svgPath = './public/favicon.svg';

const base64Png = fs.readFileSync(pngPath).toString('base64');
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <image href="data:image/png;base64,${base64Png}" width="512" height="512"/>
</svg>
`;

fs.writeFileSync(svgPath, svgContent, 'utf-8');
console.log('Updated public/favicon.svg successfully!');
