const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

async function extractDivipole() {
  const pdfPath = path.join(__dirname, '../../temp/DIVIPOLE 2026.pdf');
  const dataBuffer = fs.readFileSync(pdfPath);

  console.log('Reading PDF...');
  
  const data = await pdfParse(dataBuffer);
  
  const lines = data.text.split('\n');
  console.log(`Total lines: ${lines.length}`);
  
  // We need to look for department 28 (Sucre).
  // Let's print some lines to understand the format.
  // Sucre is usually "28" or "SUCRE".
  
  let sucreStarted = false;
  let count = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes('SUCRE')) {
      sucreStarted = true;
    }
    
    if (sucreStarted && count < 100) {
      console.log(line);
      count++;
    }
    
    if (count >= 100) break;
  }
}

extractDivipole().catch(console.error);
