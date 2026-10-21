// Синхронизация через Supabase: одно JSON-состояние на пользователя + приватное хранилище файлов.
// Работает поверх локальных данных: приложение всегда пишет в localStorage/IndexedDB, а этот модуль
// в фоне сливает их с облаком (merge.js). Без ключей в config.js или без входа ничего не делает.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { store } from './store.js';
import { media } from './media.js';
import { mergeDoc, same } from './merge.js';

const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0/+esm';
const BASE_KEY = 'mdusha_sync_base_v1';          // документ на момент последней успешной синхронизации
const UPLOADED_KEY = 'mdusha_sync_uploaded_v1';  // id файлов, уже лежащих в облаке
const BUCKET = 'media';
const PUSH_DELAY = 1500;
const POLL_EVERY = 30000;

export const syncConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

export const syncStatus = {
    state: syncConfigured ? 'signed-out' : 'off',   // off | signed-out | code-sent | syncing | ok | error
    email: '',
    pendingEmail: '',
    lastSync: null,
    error: '',
    warning: '',
};

let sb = null;
let user = null;
let running = false;
let again = false;
let timer = null;
let listeners = { status: () => {}, remoteChange: () => {} };

const readJSON = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const writeJSON = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { console.error(e); } };

function setStatus(patch) {
    Object.assign(syncStatus, patch);
    listeners.status();
}

const localDoc = () => ({ state: structuredClone(store.state), archive: store.loadArchive() });

function referencedIds(doc) {
    const ids = new Set();
    const collect = (state) => (state?.posts || []).forEach((p) => (p.attachments || []).forEach((a) => ids.add(a.id)));
    collect(doc.state);
    (doc.archive || []).forEach((a) => collect(a.state));
    return ids;
}

// Применяем результат слияния к локальным данным. Если за время запроса к облаку здесь успели
// что-то поменять — доливаем эти правки поверх (ещё одно трёхстороннее слияние) и планируем повтор.
function applyMerged(merged, snapshot) {
    const now = localDoc();
    let result = merged;
    if (!same(now, snapshot)) {
        result = mergeDoc(snapshot, now, merged);
        again = true;
    }
    let changed = false;
    if (!same(now.archive, result.archive)) { store.saveArchive(result.archive); changed = true; }
    if (!same(now.state, result.state)) { store.replace(result.state); changed = true; }
    if (changed) listeners.remoteChange();
}

async function syncDoc() {
    for (let attempt = 0; attempt < 4; attempt++) {
        const { data: row, error } = await sb.from('app_state').select('doc, updated_at').eq('user_id', user.id).maybeSingle();
        if (error) throw error;

        const snapshot = localDoc();
        const merged = row ? mergeDoc(readJSON(BASE_KEY, null), snapshot, row.doc) : snapshot;

        if (row && same(merged, row.doc)) {
            writeJSON(BASE_KEY, merged);
            applyMerged(merged, snapshot);
            return merged;
        }

        // Оптимистичная блокировка: пишем, только если в облаке всё ещё та версия, которую мы читали.
        // Иначе другое устройство успело записать раньше — перечитываем и сливаем заново.
        const updated_at = new Date().toISOString();
        let written;
        if (!row) {
            const { error: e } = await sb.from('app_state').insert({ user_id: user.id, doc: merged, updated_at });
            if (e && e.code !== '23505') throw e;
            written = !e;
        } else {
            const { data, error: e } = await sb.from('app_state').update({ doc: merged, updated_at })
                .eq('user_id', user.id).eq('updated_at', row.updated_at).select('user_id');
            if (e) throw e;
            written = data.length > 0;
        }
        if (written) {
            writeJSON(BASE_KEY, merged);
            applyMerged(merged, snapshot);
            return merged;
        }
    }
    throw new Error('Не получилось записать данные: другое устройство синхронизируется одновременно');
}

async function syncMedia(doc) {
    const ids = referencedIds(doc);
    const uploaded = new Set(readJSON(UPLOADED_KEY, []).filter((id) => ids.has(id)));
    const tooBig = [];

    for (const id of await media.keys()) {
        if (!ids.has(id) || uploaded.has(id)) continue;
        const blob = await media.get(id);
        if (!blob) continue;
        const { error } = await sb.storage.from(BUCKET).upload(`${user.id}/${id}`, blob, {
            upsert: true, contentType: blob.type || 'application/octet-stream',
        });
        if (error) { tooBig.push(id); continue; }
        uploaded.add(id);
        writeJSON(UPLOADED_KEY, [...uploaded]);
    }
    writeJSON(UPLOADED_KEY, [...uploaded]);
    setStatus({ warning: tooBig.length ? `${tooBig.length} файл(а) не загрузились в облако — скорее всего, больше 50 МБ. Они есть только на этом устройстве.` : '' });

    // Чистим облако от файлов, на которые больше никто не ссылается. Свежие (моложе 10 минут) не трогаем:
    // их могло только что загрузить другое устройство, чьё состояние мы ещё не видели.
    const { data: objects, error } = await sb.storage.from(BUCKET).list(user.id, { limit: 1000 });
    if (error) return;
    const stale = objects
        .filter((o) => o.name && !ids.has(o.name) && Date.now() - new Date(o.created_at).getTime() > 10 * 60000)
        .map((o) => `${user.id}/${o.name}`);
    if (stale.length) await sb.storage.from(BUCKET).remove(stale);
}

export async function syncNow() {
    if (!sb || !user) return;
    if (running) { again = true; return; }
    running = true;
    setStatus({ state: 'syncing', error: '' });
    try {
        const doc = await syncDoc();
        await syncMedia(doc);
        setStatus({ state: 'ok', lastSync: new Date() });
    } catch (e) {
        console.error(e);
        setStatus({ state: 'error', error: navigator.onLine ? (e.message || String(e)) : 'нет интернета' });
    } finally {
        running = false;
        if (again) { again = false; schedule(); }
    }
}

function schedule() {
    if (!user) return;
    clearTimeout(timer);
    timer = setTimeout(syncNow, PUSH_DELAY);
}

export async function signIn(email) {
    const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: location.origin + location.pathname },
    });
    if (error) throw error;
    setStatus({ state: 'code-sent', pendingEmail: email });
}

// Принимает либо код из письма, либо скопированную ссылку «Sign in». Ссылка нужна для приложения
// на экране «Домой» айфона: оно не видит вход, сделанный в Safari по клику на ссылку.
export async function verifyCode(input) {
    const value = input.trim();
    let tokenHash = null;
    try { tokenHash = new URL(value).searchParams.get('token'); } catch { /* не ссылка — значит код */ }
    const { error } = tokenHash
        ? await sb.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
        : await sb.auth.verifyOtp({ email: syncStatus.pendingEmail, token: value.replace(/\s/g, ''), type: 'email' });
    if (error) throw error;
}

export async function signOut() {
    await sb.auth.signOut();
}

export function cancelSignIn() {
    setStatus({ state: 'signed-out', pendingEmail: '' });
}

function onSession(session) {
    const next = session?.user || null;
    if (next?.id === user?.id) return;
    user = next;
    if (user) {
        setStatus({ state: 'syncing', email: user.email, pendingEmail: '' });
        syncNow();
    } else {
        // Без аккаунта данные остаются на устройстве; при следующем входе сольются с облаком заново
        localStorage.removeItem(BASE_KEY);
        localStorage.removeItem(UPLOADED_KEY);
        setStatus({ state: 'signed-out', email: '', lastSync: null });
    }
}

export async function initSync({ onStatus, onRemoteChange }) {
    listeners = { status: onStatus, remoteChange: onRemoteChange };
    if (!syncConfigured) return;
    try {
        // Динамический импорт: если CDN недоступен (нет сети), приложение всё равно работает локально
        const { createClient } = await import(CDN);
        sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, detectSessionInUrl: true } });
    } catch (e) {
        console.error(e);
        setStatus({ state: 'error', error: 'не удалось загрузить модуль синхронизации' });
        return;
    }

    media.remote = async (id) => {
        if (!user) return null;
        const { data, error } = await sb.storage.from(BUCKET).download(`${user.id}/${id}`);
        if (error) return null;
        const uploaded = new Set(readJSON(UPLOADED_KEY, []));
        uploaded.add(id);
        writeJSON(UPLOADED_KEY, [...uploaded]);
        return data;
    };
    store.onSave = schedule;

    sb.auth.onAuthStateChange((_event, session) => onSession(session));
    const { data } = await sb.auth.getSession();
    onSession(data.session);

    document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
    window.addEventListener('online', () => syncNow());
    setInterval(() => { if (!document.hidden) syncNow(); }, POLL_EVERY);
}
