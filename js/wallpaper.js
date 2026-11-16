const KEY = 'app_custom_bg';
const PRESET_KEY = 'app_bg_preset';
const GLASS_KEY = 'app_glass';

// Однотонные «глубокие» фоны: тёмная база и мягкое свечение сверху справа
export const PRESETS = {
    oled: { name: 'OLED Black', css: '#000000' },
    graphite: { name: 'Graphite', css: 'radial-gradient(120% 70% at 80% 0%, #23262d 0%, #0f1115 45%, #040506 100%)' },
    ink: { name: 'Ink', css: 'radial-gradient(120% 70% at 85% 0%, #0d2147 0%, #070f24 42%, #02050d 100%)' },
    forest: { name: 'Forest', css: 'radial-gradient(120% 70% at 85% 0%, #0c3a2c 0%, #061f17 42%, #020a07 100%)' },
    aubergine: { name: 'Aubergine', css: 'radial-gradient(120% 70% at 85% 0%, #3b1850 0%, #190a28 42%, #07030d 100%)' },
    oxblood: { name: 'Oxblood', css: 'radial-gradient(120% 70% at 85% 0%, #6b1530 0%, #330a17 42%, #0e0408 100%)' },
    espresso: { name: 'Espresso', css: 'radial-gradient(120% 70% at 85% 0%, #4a2f22 0%, #26160f 42%, #0b0604 100%)' },
    petrol: { name: 'Petrol', css: 'radial-gradient(120% 70% at 85% 0%, #0f4a53 0%, #08262c 42%, #020c0e 100%)' },
};
// Ключи из прошлой версии
const LEGACY = { midnight: 'ink', violet: 'aubergine', emerald: 'forest', bordeaux: 'oxblood' };

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
        const raw = localStorage.getItem(PRESET_KEY);
        const id = LEGACY[raw] || raw;
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
        // Матовость — это размытие того, что лежит за стеклом: растёт радиус и насыщенность фона.
        // Цвет стекла почти не меняется, поэтому ничего не белеет и не темнеет.
        const a = 0.08 + 0.04 * t;
        const root = document.documentElement.style;
        root.setProperty('--glass', `rgba(255, 255, 255, ${a.toFixed(3)})`);
        root.setProperty('--glass-a', a.toFixed(3));
        root.setProperty('--blur', `blur(${Math.round(16 + 44 * t)}px) saturate(${(1 + 0.35 * t).toFixed(2)})`);
    },

    set(t) {
        try { localStorage.setItem(GLASS_KEY, String(t)); } catch { /* приватный режим */ }
        this.apply(t);
    },
};