const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

const LOCAL_UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

function ensureLocalDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const useBunny = Boolean(process.env.BUNNY_STORAGE_ZONE && process.env.BUNNY_API_KEY);
const useS3 = !useBunny && Boolean(process.env.S3_BUCKET && process.env.S3_REGION);

const bunnyEndpoint = (() => {
  const raw = (process.env.BUNNY_STORAGE_ENDPOINT || '').trim();
  if (!raw) return 'https://storage.bunnycdn.com';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw.replace(/\/$/, '');
  return `https://${raw.replace(/\/$/, '')}`;
})();

function buildBunnyUrl(key) {
  const zone = process.env.BUNNY_STORAGE_ZONE;
  const safeKey = key.replace(/^\/+/, '');
  return `${bunnyEndpoint}/${zone}/${safeKey}`;
}

async function bunnyFetch(url, options) {
  const apiKey = process.env.BUNNY_API_KEY;
  if (!apiKey) {
    throw new Error('BUNNY_API_KEY is required for Bunny Storage.');
  }
  const headers = {
    ...(options?.headers || {}),
    AccessKey: apiKey
  };
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Bunny Storage error ${response.status}: ${text || response.statusText}`);
  }
  return response;
}

const s3 = useS3
  ? new S3Client({
      region: process.env.S3_REGION,
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
          }
        : undefined
    })
  : null;

async function putObject({ key, body, contentType }) {
  if (useBunny) {
    const url = buildBunnyUrl(key);
    const headers = {};
    if (contentType) headers['Content-Type'] = contentType;
    await bunnyFetch(url, {
      method: 'PUT',
      body,
      headers
    });
    return { key };
  }

  if (useS3) {
    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType
    }));
    return { key };
  }

  const localPath = path.join(LOCAL_UPLOAD_DIR, key);
  ensureLocalDir(localPath);
  await fs.promises.writeFile(localPath, body);
  return { key };
}

async function getObjectStream(key) {
  if (useBunny) {
    const url = buildBunnyUrl(key);
    const response = await bunnyFetch(url, { method: 'GET' });
    if (!response.body) throw new Error('Bunny Storage response missing body');
    return Readable.fromWeb(response.body);
  }

  if (useS3) {
    const result = await s3.send(new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key
    }));
    return result.Body;
  }

  const localPath = path.join(LOCAL_UPLOAD_DIR, key);
  return fs.createReadStream(localPath);
}

async function getObjectBuffer(key) {
  if (useBunny) {
    const url = buildBunnyUrl(key);
    const response = await bunnyFetch(url, { method: 'GET' });
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  if (useS3) {
    const stream = await getObjectStream(key);
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  const localPath = path.join(LOCAL_UPLOAD_DIR, key);
  return fs.promises.readFile(localPath);
}

function generateStorageKey(prefix, filename) {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const stamp = Date.now();
  return path.posix.join(prefix, `${stamp}-${safeName}`);
}

module.exports = {
  putObject,
  getObjectStream,
  getObjectBuffer,
  generateStorageKey,
  useS3,
  useBunny
};
