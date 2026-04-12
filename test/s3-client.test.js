import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  sendMock,
  S3ClientMock,
  PutObjectCommandMock,
  PutBucketCorsCommandMock,
  GetObjectCommandMock,
  ListObjectsV2CommandMock,
  getSignedUrlMock,
  readWebuiConfigMock,
} = vi.hoisted(() => ({
  sendMock: vi.fn(),
  S3ClientMock: vi.fn(() => ({ send: vi.fn() })),
  PutObjectCommandMock: vi.fn((input) => ({ type: 'put', input })),
  PutBucketCorsCommandMock: vi.fn((input) => ({
    type: 'putBucketCors',
    input,
    middlewareStack: {
      add: vi.fn(),
    },
  })),
  GetObjectCommandMock: vi.fn((input) => ({ type: 'get', input })),
  ListObjectsV2CommandMock: vi.fn((input) => ({ type: 'list', input })),
  getSignedUrlMock: vi.fn(),
  readWebuiConfigMock: vi.fn(() => ({
    s3: {
      enabled: true,
      endpoint: 'https://cos.example.com',
      region: 'ap-guangzhou',
      bucket: 'agent-task-bucket',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
      basePath: 'agent-task/',
    },
  })),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn((...args) => {
    const client = { send: sendMock };
    S3ClientMock(...args);
    return client;
  }),
  PutObjectCommand: PutObjectCommandMock,
  PutBucketCorsCommand: PutBucketCorsCommandMock,
  GetObjectCommand: GetObjectCommandMock,
  ListObjectsV2Command: ListObjectsV2CommandMock,
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: getSignedUrlMock,
}));

vi.mock('../lib/webui/config-store.js', () => ({
  readWebuiConfig: readWebuiConfigMock,
}));

import {
  ensureBucketCors,
  getPublicObjectUrl,
  getPresignedUrl,
  uploadToS3,
  verifyS3Connection,
} from '../lib/webui/s3-client.js';

describe('s3 client helpers', () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({});
    S3ClientMock.mockClear();
    PutObjectCommandMock.mockClear();
    PutBucketCorsCommandMock.mockClear();
    GetObjectCommandMock.mockClear();
    ListObjectsV2CommandMock.mockClear();
    getSignedUrlMock.mockReset();
    getSignedUrlMock.mockResolvedValue('https://bucket.example.com/signed-object');
    readWebuiConfigMock.mockClear();
  });

  it('uploads cached assets with a long immutable cache policy', async () => {
    await uploadToS3('assets/site.css', Buffer.from('body{}'), 'text/css; charset=utf-8');

    expect(PutObjectCommandMock).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: 'agent-task-bucket',
      Key: 'agent-task/assets/site.css',
      ContentType: 'text/css; charset=utf-8',
      CacheControl: 'public, max-age=31536000, immutable',
    }));
  });

  it('uploads task files with a 14-day private cache policy', async () => {
    await uploadToS3('tasks/task-123/images/pixel.png', Buffer.from('png'), 'image/png');

    expect(PutObjectCommandMock).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: 'agent-task-bucket',
      Key: 'agent-task/tasks/task-123/images/pixel.png',
      ContentType: 'image/png',
      CacheControl: 'private, max-age=1209600',
    }));
  });

  it('signs resolved task object keys against the configured endpoint', async () => {
    const signedUrl = await getPresignedUrl('tasks/task-123/report.mp3');

    expect(signedUrl).toBe('https://bucket.example.com/signed-object');
    expect(GetObjectCommandMock).toHaveBeenCalledWith({
      Bucket: 'agent-task-bucket',
      Key: 'agent-task/tasks/task-123/report.mp3',
    });
    expect(getSignedUrlMock).toHaveBeenCalledOnce();
  });

  it('derives public object urls by stripping signing parameters', async () => {
    getSignedUrlMock.mockResolvedValue(
      'https://agent-task-bucket.cos.example.com/agent-task/assets/font.ttf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=test',
    );

    const publicUrl = await getPublicObjectUrl('assets/font.ttf');

    expect(publicUrl).toBe('https://agent-task-bucket.cos.example.com/agent-task/assets/font.ttf');
  });

  it('verifies the configured bucket using list objects', async () => {
    const result = await verifyS3Connection();

    expect(result).toEqual({ ok: true });
    expect(ListObjectsV2CommandMock).toHaveBeenCalledWith({
      Bucket: 'agent-task-bucket',
      MaxKeys: 1,
    });
  });

  it('configures bucket cors for cross-origin font access', async () => {
    await ensureBucketCors();

    expect(PutBucketCorsCommandMock).toHaveBeenCalledWith({
      Bucket: 'agent-task-bucket',
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
  });
});
