const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

test('compiled sheet API loads in Node ESM and handles requests without Google access', () => {
  const output = mkdtempSync(path.join(tmpdir(), 'sheet-api-runtime-'));
  try {
    // Compile as Node modules so Vite and the in-memory test loader cannot
    // hide imports that would fail when the deployed function starts.
    execFileSync(process.execPath, [
      require.resolve('typescript/bin/tsc'), 'api/sheet.ts',
      '--outDir', output, '--module', 'NodeNext', '--moduleResolution', 'NodeNext',
      '--target', 'ES2022', '--skipLibCheck', '--strict', '--types', 'node',
    ], { cwd: path.resolve(__dirname, '..'), stdio: 'pipe' });
    writeFileSync(path.join(output, 'package.json'), '{"type":"module"}');
    execFileSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      const { GET, POST } = await import('./api/sheet.js');
      for (const name of [
        'SHEET_PCS_PROMIS_URL', 'SHEET_SF36_URL', 'SHEET_INITIAL_URL',
        'VITE_COMBINED_SHEET_URL', 'VITE_SF36_SHEET_URL', 'VITE_INITIAL_SHEET_URL',
      ]) delete process.env[name];
      globalThis.fetch = () => { throw new Error('Unexpected network request'); };
      assert.equal(GET().status, 405);
      for (const source of ['combined', 'sf36', 'initial']) {
        const response = await POST(new Request('https://example.test/api/sheet', {
          method: 'POST', body: JSON.stringify({ source }),
        }));
        assert.equal(response.status, 503);
        assert.match((await response.json()).error, /configurada/);
      }
    `], { cwd: output, stdio: 'pipe' });
    assert.ok(true);
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});
