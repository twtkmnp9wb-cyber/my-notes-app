// Service worker: приложение открывается без интернета.
// - Свои файлы (страница, стили, скрипты, иконки): сначала сеть — чтобы всегда была свежая версия,
//   без сети — из кэша.
// - Библиотеки с CDN и шрифты: сначала кэш — у них в адресе зашита версия, они не меняются.
// - Supabase (синхронизация и файлы) не трогаем вообще — это живые данные.
const CACHE = 'mdusha-shell-v1';

// Предзагрузка при установке: без неё первый запуск офлайн не сработал бы, ведь при самом первом
// открытии сайта service worker ещё не перехватывал запросы. Новые файлы приложения — добавлять сюда.
const SHELL = [
    './',
    'index.html',
    'manifest.webmanifest',
    'css/style.css',
    'js/main.js',
    'js/store.js',
    'js/dates.js',
    'js/ui.js',
    'js/media.js',
    'js/merge.js',
    'js/sync.js',
    'js/config.js',
    'js/compress.js',
    'js/wallpaper.js',
    'js/screen-debug.js',
    'icons/apple-touch-icon.png',
    'icons/icon-192.png',
    'icons/icon-512.png',
];

const IMMUTABLE_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
        await self.clients.claim();
    })());
});

async function networkFirst(request) {
    const cache = await caches.open(CACHE);
    try {
        // no-cache: сверяемся с сервером, а не берём копию из HTTP-кэша браузера (там она живёт до 10 минут)
        const response = await fetch(request, { cache: 'no-cache' });
        if (response.ok) cache.put(request, response.clone());
        return response;
    } catch (e) {
        const cached = await cache.match(request, { ignoreSearch: true })
            || (request.mode === 'navigate' && await cache.match('index.html'));
        if (cached) return cached;
        throw e;
    }
}

async function cacheFirst(request) {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
    return response;
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin === self.location.origin) {
        event.respondWith(networkFirst(request));
    } else if (IMMUTABLE_HOSTS.includes(url.hostname)) {
        event.respondWith(cacheFirst(request));
    }
    // всё остальное (в том числе Supabase) идёт мимо service worker
});
