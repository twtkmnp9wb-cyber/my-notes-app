// Вложения постов (фото, видео, аудио, файлы) лежат в IndexedDB: localStorage держит ~5 МБ на всё,
// а IndexedDB — сотни мегабайт и больше и умеет хранить Blob как есть. В посте хранится только описание:
// { id, name, type, size, kind }.
const DB_NAME = 'mdusha_media';
const STORE = 'blobs';

let dbPromise = null;
const urlCache = new Map();

function db() {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => req.result.createObjectStore(STORE);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    return dbPromise;
}

async function tx(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
        const t = d.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(req?.result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
    });
}

export function kindOf(type = '') {
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';
    return 'file';
}

export function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} КБ`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} МБ`;
    return `${(bytes / 1024 ** 3).toFixed(2)} ГБ`;
}

// Размер картинки/видео при загрузке — чтобы в ленте сразу зарезервировать место под пропорции
// и лента не прыгала, пока файлы догружаются
export function measure(file) {
    const kind = kindOf(file.type);
    if (kind !== 'image' && kind !== 'video') return Promise.resolve({});
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const done = (w, h) => { URL.revokeObjectURL(url); resolve(w && h ? { w, h } : {}); };
        setTimeout(() => done(), 4000);
        if (kind === 'image') {
            const img = new Image();
            img.onload = () => done(img.naturalWidth, img.naturalHeight);
            img.onerror = () => done();
            img.src = url;
        } else {
            const v = document.createElement('video');
            v.preload = 'metadata';
            v.onloadedmetadata = () => done(v.videoWidth, v.videoHeight);
            v.onerror = () => done();
            v.src = url;
        }
    });
}

export const media = {
    async put(id, blob) {
        // Кладём в базу копию байтов, а не сам File: в Safari File из <input> может ссылаться на временный файл,
        // который система потом удаляет, и в базе остаётся пустышка
        const bytes = await blob.arrayBuffer();
        if (!bytes.byteLength) throw new Error('Файл пустой — попробуй прикрепить его ещё раз');
        const copy = new Blob([bytes], { type: blob.type });
        await tx('readwrite', (s) => s.put(copy, id));
        // Просим браузер не вычищать хранилище при нехватке места (особенно актуально для Safari)
        navigator.storage?.persist?.().catch(() => {});
    },

    // Загрузчик из облака (ставит sync.js): если файла нет на этом устройстве — скачиваем и кладём в базу
    remote: null,

    get(id) {
        return tx('readonly', (s) => s.get(id));
    },

    async keys() {
        return tx('readonly', (s) => s.getAllKeys());
    },

    async url(id) {
        if (urlCache.has(id)) return urlCache.get(id);
        let blob = await this.get(id);
        if (!blob && this.remote) {
            blob = await this.remote(id).catch(() => null);
            if (blob) await tx('readwrite', (s) => s.put(blob, id));
        }
        if (!blob) return null;
        const url = URL.createObjectURL(blob);
        urlCache.set(id, url);
        return url;
    },

    async remove(id) {
        await tx('readwrite', (s) => s.delete(id));
        if (urlCache.has(id)) { URL.revokeObjectURL(urlCache.get(id)); urlCache.delete(id); }
    },

    // Удаляем файлы, на которые больше не ссылается ни живой сезон, ни архив
    async gc(referenced) {
        const keys = await this.keys();
        await Promise.all(keys.filter((k) => !referenced.has(k)).map((k) => this.remove(k)));
    },

    // Подставляет src во все элементы с data-att после рендера (HTML собирается строкой, а Blob грузится асинхронно)
    async hydrate(root = document) {
        const els = [...root.querySelectorAll('[data-att]:not([data-hydrated])')];
        await Promise.all(els.map(async (el) => {
            el.dataset.hydrated = '1';
            const url = await this.url(el.dataset.att).catch(() => null);
            if (!url) {
                el.dataset.missing = '1';
                el.closest('.att')?.classList.add('is-missing');
                return;
            }
            delete el.dataset.missing;
            el.closest('.att')?.classList.remove('is-missing');
            if (el.tagName === 'A') el.href = url;
            // #t=0.1 — чтобы Safari на iPhone показал первый кадр видео вместо чёрного квадрата
            else el.src = el.tagName === 'VIDEO' && el.dataset.poster ? `${url}#t=0.1` : url;
        }));
    },

    // Файл мог ещё не долететь в облако с другого устройства, когда мы пытались его скачать.
    // После каждой синхронизации пробуем такие места ещё раз.
    retryMissing(root = document) {
        const els = root.querySelectorAll('[data-att][data-missing]');
        if (!els.length) return;
        els.forEach((el) => { delete el.dataset.hydrated; });
        this.hydrate(root);
    },
};
