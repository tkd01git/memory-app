import { google } from 'googleapis';

export function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

export function getOAuth2Client() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new Error('Missing Google OAuth environment variables');
  }
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

export function parseCookie(cookieHeader = '') {
  const out = {};
  cookieHeader.split(';').forEach(part => {
    const [key, ...rest] = part.trim().split('=');
    if (!key) return;
    out[key] = decodeURIComponent(rest.join('=') || '');
  });
  return out;
}

export async function getDriveClientFromCookies(req) {
  const cookies = parseCookie(req.headers.cookie || '');
  if (!cookies.memory_app_tokens) throw new Error('Not authenticated with Google Drive');

  const tokens = JSON.parse(cookies.memory_app_tokens);
  const auth = getOAuth2Client();
  auth.setCredentials(tokens);
  return google.drive({ version: 'v3', auth });
}

export async function findFileByName(drive, name, parentId) {
  const conditions = [
    `name='${name.replace(/'/g, "\\'")}'`,
    'trashed=false'
  ];
  if (parentId) conditions.push(`'${parentId}' in parents`);

  const res = await drive.files.list({
    q: conditions.join(' and '),
    spaces: 'drive',
    pageSize: 1,
    fields: 'files(id,name,mimeType,parents)'
  });
  return res.data.files?.[0] || null;
}

export async function getOrCreateFolder(drive, folderName, parentId = null) {
  const existing = await findFileByName(drive, folderName, parentId);
  if (existing?.mimeType === 'application/vnd.google-apps.folder') return existing;

  const requestBody = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  };
  if (parentId) requestBody.parents = [parentId];

  const res = await drive.files.create({
    requestBody,
    fields: 'id,name,mimeType'
  });
  return res.data;
}

export async function saveJsonFile(drive, name, data, parentId = null) {
  const existing = await findFileByName(drive, name, parentId);
  const media = {
    mimeType: 'application/json',
    body: JSON.stringify(data, null, 2)
  };

  if (existing?.id) {
    const res = await drive.files.update({
      fileId: existing.id,
      media,
      fields: 'id,name,modifiedTime'
    });
    return res.data;
  }

  const requestBody = { name, mimeType: 'application/json' };
  if (parentId) requestBody.parents = [parentId];

  const res = await drive.files.create({
    requestBody,
    media,
    fields: 'id,name,modifiedTime'
  });
  return res.data;
}

export async function loadJsonFile(drive, name, parentId = null) {
  const existing = await findFileByName(drive, name, parentId);
  if (!existing?.id) return null;

  const res = await drive.files.get(
    { fileId: existing.id, alt: 'media' },
    { responseType: 'text' }
  );

  const raw = typeof res.data === 'string' ? res.data : '';
  return raw ? JSON.parse(raw) : null;
}

export async function saveImageFile({ drive, folderId, fileName, mimeType, buffer }) {
  const existing = await findFileByName(drive, fileName, folderId);
  const media = { mimeType, body: Buffer.from(buffer) };

  if (existing?.id) {
    const res = await drive.files.update({
      fileId: existing.id,
      media,
      fields: 'id,name,mimeType,modifiedTime,size'
    });
    return res.data;
  }

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType
    },
    media,
    fields: 'id,name,mimeType,modifiedTime,size'
  });
  return res.data;
}
