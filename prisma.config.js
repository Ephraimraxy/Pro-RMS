const { defineConfig } = require('prisma/config');

module.exports = defineConfig({
  schema: 'rms_backend/prisma/schema.prisma',
  seed: 'node rms_backend/prisma/seed.js'
});
