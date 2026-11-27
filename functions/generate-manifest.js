const fs = require('fs');
const path = require('path');

try {
  const loaderPath = path.resolve(__dirname, '../node_modules/firebase-functions/lib/runtime/loader.js');
  const manifestPath = path.resolve(__dirname, '../node_modules/firebase-functions/lib/runtime/manifest.js');

  const loader = require(loaderPath);
  const manifest = require(manifestPath);

  const functionsDir = __dirname;
  loader.loadStack(functionsDir).then((stack) => {
    const wire = manifest.stackToWire(stack);
    const yamlPath = path.join(functionsDir, 'functions.yaml');
    fs.writeFileSync(yamlPath, JSON.stringify(wire, null, 2), 'utf8');
    console.log('[manifest] functions.yaml generated successfully! (' + Object.keys(wire.endpoints || {}).length + ' endpoints)');
  }).catch((err) => {
    console.warn('[manifest] Warning: could not generate functions.yaml automatically:', err.message);
  });
} catch (e) {
  console.warn('[manifest] Skipping manifest generation:', e.message);
}
