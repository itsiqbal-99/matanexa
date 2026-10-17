// Runs against the unchanged API/data logic without a backend connection.
// Requires TypeScript (declared as a devDependency).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const cache = new Map();
function loadTs(file) {
  const filename = path.resolve(__dirname, '..', file);
  if (cache.has(filename)) return cache.get(filename);
  const src = fs.readFileSync(filename, 'utf8');
  const code = ts.transpileModule(src, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
  }, fileName: filename }).outputText;
  const module = { exports: {} };
  cache.set(filename, module.exports);
  const requireLocal = (name) => name.startsWith('.')
    ? loadTs(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), `${name}.ts`)))
    : require(name);
  new Function('require', 'module', 'exports', code)(requireLocal, module, module.exports);
  return module.exports;
}
const api = loadTs('lib/api-client.ts');
const storage = loadTs('features/search/storage.ts');

const mock = (id = 'mock-ilmu-1') => ({
  id, title: 'Contoh, bukan hadits', excerpt: 'Teks simulasi',
  citation: { collection: 'Contoh', number: 'MOCK', numberingScheme: 'mock' },
  collection: 'Contoh', sourceSlug: 'mock-a', hadithNumber: null,
  arabicText: null, translation: null, grade: null, sourceUrl: null,
  referenceUrl: null, isVerified: false,
});
const response = {
  data: { query: 'Hadits tentang ilmu', results: [mock()], totalCandidates: 1 },
  meta: { page: 1, limit: 10, hasMore: false, modeUsed: 'mock', requestId: 'qa-1' },
};

test('Mock payload is validated as simulation, not a verified hadith', () => {
  assert.equal(api.isSearchResponse(response), true);
  assert.equal(api.isVerifiedResult(mock()), false);
  assert.equal(api.isSearchResponse({ ...response, data: { ...response.data, results: [{ ...mock(), isVerified: true }] } }), false);
});

test('API contract uses POST /search with optional source filter', async () => {
  const oldFetch = global.fetch;
  const oldBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
  let seen;
  global.fetch = async (url, init) => {
    seen = { url, init };
    return { ok: true, json: async () => response };
  };
  try {
    const result = await api.searchApi('Hadits tentang ilmu', { signal: new AbortController().signal, sourceSlug: 'mock-a' });
    assert.equal(result.data.totalCandidates, 1);
    assert.equal(seen.url, 'http://localhost:4000/api/v1/search');
    assert.equal(seen.init.method, 'POST');
    assert.deepEqual(JSON.parse(seen.init.body), {
      query: 'Hadits tentang ilmu', page: 1, limit: 10, filters: { sourceSlugs: ['mock-a'] },
    });
  } finally {
    global.fetch = oldFetch;
    if (oldBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = oldBase;
  }
});

test('Storage key, history/saved limits and pilot no-persistence rules are preserved', async () => {
  const values = new Map();
  const oldStorage = global.localStorage;
  const oldMatchMedia = global.matchMedia;
  global.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key,value) => values.set(key,value) };
  global.matchMedia = () => ({ matches: false });
  try {
    const conversation = { id: 'abc', query: 'Hadits tentang ilmu', createdAt: '2026-01-01', status: 'success', response, sourceSlug: '', sources: [] };
    const pilot = { ...conversation, id: 'pilot', response: { ...response, meta: { ...response.meta, dataScope: 'local_pilot' } } };
    const pilotSave = { ...mock('mock-ilmu-2'), isResearchOnly: true };
    const manyHistory = Array.from({ length: 25 }, (_, i) => ({ ...conversation, id: `stored-${i}` }));
    const manySaved = Array.from({ length: 110 }, (_, i) => ({ ...mock(), unique: i }));
    await storage.writeWorkspace({ history: [...manyHistory, pilot], saved: [...manySaved, pilotSave], theme: 'light', showArabic: true });
    assert.equal(storage.STORAGE_KEY, 'matanexa.workspace.v1');
    assert.equal(JSON.parse(values.get(storage.STORAGE_KEY)).history.length, 25);
    assert.equal(JSON.parse(values.get(storage.STORAGE_KEY)).saved.length, 110);
    const read = await storage.readWorkspace();
    assert.equal(read.unavailable, false);
    assert.equal(read.data.history.length, 20);
    assert.equal(read.data.saved.length, 100);
    assert.equal(read.data.history[0].status, 'success');
  } finally {
    global.localStorage = oldStorage;
    global.matchMedia = oldMatchMedia;
  }
});
