import { getOAuth2Client, json } from '../_utils.js';

export default async function handler(req, res) {
  try {
    const oauth2Client = getOAuth2Client();
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/drive.file']
    });
    // フロント (app.js) は data.url を参照するため、キー名を "url" にそろえる
    return json(res, 200, { url: authUrl });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
}
