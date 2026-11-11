import { configured, isLoggedIn, json } from '../lib/auth.mjs';

export function GET(req) {
  return json({ configured: configured(), loggedIn: isLoggedIn(req) });
}
