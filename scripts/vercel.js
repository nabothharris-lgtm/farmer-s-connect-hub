import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const distClient = path.join(root, 'dist', 'client');
const distRoot = path.join(root, 'dist');
const tempDir = path.join(root, 'dist-temp');

if (fs.existsSync(distClient)) {
  fs.renameSync(distClient, tempDir);
  fs.rmSync(distRoot, { recursive: true, force: true });
  fs.renameSync(tempDir, distRoot);
  console.log('Successfully prepared static files for Vercel in dist/');
}
