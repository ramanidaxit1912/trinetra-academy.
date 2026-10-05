/**
 * settingsService.js — Trinetra Online Academy
 * Dynamic System Settings Service backed by Supabase DB & fast memory cache
 */

const prisma = require('../prismaClient');

const settingsCache = new Map();

async function ensureSettingsTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (e) {
    console.warn('⚠️ [Settings] Table check note:', e.message);
  }
}

async function getSetting(key, defaultValue = null) {
  if (settingsCache.has(key)) {
    return settingsCache.get(key);
  }
  try {
    await ensureSettingsTable();
    const rows = await prisma.$queryRawUnsafe(
      `SELECT value FROM system_settings WHERE key = $1 LIMIT 1`,
      key
    );
    if (rows && rows.length > 0) {
      const val = rows[0].value;
      settingsCache.set(key, val);
      return val;
    }
  } catch (e) {
    console.warn(`⚠️ [Settings] Error getting ${key}:`, e.message);
  }
  if (defaultValue !== null) {
    settingsCache.set(key, defaultValue);
  }
  return defaultValue;
}

async function setSetting(key, value) {
  try {
    await ensureSettingsTable();
    const strVal = String(value);
    await prisma.$executeRawUnsafe(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
    `, key, strVal);
    settingsCache.set(key, strVal);
    return strVal;
  } catch (e) {
    console.error(`❌ [Settings] Error setting ${key}:`, e.message);
    throw e;
  }
}

module.exports = {
  getSetting,
  setSetting
};
