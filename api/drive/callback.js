import { getOAuth2Client } from '../_utils.js';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const code = url.searchParams.get('code');
    if (!code) {
      res.statusCode = 400;
      return res.end('Missing code');
    }

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    res.setHeader(
      'Set-Cookie',
      `memory_app_tokens=${encodeURIComponent(JSON.stringify(tokens))}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`
    );
    res.statusCode = 302;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Location', '/');
    res.end();
  } catch (error) {
    res.statusCode = 500;
    res.end(error.message);
  }
}
