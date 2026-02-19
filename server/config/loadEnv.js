const fs = require('fs');
const path = require('path');

let loaded = false;

function parseEnvValue(raw) {
  const value = String(raw || '').trim();
  if (!value) {
    return '';
  }

  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' && last === '"') || (first === '\'' && last === '\'')) {
    return value.slice(1, -1);
  }
  return value;
}

function normalizeEnvKey(rawKey) {
  return String(rawKey || '')
    .replace(/^export\s+/i, '')
    .trim();
}

function applyEnvFile(filePath, options = {}) {
  const { override = false } = options;

  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const eqIndex = line.indexOf('=');
    if (eqIndex < 1) {
      continue;
    }

    const key = normalizeEnvKey(line.slice(0, eqIndex));
    const value = parseEnvValue(line.slice(eqIndex + 1));
    if (!key) {
      continue;
    }

    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function loadEnvOnce() {
  if (loaded) {
    return;
  }
  loaded = true;

  const rootDir = path.resolve(__dirname, '../..');
  const nodeEnv = String(process.env.NODE_ENV || '').trim();
  const envFileOverride = process.env.ENV_FILE_OVERRIDE !== '0';

  applyEnvFile(path.join(rootDir, '.env'), { override: envFileOverride });
  if (nodeEnv) {
    applyEnvFile(path.join(rootDir, `.env.${nodeEnv}`), { override: true });
  }
}

loadEnvOnce();

module.exports = loadEnvOnce;
