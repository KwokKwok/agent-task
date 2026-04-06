import { randomBytes } from 'node:crypto';
import { readProjectJson, writeProjectJson } from './json-store.js';

function now() {
  return new Date().toISOString();
}

function getTokenFile() {
  return 'webui.json';
}

function readTokenData() {
  return readProjectJson(getTokenFile(), null);
}

function writeTokenData(data) {
  writeProjectJson(getTokenFile(), data);
}

function generateToken() {
  return randomBytes(24).toString('hex');
}

export function ensureToken() {
  const existing = readTokenData();
  if (existing?.token) {
    return existing.token;
  }

  const timestamp = now();
  const token = generateToken();
  writeTokenData({ token, createdAt: timestamp, updatedAt: timestamp });
  return token;
}

export function getToken() {
  const data = readTokenData();
  return data?.token || null;
}

export function resetToken() {
  const data = readTokenData();
  const timestamp = now();
  const token = generateToken();

  writeTokenData({
    token,
    createdAt: data?.createdAt || timestamp,
    updatedAt: timestamp,
  });

  return token;
}

export function getTokenFilePath() {
  return 'webui.json';
}