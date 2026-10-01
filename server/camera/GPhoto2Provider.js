/**
 * GPhoto2 camera provider for Linux/macOS DSLR cameras.
 * Wraps the gphoto2 CLI tool.
 */
import { execSync, spawn } from 'child_process';

export class GPhoto2Provider {
  constructor() {
    this.name = 'gphoto2';
    this.type = 'dslr';
  }

  async isAvailable() {
    try {
      // Check if gphoto2 binary exists
      const cmd = process.platform === 'win32' ? 'where gphoto2' : 'which gphoto2';
      execSync(cmd, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  async detect() {
    if (!(await this.isAvailable())) {
      return { found: false, reason: 'gphoto2 is not installed.' };
    }
    try {
      const output = execSync('gphoto2 --auto-detect', { timeout: 10000 }).toString();
      const lines = output.split('\n').slice(2).filter(l => l.trim());
      if (lines.length > 0) {
        const model = lines[0].trim().split(/\s{2,}/)[0];
        return { found: true, model, provider: this.name };
      }
      return { found: false, reason: 'No camera detected via gphoto2.' };
    } catch (err) {
      return { found: false, reason: `gphoto2 detection failed: ${err.message}` };
    }
  }

  async capture(outputPath) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error('Capture timed out after 30 seconds.'));
      }, 30000);

      const proc = spawn('gphoto2', [
        '--capture-image-and-download',
        '--filename', outputPath,
        '--force-overwrite',
      ]);

      let stderr = '';
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(outputPath);
        else reject(new Error(`gphoto2 capture failed (code ${code}): ${stderr}`));
      });
      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`Failed to spawn gphoto2: ${err.message}`));
      });
    });
  }
}
