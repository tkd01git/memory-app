import { getDriveClientFromCookies, json } from '../../_utils.js';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const fileId = url.searchParams.get('fileId');
    if (!fileId) return json(res, 400, { error: 'Missing fileId' });

    const drive = await getDriveClientFromCookies(req);
    const meta = await drive.files.get({ fileId, fields: 'mimeType,name' });
    const fileRes = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    res.statusCode = 200;
    res.setHeader('Content-Type', meta.data.mimeType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.end(Buffer.from(fileRes.data));
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
}
