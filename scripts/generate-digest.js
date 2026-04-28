const { build } = require('../traffic-system');

build().then(() => {
  console.log('Newsletter draft generated at traffic/newsletter-draft.md and traffic/newsletter-draft.html');
}).catch((err) => {
  console.error('Newsletter draft generation failed:', err);
  process.exit(1);
});
