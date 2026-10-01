/**
 * Camera detection and provider selection.
 * Detects platform, checks for DSLR CLI tools, falls back to webcam.
 */
import { GPhoto2Provider } from './GPhoto2Provider.js';
import { DigiCamProvider } from './DigiCamProvider.js';
import { WebcamProvider } from './WebcamProvider.js';

let activeProvider = null;
let lastStatus = null;
let availableProviders = ['webcam']; // webcam is always available
let dslrProvider = null; // cached DSLR provider instance

/**
 * Detect the best available camera provider.
 * Priority: DSLR (platform-specific) → Webcam fallback.
 */
export async function detectCamera() {
  const warnings = [];
  availableProviders = ['webcam']; // reset; webcam always available
  dslrProvider = null;

  if (process.platform === 'win32') {
    const digicam = new DigiCamProvider();
    if (await digicam.isAvailable()) {
      const result = await digicam.detect();
      if (result.found) {
        dslrProvider = digicam;
        availableProviders.unshift('dslr');
        activeProvider = digicam;
        lastStatus = {
          type: 'dslr',
          provider: 'digicam',
          model: result.model,
          message: `DSLR connected via digiCamControl.`,
        };
        return lastStatus;
      }
      warnings.push(result.reason);
    } else {
      warnings.push(
        'digiCamControl is not installed. ' +
        'Install it from https://digicamcontrol.com for DSLR support on Windows.'
      );
    }
  } else {
    // Linux / macOS
    const gphoto = new GPhoto2Provider();
    if (await gphoto.isAvailable()) {
      const result = await gphoto.detect();
      if (result.found) {
        dslrProvider = gphoto;
        availableProviders.unshift('dslr');
        activeProvider = gphoto;
        lastStatus = {
          type: 'dslr',
          provider: 'gphoto2',
          model: result.model,
          message: `DSLR connected via gphoto2.`,
        };
        return lastStatus;
      }
      warnings.push(result.reason);
    } else {
      warnings.push(
        'gphoto2 is not installed. ' +
        'Install it via your package manager (e.g. apt install gphoto2) for DSLR support.'
      );
    }
  }

  // Fallback to webcam
  activeProvider = new WebcamProvider();
  lastStatus = {
    type: 'webcam',
    provider: 'webcam',
    model: 'Browser Webcam',
    message: 'No DSLR found. Using browser webcam.',
    warnings,
  };
  return lastStatus;
}

/**
 * Get the currently active camera provider.
 */
export function getProvider() {
  return activeProvider;
}

/**
 * Get cached camera status (or re-detect).
 */
export async function getStatus() {
  if (!lastStatus) {
    return detectCamera();
  }
  return lastStatus;
}

/**
 * Force re-detection (e.g. user plugged in a camera).
 */
export async function refreshCamera() {
  activeProvider = null;
  lastStatus = null;
  return detectCamera();
}

/**
 * Get all available camera provider types on this system.
 * Always includes 'webcam'; includes 'dslr' only if detected.
 */
export function getAvailableProviders() {
  return availableProviders;
}

/**
 * Manually switch the active camera to the given type.
 * @param {'dslr'|'webcam'} type
 */
export async function switchCamera(type) {
  if (type === 'webcam') {
    activeProvider = new WebcamProvider();
    lastStatus = {
      type: 'webcam',
      provider: 'webcam',
      model: 'Browser Webcam',
      message: 'Switched to browser webcam.',
    };
    return lastStatus;
  }

  if (type === 'dslr') {
    if (!dslrProvider) {
      throw new Error('No DSLR provider available on this system.');
    }
    // Re-detect to ensure camera is still connected
    const result = await dslrProvider.detect();
    if (!result.found) {
      throw new Error(result.reason || 'DSLR camera is no longer connected.');
    }
    activeProvider = dslrProvider;
    lastStatus = {
      type: 'dslr',
      provider: dslrProvider.name,
      model: result.model,
      message: `Switched to DSLR (${dslrProvider.name}).`,
    };
    return lastStatus;
  }

  throw new Error(`Unknown camera type: ${type}`);
}
