import { getDriveClientFromCookies, getOrCreateFolder, json, loadJsonFile } from '../../_utils.js';

export default async function handler(req, res) {
  try {
    const drive = await getDriveClientFromCookies(req);
    const appFolder = await getOrCreateFolder(drive, 'shared-memory-app');
    const data = await loadJsonFile(drive, 'memories-data.json', appFolder.id);
    return json(res, 200, { data });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
}
