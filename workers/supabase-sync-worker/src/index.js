const SERVICE_NAME = 'supabase-sync-worker';
const MAX_NODES = 15;
const REQUEST_TIMEOUT_MS = 10_000;
const HEALTH_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const RUN_TTL_SECONDS = 60 * 24 * 60 * 60;
const CRON_LABEL = '08:00, 16:00, dan 23:00 WITA';
const BOT_STARTED_AT = '2026-03-01T00:00:00+08:00';
const TELEGRAM_BUTTONS = {
    inline_keyboard: [
        [{ text: '🔄 Sync sekarang', callback_data: 'sync' }],
        [
            { text: '📊 Status', callback_data: 'status' },
            { text: '📔 Riwayat', callback_data: 'memory' }
        ]
    ]
};

export default {
    async scheduled(controller, env) {
        log('info', 'cron_started', { cron: controller.cron, scheduled_time: controller.scheduledTime });
        const summary = await runSync(env, { source: 'cron', cron: controller.cron });

        // Supaya halaman Past Events Cloudflare jujur: semua node gagal = cron gagal.
        if (summary.success === 0) {
            throw new Error(`Semua ${summary.total} node Supabase gagal disinkronkan`);
        }
    },

    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = normalizePath(url.pathname);

        if (path === '/health') {
            if (request.method !== 'GET') return methodNotAllowed(['GET']);
            const snapshot = await getHealthSnapshot(env);
            return jsonResponse(snapshot.body, snapshot.httpStatus);
        }

        if (path === '/trigger') {
            if (request.method !== 'POST') return methodNotAllowed(['POST']);
            const authError = await requireBearerToken(request, env.MANUAL_TRIGGER_TOKEN);
            if (authError) return authError;

            ctx.waitUntil(runSync(env, { source: 'manual' }));
            return jsonResponse({
                status: 'accepted',
                message: 'Sinkronisasi mulai berjalan. Lihat Telegram atau /health sebentar lagi.',
                timestamp: new Date().toISOString()
            }, 202);
        }

        if (path === '/sync-history') {
            if (request.method !== 'GET') return methodNotAllowed(['GET']);
            const authError = await requireBearerToken(request, env.MANUAL_TRIGGER_TOKEN);
            if (authError) return authError;
            return jsonResponse(await readRunHistory(env));
        }

        if (path === '/set-webhook') {
            if (request.method !== 'POST') return methodNotAllowed(['POST']);
            const authError = await requireBearerToken(request, env.MANUAL_TRIGGER_TOKEN);
            if (authError) return authError;

            const botToken = getBotToken(env);
            const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET?.trim();
            if (!botToken || !webhookSecret) {
                return jsonResponse({
                    error: 'TELEGRAM_BOT_TOKEN dan TELEGRAM_WEBHOOK_SECRET harus diisi.'
                }, 500);
            }

            const result = await callTelegram(botToken, 'setWebhook', {
                url: `${url.origin}/webhook`,
                secret_token: webhookSecret,
                allowed_updates: ['message', 'callback_query'],
                drop_pending_updates: false
            });
            return jsonResponse({ status: 'webhook_configured', telegram: result }, result.ok ? 200 : 502);
        }

        if (path === '/webhook') {
            if (request.method !== 'POST') return methodNotAllowed(['POST']);
            const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET?.trim();
            if (!webhookSecret) {
                return jsonResponse({ error: 'TELEGRAM_WEBHOOK_SECRET belum diatur.' }, 503);
            }

            const receivedSecret = (request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '').trim();
            if (!await secureCompare(receivedSecret, webhookSecret)) {
                return jsonResponse({ error: 'Unauthorized' }, 401);
            }

            try {
                const update = await request.json();
                ctx.waitUntil(handleTelegramUpdate(update, env).catch((error) => {
                    log('error', 'telegram_handler_failed', { error: safeErrorMessage(error) });
                }));
            } catch (error) {
                log('error', 'telegram_update_invalid', { error: safeErrorMessage(error) });
            }

            return new Response('OK');
        }

        return jsonResponse({
            service: SERVICE_NAME,
            status: 'running',
            schedule: CRON_LABEL,
            endpoints: {
                health: 'GET /health',
                trigger: 'POST /trigger (Bearer token)',
                history: 'GET /sync-history (Bearer token)',
                webhook: 'POST /webhook',
                set_webhook: 'POST /set-webhook (Bearer token)'
            }
        });
    }
};

function normalizePath(pathname) {
    if (pathname === '/') return '/';
    return pathname.replace(/\/+$/, '');
}

function buildNodeList(env) {
    const nodes = [];
    for (let i = 1; i <= MAX_NODES; i += 1) {
        const url = env[`NODE_URL_${i}`]?.trim();
        const key = env[`NODE_KEY_${i}`]?.trim();
        if (url && key) {
            nodes.push({ id: `Node_${i}`, url: url.replace(/\/+$/, ''), key });
        }
    }
    return nodes;
}

async function syncNode(node) {
    const startedAt = new Date();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(`${node.url}/rest/v1/rpc/sync_application_data`, {
            method: 'POST',
            headers: {
                apikey: node.key,
                Authorization: `Bearer ${node.key}`,
                'Content-Type': 'application/json',
                'X-Client-Info': `${SERVICE_NAME}/2.0.0`
            },
            body: '{}',
            signal: controller.signal
        });

        const data = await readSmallResponse(response);
        const result = classifySupabaseResponse(response.status, data);
        return makeNodeResult(node.id, startedAt, result, data);
    } catch (error) {
        const isTimeout = error?.name === 'AbortError';
        return makeNodeResult(node.id, startedAt, {
            state: isTimeout ? 'timeout' : 'network_error',
            healthy: false,
            error: isTimeout ? `Request lewat dari ${REQUEST_TIMEOUT_MS / 1000} detik` : safeErrorMessage(error)
        });
    } finally {
        clearTimeout(timeoutId);
    }
}

function classifySupabaseResponse(status, data) {
    if (status >= 200 && status < 300) {
        if (data && typeof data === 'object' && data.affected_rows === 0) {
            return { state: 'rpc_error', healthy: false, status, error: 'RPC jalan, tetapi tidak ada data yang diperbarui' };
        }
        return { state: 'healthy', healthy: true, status };
    }

    const apiCode = data && typeof data === 'object' ? data.code : undefined;
    const message = extractApiError(data) || `HTTP ${status}`;
    if (status === 540) return { state: 'paused', healthy: false, status, error: 'Project Supabase sedang paused. Resume lewat Dashboard.' };
    if (status === 401 || status === 403) return { state: 'auth_error', healthy: false, status, error: message };
    if (status === 404 || apiCode === 'PGRST202') return { state: 'rpc_missing', healthy: false, status, error: message };
    if (status === 402) return { state: 'restricted', healthy: false, status, error: message };
    if (status >= 500) return { state: 'database_error', healthy: false, status, error: message };
    return { state: 'rpc_error', healthy: false, status, error: message };
}

function makeNodeResult(nodeId, startedAt, result, data = undefined) {
    const completedAt = new Date();
    return {
        node: nodeId,
        state: result.state,
        healthy: result.healthy,
        status: result.status,
        started_at: startedAt.toISOString(),
        completed_at: completedAt.toISOString(),
        duration_ms: completedAt.getTime() - startedAt.getTime(),
        ...(result.error ? { error: result.error } : {}),
        ...(data !== undefined && result.healthy ? { data } : {})
    };
}

async function readSmallResponse(response) {
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > 64 * 1024) return { message: 'Respons terlalu besar untuk dibaca' };
    const text = await response.text();
    if (!text) return null;
    if (text.length > 64 * 1024) return { message: 'Respons terlalu besar untuk dibaca' };
    try {
        return JSON.parse(text);
    } catch {
        return { message: text.slice(0, 500) };
    }
}

async function runSync(env, options = {}) {
    const source = options.source || 'unknown';
    const nodes = buildNodeList(env);
    const startedAt = new Date();
    const runId = `${startedAt.getTime()}-${crypto.randomUUID()}`;

    if (nodes.length === 0) {
        const emptySummary = {
            run_id: runId,
            source,
            started_at: startedAt.toISOString(),
            completed_at: new Date().toISOString(),
            total: 0,
            success: 0,
            failed: 0,
            details: [],
            error: 'Tidak ada node Supabase yang terpasang.'
        };
        await persistRun(env, emptySummary);
        await sendTelegramMessage(env, formatSyncReport(emptySummary));
        return emptySummary;
    }

    log('info', 'sync_started', { run_id: runId, source, nodes: nodes.length });
    const details = await Promise.all(nodes.map(syncNode));
    const completedAt = new Date();
    const success = details.filter((item) => item.healthy).length;
    const summary = {
        run_id: runId,
        source,
        ...(options.cron ? { cron: options.cron } : {}),
        started_at: startedAt.toISOString(),
        completed_at: completedAt.toISOString(),
        duration_ms: completedAt.getTime() - startedAt.getTime(),
        total: nodes.length,
        success,
        failed: nodes.length - success,
        details
    };

    const persistence = await persistRun(env, summary);
    summary.transitions = persistence.transitions;
    summary.failure_alerts = persistence.failureAlerts;

    if (shouldSendReport(summary, options)) {
        await sendTelegramMessage(env, formatSyncReport(summary));
    }

    log(success === nodes.length ? 'info' : 'error', 'sync_finished', {
        run_id: runId,
        source,
        total: nodes.length,
        success,
        failed: nodes.length - success,
        states: details.map((item) => `${item.node}:${item.state}`)
    });
    return summary;
}

async function persistRun(env, summary) {
    if (!env.SYNC_MEMORY) {
        log('warn', 'kv_missing', {});
        return { transitions: [], failureAlerts: [] };
    }

    const transitions = [];
    const failureAlerts = [];
    try {
        await Promise.all(summary.details.map(async (detail) => {
            const key = `sync:node:${detail.node}`;
            const previous = await env.SYNC_MEMORY.get(key, 'json');
            const consecutiveFailures = detail.healthy ? 0 : (previous?.consecutive_failures || 0) + 1;
            const next = {
                node: detail.node,
                current_status: detail.state,
                healthy: detail.healthy,
                last_attempt: summary.completed_at,
                last_success: detail.healthy ? summary.completed_at : previous?.last_success || null,
                consecutive_failures: consecutiveFailures,
                last_http_status: detail.status ?? null,
                last_duration_ms: detail.duration_ms,
                last_error: detail.error || null
            };

            if (previous?.current_status && previous.current_status !== next.current_status) {
                transitions.push({ node: detail.node, from: previous.current_status, to: next.current_status });
            }
            if (!detail.healthy && consecutiveFailures === 2) {
                failureAlerts.push({ node: detail.node, failures: consecutiveFailures, status: detail.state });
            }
            await env.SYNC_MEMORY.put(key, JSON.stringify(next));
        }));

        const storedSummary = { ...summary, transitions, failure_alerts: failureAlerts };
        await Promise.all([
            env.SYNC_MEMORY.put('sync:latest', JSON.stringify(storedSummary)),
            env.SYNC_MEMORY.put(`sync:run:${summary.run_id}`, JSON.stringify(storedSummary), {
                expirationTtl: RUN_TTL_SECONDS
            })
        ]);
        return { transitions, failureAlerts };
    } catch (error) {
        log('error', 'kv_write_failed', { error: safeErrorMessage(error) });
        return { transitions, failureAlerts };
    }
}

function shouldSendReport(summary, options) {
    if (options.notify === false) return false;
    if (options.source !== 'cron') return true;
    const hasImportantFailure = summary.details.some((item) => item.state === 'paused');
    const hasTransition = summary.transitions?.length > 0;
    const hasRepeatedFailure = summary.failure_alerts?.length > 0;
    const dailyMorningReport = options.cron === '0 0 * * *';
    return summary.success === 0 || hasImportantFailure || hasTransition || hasRepeatedFailure || dailyMorningReport;
}

async function getHealthSnapshot(env) {
    const configuredNodes = buildNodeList(env).length;
    if (!env.SYNC_MEMORY) {
        return {
            httpStatus: 503,
            body: {
                status: 'unknown',
                service: SERVICE_NAME,
                message: 'KV SYNC_MEMORY belum dipasang.',
                configured_nodes: configuredNodes,
                schedule: CRON_LABEL
            }
        };
    }

    const latest = await env.SYNC_MEMORY.get('sync:latest', 'json');
    if (!latest) {
        return {
            httpStatus: 503,
            body: {
                status: 'unknown',
                service: SERVICE_NAME,
                message: 'Belum ada hasil sync. Tekan tombol Sync di Telegram atau panggil POST /trigger.',
                configured_nodes: configuredNodes,
                schedule: CRON_LABEL
            }
        };
    }

    const ageMs = Date.now() - new Date(latest.completed_at).getTime();
    const paused = latest.details.filter((item) => item.state === 'paused').length;
    const stale = !Number.isFinite(ageMs) || ageMs > HEALTH_MAX_AGE_MS;
    let status = 'healthy';
    let httpStatus = 200;
    if (stale || paused > 0 || latest.success === 0) {
        status = 'unhealthy';
        httpStatus = 503;
    } else if (latest.failed > 0) {
        status = 'degraded';
        httpStatus = 207;
    }

    return {
        httpStatus,
        body: {
            status,
            service: SERVICE_NAME,
            checked_at: new Date().toISOString(),
            configured_nodes: configuredNodes,
            healthy_nodes: latest.success,
            failed_nodes: latest.failed,
            paused_nodes: paused,
            last_run: latest.completed_at,
            stale,
            schedule: CRON_LABEL,
            nodes: latest.details.map((item) => ({ node: item.node, status: item.state }))
        }
    };
}

async function readRunHistory(env) {
    if (!env.SYNC_MEMORY) return { history: [], error: 'KV SYNC_MEMORY belum dipasang.' };
    const listed = await env.SYNC_MEMORY.list({ prefix: 'sync:run:', limit: 20 });
    const keys = listed.keys.map((item) => item.name).sort().reverse();
    const history = (await Promise.all(keys.map((key) => env.SYNC_MEMORY.get(key, 'json')))).filter(Boolean);
    return { history };
}

async function handleTelegramUpdate(update, env) {
    const botToken = getBotToken(env);
    if (!botToken) return;

    const callback = update?.callback_query;
    const message = update?.message;
    const chatId = callback?.message?.chat?.id ?? message?.chat?.id;
    if (chatId === undefined || !isAllowedChat(chatId, env.TELEGRAM_CHAT_ID)) {
        log('warn', 'telegram_chat_rejected', { chat_id: chatId ?? null });
        if (callback?.id) await answerCallback(botToken, callback.id, 'Akses ditolak.');
        return;
    }

    const action = callback?.data || commandToAction(message?.text);
    if (callback?.id) await answerCallback(botToken, callback.id, 'Perintah diterima ✅');

    if (action === 'start') {
        await sendTelegramMessage(env,
            'Halo! Aku bantu menjaga Supabase tetap aktif.\n\nPilih tombol di bawah ya:',
            { chatId, replyMarkup: TELEGRAM_BUTTONS }
        );
        return;
    }

    if (action === 'ping') {
        await sendTelegramMessage(env, 'Pong! 🏓 Bot masih hidup.', { chatId, replyMarkup: TELEGRAM_BUTTONS });
        return;
    }

    if (action === 'sync') {
        await sendTelegramMessage(env, '⏳ Sebentar ya, Supabase sedang diperiksa...', { chatId });
        const summary = await runSync(env, { source: 'telegram', notify: false });
        await sendTelegramMessage(env, formatSyncReport(summary), { chatId, replyMarkup: TELEGRAM_BUTTONS });
        return;
    }

    if (action === 'status') {
        const snapshot = await getHealthSnapshot(env);
        await sendTelegramMessage(env, formatHealthMessage(snapshot.body), { chatId, replyMarkup: TELEGRAM_BUTTONS });
        return;
    }

    if (action === 'memory') {
        const latest = env.SYNC_MEMORY ? await env.SYNC_MEMORY.get('sync:latest', 'json') : null;
        await sendTelegramMessage(
            env,
            latest ? formatSyncReport(latest) : '🗭 Belum ada riwayat sync.',
            { chatId, replyMarkup: TELEGRAM_BUTTONS }
        );
        return;
    }

    await sendTelegramMessage(env, 'Aku belum mengerti perintah itu. Coba pilih tombol di bawah ya.', {
        chatId,
        replyMarkup: TELEGRAM_BUTTONS
    });
}

function commandToAction(text = '') {
    const command = text.trim().split(/\s+/)[0].toLowerCase().split('@')[0];
    const commands = {
        '/start': 'start',
        '/ping': 'ping',
        '/sync': 'sync',
        '/status': 'status',
        '/memory': 'memory'
    };
    return commands[command] || 'unknown';
}

function isAllowedChat(chatId, allowedChatId) {
    return Boolean(allowedChatId) && String(chatId).trim() === String(allowedChatId).trim();
}

function formatSyncReport(summary) {
    const completedAt = summary.completed_at || new Date().toISOString();
    const time = formatWita(completedAt);
    const lines = [
        '🔄 Laporan Supabase',
        '',
        `Waktu: ${time}`,
        `Uptime bot: ${formatUptime(completedAt)} (sejak 1 Maret 2026)`,
        `Hasil: ${summary.success}/${summary.total} node sehat`,
        ''
    ];

    if (summary.total === 0) lines.push('⚠️ Belum ada node yang dipasang.');
    for (const item of summary.details || []) {
        const icon = item.healthy ? '✅' : item.state === 'paused' ? '⏸️' : '❌';
        lines.push(`${icon} ${item.node}: ${friendlyState(item.state)} (${item.duration_ms ?? 0} ms)`);
        if (item.error) lines.push(`   ${item.error}`);
    }

    if ((summary.details || []).some((item) => item.state === 'paused')) {
        lines.push('', '🚨 Ada project paused. Buka Supabase Dashboard, lalu tekan Resume project.');
    }
    return lines.join('\n');
}

function formatHealthMessage(snapshot) {
    const icon = snapshot.status === 'healthy' ? '✅' : snapshot.status === 'degraded' ? '⚠️' : '❌';
    return [
        `${icon} Status: ${snapshot.status || 'unknown'}`,
        `Node sehat: ${snapshot.healthy_nodes ?? 0}`,
        `Node gagal: ${snapshot.failed_nodes ?? 0}`,
        `Node paused: ${snapshot.paused_nodes ?? 0}`,
        `Sync terakhir: ${snapshot.last_run ? formatWita(snapshot.last_run) : 'belum ada'}`,
        `Jadwal: ${snapshot.schedule || CRON_LABEL}`
    ].join('\n');
}

function friendlyState(state) {
    const labels = {
        healthy: 'sehat',
        paused: 'paused',
        auth_error: 'key salah/ditolak',
        rpc_missing: 'fungsi RPC belum ada',
        rpc_error: 'RPC bermasalah',
        database_error: 'database bermasalah',
        timeout: 'terlalu lama',
        network_error: 'jaringan bermasalah',
        restricted: 'project dibatasi'
    };
    return labels[state] || state;
}

function formatWita(value) {
    return new Date(value).toLocaleString('id-ID', {
        timeZone: 'Asia/Makassar',
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}

function formatUptime(value = new Date().toISOString()) {
    const startedAt = new Date(BOT_STARTED_AT).getTime();
    const currentTime = new Date(value).getTime();
    const difference = Math.max(0, currentTime - startedAt);
    const totalMinutes = Math.floor(difference / (60 * 1000));
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;
    return `${days} hari, ${hours} jam, ${minutes} menit`;
}

function getBotToken(env) {
    const token = env.TELEGRAM_BOT_TOKEN || env.NEW_BOT_TOKEN;
    return token ? token.trim() : '';
}

async function sendTelegramMessage(env, text, options = {}) {
    const botToken = getBotToken(env);
    const chatId = (options.chatId ?? env.TELEGRAM_CHAT_ID)?.toString().trim();
    if (!botToken || !chatId) {
        log('warn', 'telegram_not_configured', {});
        return { ok: false, description: 'Telegram belum diatur' };
    }

    const payload = {
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
        ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {})
    };
    const result = await callTelegram(botToken, 'sendMessage', payload);
    if (!result.ok) log('error', 'telegram_send_failed', { description: result.description });
    return result;
}

async function answerCallback(botToken, callbackQueryId, text) {
    return callTelegram(botToken, 'answerCallbackQuery', {
        callback_query_id: callbackQueryId,
        text,
        show_alert: false
    });
}

async function callTelegram(botToken, method, payload) {
    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await readSmallResponse(response);
        return result && typeof result === 'object'
            ? { ...result, ok: response.ok && result.ok !== false }
            : { ok: response.ok, description: `Telegram HTTP ${response.status}` };
    } catch (error) {
        return { ok: false, description: safeErrorMessage(error) };
    }
}

async function requireBearerToken(request, expectedToken) {
    if (!expectedToken) return jsonResponse({ error: 'MANUAL_TRIGGER_TOKEN belum diatur.' }, 500);
    const header = request.headers.get('Authorization') || '';
    const receivedToken = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!await secureCompare(receivedToken, expectedToken.trim())) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    return null;
}

async function secureCompare(left, right) {
    const encoder = new TextEncoder();
    const leftBytes = encoder.encode(String(left));
    const rightBytes = encoder.encode(String(right));
    const maxLength = Math.max(leftBytes.length, rightBytes.length, 1);
    let mismatch = leftBytes.length ^ rightBytes.length;
    for (let index = 0; index < maxLength; index += 1) {
        mismatch |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
    }
    return mismatch === 0;
}

function extractApiError(data) {
    if (!data) return null;
    if (typeof data === 'string') return data.slice(0, 500);
    return data.message || data.error || data.code || null;
}

function safeErrorMessage(error) {
    return error instanceof Error ? error.message : String(error || 'Unknown error');
}

function log(level, event, details) {
    const record = JSON.stringify({ level, event, timestamp: new Date().toISOString(), ...details });
    if (level === 'error') console.error(record);
    else if (level === 'warn') console.warn(record);
    else console.log(record);
}

function methodNotAllowed(methods) {
    return jsonResponse({ error: 'Method not allowed', allowed_methods: methods }, 405, {
        Allow: methods.join(', ')
    });
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
    return Response.json(data, {
        status,
        headers: {
            'Cache-Control': 'no-store',
            ...extraHeaders
        }
    });
}

export const __test = {
    buildNodeList,
    classifySupabaseResponse,
    commandToAction,
    formatUptime,
    secureCompare,
    syncNode
};
