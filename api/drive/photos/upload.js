import { getDriveClientFromCookies, getOrCreateFolder, json, readBody, saveImageFile } from '../../_utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const body = await readBody(req);

    const date = body.date || body.dateKey || '';
    const base64DataUrl = body.base64DataUrl || body.dataUrl || body.imageData || '';
    const originalFileName = body.originalFileName || body.fileName || '';

    if (!date || !base64DataUrl) {
      return json(res, 400, {
        error: 'Missing date or image data',
        received: {
          hasDate: Boolean(date),
          hasBase64DataUrl: Boolean(base64DataUrl),
          bodyKeys: Object.keys(body || {})
        }
      });
    }

    const match = String(base64DataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return json(res, 400, { error: 'Invalid image data URL' });

    const mimeType = match[1];
    const base64 = match[2];
    const buffer = Buffer.from(base64, 'base64');

    const extMap = {
      'image/png': 'png',
      'image/webp': 'webp',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/heic': 'heic',
      'image/heif': 'heif'
    };
    const ext = extMap[mimeType] || 'jpg';

    const safeBaseName = originalFileName
      ? String(originalFileName).replace(/\.[^.]+$/, '').replace(/[^\w\-ぁ-んァ-ヶ一-龠]/g, '_')
      : date;

    const fileName = `${date}_${safeBaseName}.${ext}`;

    const drive = await getDriveClientFromCookies(req);
    const appFolder = await getOrCreateFolder(drive, 'shared-memory-app');
    const photoFolder = await getOrCreateFolder(drive, 'daily-photos', appFolder.id);

    const file = await saveImageFile({
      drive,
      folderId: photoFolder.id,
      fileName,
      mimeType,
      buffer
    });

    return json(res, 200, { ok: true, file });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
}
