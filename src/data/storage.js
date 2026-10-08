const DATABASE_NAME = 'turtletype-data';
const DATABASE_VERSION = 1;
const STORE_NAME = 'sessions';
const LEGACY_KEY = 'turtletype.sessions.v1';
const FALLBACK_KEY = 'turtletype.sessions.v2.fallback';
let databasePromise;
let migrationPromise;

function readLocalArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

export function normalizeLegacySessions(sessions) {
  return sessions.map((session, index) => ({ ...session, id: `legacy-${index}`, schemaVersion: 1, mode: 'test' }));
}

function openDatabase() {
  if (databasePromise) return databasePromise;
  if (!globalThis.indexedDB) return Promise.resolve(null);
  databasePromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return databasePromise;
}

function putSessions(database, sessions) {
  if (!sessions.length) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    for (const session of sessions) store.put(session);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function readAll(database) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function migrateExisting(database) {
  if (!migrationPromise) {
    const legacy = normalizeLegacySessions(readLocalArray(LEGACY_KEY));
    const fallback = readLocalArray(FALLBACK_KEY);
    migrationPromise = putSessions(database, [...legacy, ...fallback]).catch(() => {});
  }
  await migrationPromise;
}

function localSessions() {
  return [...normalizeLegacySessions(readLocalArray(LEGACY_KEY)), ...readLocalArray(FALLBACK_KEY)];
}

export async function loadSessions() {
  const database = await openDatabase();
  let stored = [];
  if (database) {
    await migrateExisting(database);
    try { stored = await readAll(database); } catch { /* Local data remains readable. */ }
  }
  const merged = new Map();
  for (const session of [...localSessions(), ...stored]) merged.set(session.id, session);
  return [...merged.values()].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

export async function saveSession(session) {
  // A synchronous checkpoint protects a just-finished run if the page closes
  // before the IndexedDB transaction commits.
  let checkpointed = false;
  try {
    const sessions = readLocalArray(FALLBACK_KEY).filter((item) => item.id !== session.id);
    localStorage.setItem(FALLBACK_KEY, JSON.stringify([...sessions, session]));
    checkpointed = true;
  } catch { /* IndexedDB may still be available. */ }
  const database = await openDatabase();
  if (database) {
    try {
      await putSessions(database, [session]);
      if (checkpointed) {
        try {
          const pending = readLocalArray(FALLBACK_KEY).filter((item) => item.id !== session.id);
          localStorage.setItem(FALLBACK_KEY, JSON.stringify(pending));
        } catch { /* A duplicate checkpoint is harmless and is deduplicated on load. */ }
      }
      return true;
    }
    catch { /* Fall back to local storage if the transaction fails. */ }
  }
  return checkpointed;
}
