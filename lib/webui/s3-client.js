import { createHash } from 'node:crypto';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  PutBucketCorsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { readWebuiConfig } from './config-store.js';

function getS3Config(configOverride) {
  if (configOverride && typeof configOverride === 'object') {
    return configOverride;
  }
  return readWebuiConfig().s3 || {};
}

export function isS3Enabled() {
  const c = getS3Config();
  return !!(c.enabled && c.endpoint && c.bucket && c.accessKeyId && c.secretAccessKey);
}

function createClient(configOverride) {
  const c = getS3Config(configOverride);
  if (!c.endpoint || !c.bucket || !c.accessKeyId || !c.secretAccessKey) return null;

  return new S3Client({
    region: c.region || 'us-east-1',
    endpoint: c.endpoint,
    forcePathStyle: false,
    credentials: {
      accessKeyId: c.accessKeyId,
      secretAccessKey: c.secretAccessKey,
    },
  });
}

function resolveKey(relativeKey, configOverride) {
  const c = getS3Config(configOverride);
  const prefix = c.basePath || '';
  return `${prefix}${relativeKey}`;
}

function extractS3Error(err) {
  const parts = [];
  if (err.name && err.name !== 'Error') parts.push(err.name);
  if (err.message && err.message !== err.name) parts.push(err.message);
  if (err.Code) parts.push(err.Code);
  if (err.$metadata?.httpStatusCode) parts.push(`HTTP ${err.$metadata.httpStatusCode}`);
  return parts.join(': ') || 'Unknown error';
}

function attachContentMd5(command) {
  command.middlewareStack.add(
    (next) => async (args) => {
      const body = args.request?.body;
      if (body) {
        const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
        args.request.headers = {
          ...(args.request.headers || {}),
          'content-md5': createHash('md5').update(buffer).digest('base64'),
        };
      }
      return next(args);
    },
    {
      step: 'build',
      name: 'agentTaskContentMd5',
      priority: 'high',
    },
  );
  return command;
}

function getCacheControl(key) {
  if (key.startsWith('assets/')) {
    return 'public, max-age=31536000, immutable';
  }
  return 'private, max-age=1209600';
}

export async function verifyS3Connection(configOverride) {
  const client = createClient(configOverride);
  if (!client) return { ok: false, error: 'S3 not configured' };

  try {
    await client.send(new ListObjectsV2Command({
      Bucket: getS3Config(configOverride).bucket,
      MaxKeys: 1,
    }));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: extractS3Error(err) };
  }
}

export async function ensureBucketCors(configOverride) {
  const client = createClient(configOverride);
  if (!client) return;

  const command = new PutBucketCorsCommand({
    Bucket: getS3Config(configOverride).bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: ['*'],
          AllowedMethods: ['GET', 'HEAD'],
          AllowedHeaders: ['*'],
          ExposeHeaders: ['ETag'],
          MaxAgeSeconds: 86400,
        },
      ],
    },
  });

  try {
    await client.send(attachContentMd5(command));
  } catch (err) {
    throw new Error(
      `Bucket CORS 配置失败: ${extractS3Error(err)}。请确认当前密钥具备 bucket 跨域配置权限。`,
    );
  }
}

export async function ensureBucketStructure(configOverride) {
  const client = createClient(configOverride);
  if (!client) return;

  const bucket = getS3Config(configOverride).bucket;
  for (const prefix of ['assets/', 'tasks/']) {
    try {
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: resolveKey(prefix + '.keep', configOverride),
        Body: '',
        ContentType: 'text/plain',
      }));
    } catch {
      // best effort
    }
  }
}

export async function uploadToS3(key, body, contentType) {
  const client = createClient();
  if (!client) return;

  await client.send(new PutObjectCommand({
    Bucket: getS3Config().bucket,
    Key: resolveKey(key),
    Body: body,
    ContentType: contentType || 'application/octet-stream',
    CacheControl: getCacheControl(key),
  }));
}

/**
 * 生成 presigned URL。
 */
export async function getPresignedUrl(key, expiresIn = 3600) {
  const client = createClient();
  if (!client) return null;

  const command = new GetObjectCommand({
    Bucket: getS3Config().bucket,
    Key: resolveKey(key),
  });

  return getSignedUrl(client, command, { expiresIn });
}

export async function getPublicObjectUrl(key) {
  const signedUrl = await getPresignedUrl(key, 60);
  if (!signedUrl) return null;
  const url = new URL(signedUrl);
  return `${url.origin}${url.pathname}`;
}
