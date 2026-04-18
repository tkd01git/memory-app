import { getDriveClientFromCookies, getOrCreateFolder, json, readBody, saveJsonFile } from '../../_utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const body = await readBody(req);
    const drive = await getDriveClientFromCookies(req);
    const appFolder = await getOrCreateFolder(drive, 'shared-memory-app');
    const saved = await saveJsonFile(drive, 'memories-data.json', body.data || {}, appFolder.id);
    return json(res, 200, { ok: true, file: saved });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
}
