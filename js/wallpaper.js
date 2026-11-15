const KEY = 'app_custom_bg';
const PRESET_KEY = 'app_bg_preset';
const GLASS_KEY = 'app_glass';

// Однотонные «глубокие» фоны: тёмная база и мягкое свечение сверху справа
export const PRESETS = {
    oled: { name: 'OLED Black', css: '#000000' },
    graphite: { name: 'Graphite', css: 'radial-gradient(120% 70% at 80% 0%, #2b2f38 0%, #14161b 45%, #07080a 100%)' },
    midnight: { name: 'Midnight', css: 'radial-gradient(120% 70% at 85% 0%, #123a7a 0%, #0a1c40 38%, #050a18 100%)' },
    violet: { name: 'Violet', css: 'radial-gradient(120% 70% at 85% 0%, #4a2090 0%, #20113f 40%, #0a0614 100%)' },
    emerald: { name: 'Emerald', css: 'radial-gradient(120% 70% at 85% 0%, #1f7a5c 0%, #0f3b2f 40%, #04120e 100%)' },
    bordeaux: { name: 'Bordeaux', css: 'radial-gradient(120% 70% at 85% 0%, #7a1d3a 0%, #3a0d1c 42%, #12050a 100%)' },
};

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
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read the image")); };
        img.src = url;
    });
}

export const WallpaperService = {
    // Фото важнее пресета; пресет — только если его id известен (ключ мог остаться от старой версии)
    preset() {
        const id = localStorage.getItem(PRESET_KEY);
        return PRESETS[id] ? id : '';
    },

    apply() {
        const layer = document.getElementById('bgLayer');
        if (!layer) return;
        const bg = localStorage.getItem(KEY);
        const preset = this.preset();
        layer.style.background = '';
        if (bg) layer.style.backgroundImage = `url("${bg}")`;
        else if (preset) layer.style.background = PRESETS[preset].css;
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
            throw new Error("Image doesn't fit in browser storage");
        }
        localStorage.removeItem(PRESET_KEY);
        this.apply();
    },

    setPreset(id) {
        if (!PRESETS[id]) return;
        localStorage.removeItem(KEY);
        localStorage.setItem(PRESET_KEY, id);
        this.apply();
    },

    reset() {
        ['app_bg_preset', 'app_bg_text', KEY].forEach((k) => localStorage.removeItem(k));
        this.apply();
    },
};

// Матовость стекла: 0 — прозрачное светлое, 1 — плотное тёмное матовое. Настройка устройства, как и обои.
export const GlassService = {
    get() {
        const v = parseFloat(localStorage.getItem(GLASS_KEY));
        return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
    },

    apply(t = this.get()) {
        const c = Math.round(255 * (1 - Math.min(1, t * 3)));   // белое стекло → дымчатое → чёрное
        const a = 0.08 + 0.8 * t;
        const root = document.documentElement.style;
        root.setProperty('--glass', `rgba(${c}, ${c}, ${c}, ${a.toFixed(3)})`);
        root.setProperty('--blur', `blur(${Math.round(16 + 18 * t)}px)`);
    },

    set(t) {
        try { localStorage.setItem(GLASS_KEY, String(t)); } catch { /* приватный режим */ }
        this.apply(t);
    },
};