// Сжатие вложений перед сохранением — как в Telegram. Оригиналы остаются в галерее телефона,
// а в приложении и в облаке живёт лёгкая копия: фото до 2560px в JPEG, видео до 720p в MP4 (H.264).
// Если сжать не вышло (старый браузер, редкий формат) — молча оставляем исходный файл.
const MEDIABUNNY = 'https://cdn.jsdelivr.net/npm/mediabunny@1.61.3/+esm';

const PHOTO_MAX = 2560;
const PHOTO_QUALITY = 0.85;
const PHOTO_SKIP_BELOW = 600 * 1024;     // маленькие картинки не трогаем

const VIDEO_MAX = 1280;                  // длинная сторона: 1280×720 для горизонтального, 720×1280 для вертикального
const VIDEO_BITRATE = 2_500_000;         // ~19 МБ на минуту
const VIDEO_SKIP_BELOW = 12 * 1024 ** 2;

const rename = (name, ext) => `${name.replace(/\.[^.]+$/, '') || 'файл'}.${ext}`;

export async function compressImage(file) {
    if (!file.type.startsWith('image/') || /gif|svg/.test(file.type)) return file;
    const url = URL.createObjectURL(file);
    try {
        // onload, а не img.decode(): decode() у картинки вне страницы в части браузеров может не завершиться
        const img = await new Promise((resolve, reject) => {
            const i = new Image();
            const timer = setTimeout(() => reject(new Error('timeout')), 15000);
            i.onload = () => { clearTimeout(timer); resolve(i); };
            i.onerror = () => { clearTimeout(timer); reject(new Error('decode failed')); };
            i.src = url;
        });
        const { naturalWidth: w, naturalHeight: h } = img;
        if (file.size < PHOTO_SKIP_BELOW && Math.max(w, h) <= PHOTO_MAX) return file;

        const k = Math.min(1, PHOTO_MAX / Math.max(w, h));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * k);
        canvas.height = Math.round(h * k);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000';   // у PNG с прозрачностью фон станет чёрным, а не «шахматкой»
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', PHOTO_QUALITY));
        // Пустой blob бывает, если iOS не потянул холст такого размера — тогда оставляем оригинал
        if (!blob?.size || blob.size >= file.size) return file;
        return new File([blob], rename(file.name, 'jpg'), { type: 'image/jpeg' });
    } catch (e) {
        console.warn('Фото не сжалось, оставляю оригинал', e);   // например, HEIC в Chrome
        return file;
    } finally {
        URL.revokeObjectURL(url);
    }
}

// onProgress(0..1); signal — AbortSignal, чтобы отменить сжатие, если вложение убрали из формы
export async function compressVideo(file, { onProgress, signal } = {}) {
    if (!file.type.startsWith('video/')) return file;
    try {
        const mb = await import(MEDIABUNNY);
        const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
        const track = await input.getPrimaryVideoTrack();
        if (!track) return file;

        const { displayWidth: w, displayHeight: h } = track;
        const k = Math.min(1, VIDEO_MAX / Math.max(w, h));
        if (k === 1 && file.size < VIDEO_SKIP_BELOW) return file;
        const even = (n) => Math.max(2, Math.round(n / 2) * 2);   // кодеки требуют чётных размеров
        const width = even(w * k);
        const height = even(h * k);
        if (!(await mb.canEncodeVideo('avc', { width, height, bitrate: VIDEO_BITRATE }))) return file;

        const output = new mb.Output({
            format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }),   // чтобы видео начинало играть сразу
            target: new mb.BufferTarget(),
        });
        const conversion = await mb.Conversion.init({
            input,
            output,
            // Битрейт обязательно объектом и в режиме constant: число в Quality(...) библиотека трактует иначе,
            // и на тестах файл раздувался в разы вместо сжатия
            video: {
                width, height, fit: 'contain', codec: 'avc',
                quality: new mb.Quality({ bitrate: VIDEO_BITRATE, bitrateMode: 'constant' }),
            },
            showWarnings: false,
        });
        if (!conversion.isValid) return file;
        if (signal?.aborted) return file;
        signal?.addEventListener('abort', () => conversion.cancel());
        conversion.onProgress = (p) => onProgress?.(p);
        await conversion.execute();
        if (signal?.aborted || !output.target.buffer) return file;

        const blob = new Blob([output.target.buffer], { type: 'video/mp4' });
        if (blob.size >= file.size) return file;
        return new File([blob], rename(file.name, 'mp4'), { type: 'video/mp4' });
    } catch (e) {
        if (!signal?.aborted) console.warn('Видео не сжалось, оставляю оригинал', e);
        return file;
    }
}
