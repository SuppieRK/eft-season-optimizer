const fs = require('node:fs');

function validateReleaseCatalogs(localization, documents) {
  const issues = [];
  if (/development-only/i.test(localization.releaseStatus ?? '')) issues.push('localization.releaseStatus is development-only');
  const locales = localization.supportedLocales ?? [];
  for (const entry of [...(localization.entries ?? []), ...(localization.priceEntries ?? [])]) {
    for (const locale of locales) {
      if (!entry.localizations?.[locale]) issues.push(`${entry.id} is missing ${locale}`);
      const value = entry.localizations?.[locale];
      const text = typeof value === 'string' ? value : JSON.stringify(value);
      if (/pending|placeholder|todo|tbd/i.test(text)) issues.push(`${entry.id} contains development placeholder text`);
    }
  }
  for (const document of documents.documents ?? []) {
    if (!document.descriptionId || !document.imageAltId) issues.push(`${document.id} lacks reviewed description or image alternative`);
  }
  return issues;
}

if (require.main === module) {
  const localization = JSON.parse(fs.readFileSync('public/data/localization.json', 'utf8'));
  const documents = JSON.parse(fs.readFileSync('public/data/documents.json', 'utf8'));
  const issues = validateReleaseCatalogs(localization, documents);
  if (issues.length > 0) {
    console.error(issues.map((issue) => `- ${issue}`).join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Release localization gate passed.');
  }
}

module.exports = { validateReleaseCatalogs };
