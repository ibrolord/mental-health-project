import { v4 as uuidv4 } from 'uuid';

const SESSION_KEY = 'mh_session_id';

/**
 * Get or create an anonymous session ID
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') return '';

  let sessionId = localStorage.getItem(SESSION_KEY);
  
  if (!sessionId) {
    sessionId = `session_${uuidv4()}`;
    localStorage.setItem(SESSION_KEY, sessionId);
  }

  return sessionId;
}

/**
 * Clear the current session
 */
export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Generate a simple device fingerprint (non-invasive)
 */
export function getDeviceFingerprint(): string {
  if (typeof window === 'undefined') return '';

  const components = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset(),
    screen.width,
    screen.height,
    screen.colorDepth,
  ];

  // Simple hash function
  return components.join('|');
}

