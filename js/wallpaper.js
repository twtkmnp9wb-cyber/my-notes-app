const KEY = 'app_custom_bg';

// Фото с телефона весит 3–10 МБ, а localStorage ~5 МБ на всё приложение,
// поэтому перед сохранением ужимаем картинку до 1600px в JPEG.
function downscale(file, max = 1600, quality = 0.82) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const k = Math.min(1, max / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * k);
            canvas.height = Math.round(img.height * k);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Не удалось прочитать картинку')); };
        img.src = url;
    });
}

export const WallpaperService = {
    apply() {
        const layer = document.getElementById('bgLayer');
        const bg = localStorage.getItem(KEY);
        if (!layer) return;
        layer.style.backgroundImage = bg ? `url("${bg}")` : '';
        layer.classList.toggle('is-photo', !!bg);   // затемнение, чтобы текст читался на фото
    },

    has() {
        return !!localStorage.getItem(KEY);
    },

    async setFromFile(file) {
        const dataUrl = await downscale(file);
        try {
            localStorage.setItem(KEY, dataUrl);
        } catch {
            throw new Error('Картинка не поместилась в память браузера');
        }
        this.apply();
    },

    reset() {
        // Чистим и настройки пресетов/надписи из прошлой версии, если они остались
        ['app_bg_preset', 'app_bg_text'].forEach((k) => localStorage.removeItem(k));
        localStorage.removeItem(KEY);
        this.apply();
    },
};
