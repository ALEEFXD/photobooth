/**
 * Express server entry point.
 * Serves the API, static output files, and in production the built React SPA.
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

import cameraRoutes from './routes/camera.js';
import folderRoutes from './routes/folders.js';
import frameRoutes from './routes/frames.js';
import draftRoutes from './routes/drafts.js';
import resultRoutes from './routes/results.js';
import configRoutes from './routes/config.js';
import { getOutputRoot, readConfig } from './utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const app = express();

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API routes
app.use('/api/camera', cameraRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/frames', frameRoutes);
app.use('/api/drafts', draftRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/config', configRoutes);

// Serve output files (drafts + results)
const outputRoot = getOutputRoot();
mkdirSync(outputRoot, { recursive: true });
app.use('/output', express.static(outputRoot));

// Serve frame images directly
app.use('/frames', express.static(path.join(ROOT, 'frames')));

// Determine mode: production (dist exists) or development
const isProduction = existsSync(path.join(DIST, 'index.html'));
const PORT = isProduction ? (process.env.PORT || 3000) : 3001;

if (isProduction) {
  // Serve built client assets
  app.use(express.static(DIST));

  // SPA fallback: serve index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST, 'index.html'));
  });
}

app.listen(PORT, () => {
  const mode = isProduction ? 'PRODUCTION' : 'DEVELOPMENT (API only)';
  console.log(`
╔══════════════════════════════════════════╗
║           PHOTOBOOTH SERVER              ║
╠══════════════════════════════════════════╣
║  Mode:   ${mode.padEnd(30)}║
║  URL:    http://localhost:${String(PORT).padEnd(17)}║
║  Folder: ${readConfig().activeFolder.padEnd(30)}║
╚══════════════════════════════════════════╝
  `);
});
