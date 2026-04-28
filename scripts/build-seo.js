const { build } = require('../traffic-system');

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
