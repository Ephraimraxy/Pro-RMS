const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

const LOCAL_UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

function ensureLocalDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const useS3 = Boolean(process.env.S3_BUCKET && process.env.S3_REGION);

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
  useS3
};
