import { getDriveClientFromCookies, getOrCreateFolder, json, readBody, saveImageFile } from '../../_utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const { date, base64DataUrl, originalFileName, mimeType: clientMimeType } = await readBody(req);
    if (!date || !base64DataUrl) return json(res, 400, { error: 'Missing date or image data' });

    const match = String(base64DataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return json(res, 400, { error: 'Invalid image data URL' });

    const mimeType = clientMimeType || match[1];
    const base64 = match[2];
    const buffer = Buffer.from(base64, 'base64');

    const normalizedOriginalName = typeof originalFileName === 'string' ? originalFileName.trim() : '';
    const safeOriginalName = normalizedOriginalName.replace(/[\\/:*?"<>|]/g, '_');
    const fileName = safeOriginalName ? `${date}__${safeOriginalName}` : `${date}`;

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
