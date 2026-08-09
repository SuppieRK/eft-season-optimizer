const fs = require('node:fs');
const path = require('node:path');

const sharp = require('sharp');

const documents = JSON.parse(fs.readFileSync('public/data/documents.json', 'utf8'));

async function generateAssets() {
  for (const document of documents.documents) {
    const source = path.join('public', document.imagePath.replace(/^\//u, ''));
    const extension = path.extname(source);
    const stem = source.slice(0, -extension.length);
    for (const size of [192, 384]) {
      await sharp(source)
        .resize(size, size, { fit: 'cover' })
        .webp({ quality: 84 })
        .toFile(`${stem}-${size}.webp`);
    }
  }
  await sharp('public/assets/social/eft-season-optimizer.svg')
    .png({ compressionLevel: 9 })
    .toFile('public/assets/social/eft-season-optimizer.png');
}

generateAssets().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
