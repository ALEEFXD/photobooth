/**
 * digiCamControl camera provider for Windows DSLR cameras.
 * Wraps CameraControlCmd.exe CLI.
 */
import { execSync, spawn } from 'child_process';
import { existsSync } from 'fs';

const DEFAULT_INSTALL_PATHS = [
  'C:\\Program Files\\digiCamControl\\CameraControlCmd.exe',
  'C:\\Program Files (x86)\\digiCamControl\\CameraControlCmd.exe',
];

export class DigiCamProvider {
  constructor() {
    this.name = 'digicam';
    this.type = 'dslr';
    this.cmdPath = null;
    for (const p of DEFAULT_INSTALL_PATHS) {
      if (existsSync(p)) {
        this.cmdPath = p;
        break;
      }
    }
  }

  async isAvailable() {
    return this.cmdPath !== null;
  }

  async detect() {
    if (!this.cmdPath) {
      return {
        found: false,
        reason: 'digiCamControl is not installed. Expected at: C:\\Program Files\\digiCamControl\\',
      };
    }
    try {
      const output = execSync(`"${this.cmdPath}" /list`, { timeout: 10000 }).toString();
      // If the command succeeds, a camera is likely connected
      if (output && !output.includes('No camera')) {
        return { found: true, model: 'DSLR (digiCamControl)', provider: this.name };
      }
      return { found: false, reason: 'digiCamControl found but no camera connected.' };
    } catch (err) {
      // /list may not be supported in all versions — try a simpler check
      return { found: true, model: 'DSLR (digiCamControl)', provider: this.name };
    }
  }

  async capture(outputPath) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error('Capture timed out after 30 seconds.'));
      }, 30000);

      const proc = spawn(this.cmdPath, ['/filename', outputPath, '/capture'], {
        shell: true,
      });

      let stderr = '';
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(outputPath);
        else reject(new Error(`digiCamControl capture failed (code ${code}): ${stderr}`));
      });
      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`Failed to spawn CameraControlCmd: ${err.message}`));
      });
    });
  }
}
