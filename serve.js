const express = require('express');
const path = require('path');
const app = express();

const distPath = path.join(__dirname, 'rms_frontend', 'dist');

// Serve static files from Vite build output
app.use(express.static(distPath));

// SPA fallback — all routes serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CSS RMS serving on port ${PORT}`));
