const SIGNATURE_DATABASE_NAME = 'forceAgainstSomething:governmentWriter:v1';
const SIGNATURE_STORE_NAME = 'signatures';
const SIGNATURE_STORAGE_KEY = 'default';
const MAX_SIGNATURE_DATA_URL_LENGTH = 1_500_000;

export type GovernmentSignature = {
  version: 1;
  kind: 'typed' | 'drawn';
  imageDataUrl: string;
  typedName: string | null;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseStoredGovernmentSignature(value: unknown): GovernmentSignature | null {
  if (!isRecord(value) || value.version !== 1) return null;
  if (value.kind !== 'typed' && value.kind !== 'drawn') return null;
  if (typeof value.imageDataUrl !== 'string') return null;
  if (value.imageDataUrl.length > MAX_SIGNATURE_DATA_URL_LENGTH) return null;
  if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value.imageDataUrl)) return null;
  if (typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))) return null;

  const typedName = value.typedName;
  if (typedName !== null && typeof typedName !== 'string') return null;
  if (typeof typedName === 'string' && (typedName.length > 200 || !typedName.trim())) return null;
  if (value.kind === 'typed' && typeof typedName !== 'string') return null;
  if (value.kind === 'drawn' && typedName !== null) return null;

  return {
    version: 1,
    kind: value.kind,
    imageDataUrl: value.imageDataUrl,
    typedName,
    updatedAt: value.updatedAt,
  };
}

function openSignatureDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is unavailable.'));
      return;
    }

    const request = window.indexedDB.open(SIGNATURE_DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(SIGNATURE_STORE_NAME)) {
        request.result.createObjectStore(SIGNATURE_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Signature storage could not be opened.'));
    request.onblocked = () => reject(new Error('Signature storage is blocked by another page.'));
  });
}

export async function readStoredGovernmentSignature(): Promise<GovernmentSignature | null> {
  const database = await openSignatureDatabase();
  try {
    const stored = await new Promise<unknown>((resolve, reject) => {
      const request = database
        .transaction(SIGNATURE_STORE_NAME, 'readonly')
        .objectStore(SIGNATURE_STORE_NAME)
        .get(SIGNATURE_STORAGE_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Signature could not be read.'));
    });
    return parseStoredGovernmentSignature(stored);
  } finally {
    database.close();
  }
}

export async function saveStoredGovernmentSignature(signature: GovernmentSignature): Promise<void> {
  const parsed = parseStoredGovernmentSignature(signature);
  if (!parsed) throw new Error('Signature data is invalid.');

  const database = await openSignatureDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(SIGNATURE_STORE_NAME, 'readwrite');
      transaction.objectStore(SIGNATURE_STORE_NAME).put(parsed, SIGNATURE_STORAGE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Signature could not be saved.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Signature save was cancelled.'));
    });
  } finally {
    database.close();
  }
}

export async function deleteStoredGovernmentSignature(): Promise<void> {
  const database = await openSignatureDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(SIGNATURE_STORE_NAME, 'readwrite');
      transaction.objectStore(SIGNATURE_STORE_NAME).delete(SIGNATURE_STORAGE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Signature could not be erased.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Signature erase was cancelled.'));
    });
  } finally {
    database.close();
  }
}
