import { Storage } from '@ionic/storage';

// Single shared Storage instance for the whole app.
// Call `getStorage()` anywhere — it initialises once and reuses the instance.
let _storage: Storage | null = null;

export async function getStorage(): Promise<Storage> {
  if (_storage) return _storage;
  const s = new Storage();
  await s.create();
  _storage = s;
  return s;
}
