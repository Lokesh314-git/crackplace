import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config();

let db: any;
let auth: any;

const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
const localKeyPath = path.join(__dirname, '../../serviceAccountKey.json');
const hasCredentials = !!serviceAccountEnv || fs.existsSync(localKeyPath);

if (hasCredentials) {
  try {
    if (serviceAccountEnv) {
      const serviceAccount = JSON.parse(serviceAccountEnv);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: `${serviceAccount.project_id || 'crackprep-webapp'}.firebasestorage.app`
      });
    } else {
      const serviceAccount = JSON.parse(fs.readFileSync(localKeyPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: `${serviceAccount.project_id || 'crackprep-webapp'}.firebasestorage.app`
      });
    }

    db = admin.firestore();
    auth = admin.auth();
    console.log('[FIREBASE] Admin SDK initialized successfully using service account credentials.');
  } catch (error) {
    console.error('[FIREBASE] Initialization with credentials failed, falling back to local mock DB:', error);
    setupMockDB();
  }
} else {
  console.warn('[FIREBASE] No private credentials found. Initializing local JSON fallback database (local_db.json) for development.');
  setupMockDB();
}

function setupMockDB() {
  const localDbPath = path.join(__dirname, '../../local_db.json');

  const getDBFile = () => {
    if (!fs.existsSync(localDbPath)) {
      fs.writeFileSync(localDbPath, JSON.stringify({}), 'utf8');
    }
    try {
      return JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
    } catch {
      return {};
    }
  };

  const saveDBFile = (data: any) => {
    fs.writeFileSync(localDbPath, JSON.stringify(data, null, 2), 'utf8');
  };

  const readLocalDB = (collection: string, docId: string) => {
    const dbData = getDBFile();
    return dbData[collection]?.[docId] || null;
  };

  const writeLocalDB = (collection: string, docId: string, data: any) => {
    const dbData = getDBFile();
    if (!dbData[collection]) dbData[collection] = {};
    dbData[collection][docId] = data;
    saveDBFile(dbData);
  };

  const getCollection = (collection: string) => {
    const dbData = getDBFile();
    return dbData[collection] || {};
  };

  const mergeNested = (target: any, source: any) => {
    const result = { ...target };
    for (const [key, value] of Object.entries(source)) {
      if (key.includes('.')) {
        const parts = key.split('.');
        let current = result;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) current[parts[i]] = {};
          current[parts[i]] = { ...current[parts[i]] };
          current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
      } else {
        result[key] = value;
      }
    }
    return result;
  };

  class MockDocumentReference {
    constructor(public collectionName: string, public docId: string) {}

    get id() {
      return this.docId;
    }

    async get() {
      const data = readLocalDB(this.collectionName, this.docId);
      return {
        id: this.docId,
        exists: data !== null,
        data: () => (data ? { ...data } : undefined)
      };
    }

    async set(data: any, options?: { merge?: boolean }) {
      if (options?.merge) {
        const existing = readLocalDB(this.collectionName, this.docId) || {};
        writeLocalDB(this.collectionName, this.docId, { ...existing, ...data });
      } else {
        writeLocalDB(this.collectionName, this.docId, data);
      }
    }

    async update(updates: any) {
      const data = readLocalDB(this.collectionName, this.docId) || {};
      const updated = mergeNested(data, updates);
      writeLocalDB(this.collectionName, this.docId, updated);
    }

    async delete() {
      const dbData = getDBFile();
      if (dbData[this.collectionName]) {
        delete dbData[this.collectionName][this.docId];
        saveDBFile(dbData);
      }
    }
  }

  class MockQuery {
    constructor(
      protected collectionName: string,
      protected filters: Array<(doc: any) => boolean> = [],
      protected sortField?: string,
      protected sortDirection: 'asc' | 'desc' = 'asc',
      protected limitCount?: number
    ) {}

    where(field: string, op: string, value: any) {
      const newFilter = (doc: any) => {
        if (op === '==') return doc[field] === value;
        if (op === '!=') return doc[field] !== value;
        if (op === '>') return doc[field] > value;
        if (op === '>=') return doc[field] >= value;
        if (op === '<') return doc[field] < value;
        if (op === '<=') return doc[field] <= value;
        return true;
      };
      return new MockQuery(this.collectionName, [...this.filters, newFilter], this.sortField, this.sortDirection, this.limitCount);
    }

    orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
      return new MockQuery(this.collectionName, this.filters, field, direction, this.limitCount);
    }

    limit(count: number) {
      return new MockQuery(this.collectionName, this.filters, this.sortField, this.sortDirection, count);
    }

    async get() {
      const all = getCollection(this.collectionName);
      let items = Object.entries(all).map(([id, doc]: any) => ({
        id,
        ...doc
      }));

      for (const filter of this.filters) {
        items = items.filter(filter);
      }

      if (this.sortField) {
        items.sort((a: any, b: any) => {
          const valA = a[this.sortField!];
          const valB = b[this.sortField!];
          if (valA === undefined || valB === undefined) return 0;
          if (valA < valB) return this.sortDirection === 'desc' ? 1 : -1;
          if (valA > valB) return this.sortDirection === 'desc' ? -1 : 1;
          return 0;
        });
      }

      if (this.limitCount !== undefined) {
        items = items.slice(0, this.limitCount);
      }

      const docs = items.map((item) => ({
        id: item.id,
        exists: true,
        data: () => ({ ...item })
      }));

      return {
        empty: docs.length === 0,
        size: docs.length,
        docs,
        forEach: (cb: (doc: any) => void) => docs.forEach(cb)
      };
    }
  }

  class MockCollectionReference extends MockQuery {
    constructor(name: string) {
      super(name);
    }

    doc(id?: string) {
      const docId = id || `mock_${Math.random().toString(36).substr(2, 9)}`;
      return new MockDocumentReference(this.collectionName, docId);
    }

    async add(data: any) {
      const id = `mock_${Math.random().toString(36).substr(2, 9)}`;
      writeLocalDB(this.collectionName, id, data);
      return { id };
    }
  }

  db = {
    collection: (name: string) => new MockCollectionReference(name),
    runTransaction: async (updateFunction: (transaction: any) => Promise<any>) => {
      const transaction = {
        get: async (ref: any) => ref.get(),
        set: (ref: any, data: any, options?: any) => ref.set(data, options),
        update: (ref: any, data: any) => ref.update(data),
        delete: (ref: any) => ref.delete()
      };
      return await updateFunction(transaction);
    },
    batch: () => {
      const operations: Array<() => Promise<void>> = [];
      const batchInstance: any = {
        set: (ref: any, data: any, options?: any) => {
          operations.push(() => ref.set(data, options));
          return batchInstance;
        },
        update: (ref: any, data: any) => {
          operations.push(() => ref.update(data));
          return batchInstance;
        },
        delete: (ref: any) => {
          operations.push(() => ref.delete());
          return batchInstance;
        },
        commit: async () => {
          for (const op of operations) {
            await op();
          }
        }
      };
      return batchInstance;
    }
  };

  auth = {
    verifyIdToken: async (token: string) => {
      if (!token || typeof token !== 'string') {
        throw new Error('Decoding Firebase ID token failed: Token is empty or not a string.');
      }

      if (token.includes('invalid') || token.includes('malformed')) {
        throw new Error('Decoding Firebase ID token failed: Invalid token format.');
      }

      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          if (payload && (payload.user_id || payload.sub || payload.uid)) {
            return {
              uid: payload.user_id || payload.sub || payload.uid,
              email: payload.email,
              name: payload.name || payload.display_name,
              role: payload.role || 'student',
              ...payload
            };
          }
        }
      } catch (e) {
        throw new Error('Decoding Firebase ID token failed: Invalid token payload.');
      }

      // If in production, strictly reject non-JWT tokens
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Decoding Firebase ID token failed: Unrecognized token format.');
      }

      // In local non-production environment, allow mock token
      return {
        uid: 'mock_uid_123',
        email: 'mock@crackprep.ai',
        name: 'Mock Cadet',
        role: 'student'
      };
    }
  };
}

export { admin, db, auth };
