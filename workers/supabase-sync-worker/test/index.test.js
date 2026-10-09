import test from 'node:test';
import assert from 'node:assert/strict';
import { __test } from '../src/index.js';

test('membaca node lengkap dan melewati node setengah jadi', () => {
    const nodes = __test.buildNodeList({
        NODE_URL_1: 'https://satu.supabase.co/',
        NODE_KEY_1: 'key-satu',
        NODE_URL_2: 'https://dua.supabase.co'
    });

    assert.deepEqual(nodes, [
        { id: 'Node_1', url: 'https://satu.supabase.co', key: 'key-satu' }
    ]);
});

test('mengenali project paused dari HTTP 540', () => {
    const result = __test.classifySupabaseResponse(540, { message: 'Project paused' });
    assert.equal(result.state, 'paused');
    assert.equal(result.healthy, false);
});

test('RPC sukses harus benar-benar memperbarui data', () => {
    const success = __test.classifySupabaseResponse(200, { affected_rows: 1 });
    const empty = __test.classifySupabaseResponse(200, { affected_rows: 0 });
    assert.equal(success.state, 'healthy');
    assert.equal(empty.state, 'rpc_error');
});

test('perintah Telegram dipetakan ke tombol yang benar', () => {
    assert.equal(__test.commandToAction('/sync@nama_bot'), 'sync');
    assert.equal(__test.commandToAction('/status'), 'status');
    assert.equal(__test.commandToAction('halo'), 'unknown');
});

test('token dibandingkan tanpa perbandingan string langsung', async () => {
    assert.equal(await __test.secureCompare('rahasia', 'rahasia'), true);
    assert.equal(await __test.secureCompare('rahasia', 'berbeda'), false);
    assert.equal(await __test.secureCompare('', 'rahasia'), false);
});

test('uptime dihitung dari 1 Maret 2026 pukul 00:00 WITA', () => {
    assert.equal(
        __test.formatUptime('2026-03-02T01:02:00+08:00'),
        '1 hari, 1 jam, 2 menit'
    );
    assert.equal(
        __test.formatUptime('2026-02-28T23:00:00+08:00'),
        '0 hari, 0 jam, 0 menit'
    );
});

test('syncNode mengubah HTTP 540 menjadi status paused', async (t) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => Response.json({ message: 'Project paused' }, { status: 540 });
    t.after(() => { globalThis.fetch = originalFetch; });

    const result = await __test.syncNode({
        id: 'Node_1',
        url: 'https://contoh.supabase.co',
        key: 'anon-key'
    });

    assert.equal(result.state, 'paused');
    assert.equal(result.status, 540);
});
