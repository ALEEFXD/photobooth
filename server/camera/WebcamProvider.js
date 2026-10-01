/**
 * Webcam fallback provider.
 * Signals the client to use getUserMedia for capture.
 * Capture is handled entirely client-side; the server only stores the result.
 */
export class WebcamProvider {
  constructor() {
    this.name = 'webcam';
    this.type = 'webcam';
  }

  async isAvailable() {
    return true; // Browser webcam is always "available" from server's perspective
  }

  async detect() {
    return {
      found: true,
      model: 'Browser Webcam (getUserMedia)',
      provider: this.name,
    };
  }

  async capture() {
    // Webcam capture is handled client-side via getUserMedia.
    // The client sends the captured frame as base64 to POST /api/drafts.
    throw new Error(
      'Webcam capture is handled client-side. ' +
      'Use POST /api/drafts to save the captured image.'
    );
  }
}
