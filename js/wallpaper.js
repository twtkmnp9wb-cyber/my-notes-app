// Обои: готовые пресеты (рисуются CSS — ничего не весят и работают офлайн), своя картинка
// и каллиграфическая надпись поверх любого из них. Хранятся на устройстве, не синхронизируются.
const CUSTOM_KEY = 'app_custom_bg';
const PRESET_KEY = 'app_bg_preset';
const TEXT_KEY = 'app_bg_text';
const DEFAULT_PRESET = 'purple';

// Плёночное зерно: шум из SVG-фильтра, накладывается поверх градиента
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>',
)}")`;

export const PRESETS = [
    { id: 'oled', name: 'OLED Black', bg: '#000' },
    {
        id: 'purple', name: 'Cyber Purple',
        bg: 'radial-gradient(120% 65% at 85% 0%, rgba(124, 58, 237, 0.55), transparent 62%), radial-gradient(90% 55% at 0% 100%, rgba(76, 29, 149, 0.3), transparent 70%), #0b0912',
    },
    {
        id: 'midnight', name: 'Midnight',
        bg: 'radial-gradient(115% 65% at 85% 0%, rgba(37, 99, 235, 0.5), transparent 62%), radial-gradient(80% 50% at 0% 100%, rgba(30, 58, 138, 0.3), transparent 70%), #070b16',
    },
    {
        id: 'emerald', name: 'Emerald Glow',
        bg: 'radial-gradient(115% 65% at 85% 0%, rgba(16, 185, 129, 0.42), transparent 62%), radial-gradient(80% 50% at 0% 100%, rgba(6, 95, 70, 0.3), transparent 70%), #06100c',
    },
    {
        id: 'graphite', name: 'Graphite', grain: true,
        bg: 'radial-gradient(130% 50% at 50% 8%, rgba(120, 120, 120, 0.5), transparent 70%), linear-gradient(180deg, #232323 0%, #0e0e0e 50%, #060606 100%)',
    },
    {
        id: 'steel', name: 'Steel', grain: true,
        bg: 'radial-gradient(80% 55% at 100% 55%, rgba(130, 150, 170, 0.42), transparent 65%), linear-gradient(160deg, #080d13 0%, #131d28 55%, #070b10 100%)',
    },
];

const presetById = (id) => PRESETS.find((p) => p.id === id) || PRESETS.find((p) => p.id === DEFAULT_PRESET);

export const GRAIN_CSS = GRAIN;

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

const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };

// Подбираем размер надписи так, чтобы повёрнутое слово целиком помещалось на экране:
// по ширине — не шире экрана, по высоте — в нижних ~3/4, не залезая под меню.
const WORD_ANGLE = 64 * Math.PI / 180;
function fitWord(word) {
    word.style.fontSize = '100px';
    const len = word.scrollWidth || 1;   // длина слова при 100px
    const h = 100;                        // высота строки при 100px
    const sin = Math.sin(WORD_ANGLE);
    const cos = Math.cos(WORD_ANGLE);
    const byWidth = (window.innerWidth * 0.95) / (len * cos + h * sin);
    const byHeight = (window.innerHeight * 0.74) / (len * sin + h * cos);
    const size = Math.min(window.innerHeight * 0.26, 100 * Math.min(byWidth, byHeight));
    word.style.fontSize = `${Math.round(size)}px`;
}

export const WallpaperService = {
    // Что выбрано сейчас: id пресета или 'custom' (своя картинка)
    current() {
        const sel = read(PRESET_KEY);
        if (sel === 'custom' && this.has()) return 'custom';
        if (!sel && this.has()) return 'custom';   // обои, загруженные до появления пресетов
        return presetById(sel).id;
    },

    text() {
        return read(TEXT_KEY) || '';
    },

    apply() {
        const layer = document.getElementById('bgLayer');
        if (!layer) return;
        const sel = this.current();
        layer.classList.toggle('is-photo', sel === 'custom');   // затемнение нужно только фото
        if (sel === 'custom') {
            layer.style.background = `center / cover no-repeat url("${read(CUSTOM_KEY)}")`;
        } else {
            layer.style.background = presetById(sel).bg;
        }
        // Зерно — отдельным слоем поверх (#bgLayer.has-grain::before), а не в общем background:
        // иначе размер плитки шума подхватывали градиенты и фон шёл полосами
        layer.style.setProperty('--grain', GRAIN);
        layer.classList.toggle('has-grain', sel !== 'custom' && !!presetById(sel).grain);

        // Каллиграфическая надпись поверх обоев
        let word = layer.querySelector('.bg-word');
        const text = this.text().trim();
        if (!text) { word?.remove(); return; }
        if (!word) {
            word = document.createElement('div');
            word.className = 'bg-word';
            layer.appendChild(word);
        }
        word.textContent = text;
        fitWord(word);
    },

    has() {
        return !!read(CUSTOM_KEY);
    },

    setPreset(id) {
        localStorage.setItem(PRESET_KEY, id);
        this.apply();
    },

    setText(text) {
        localStorage.setItem(TEXT_KEY, text);
        this.apply();
    },

    async setFromFile(file) {
        const dataUrl = await downscale(file);
        try {
            localStorage.setItem(CUSTOM_KEY, dataUrl);
            localStorage.setItem(PRESET_KEY, 'custom');
        } catch {
            throw new Error('Картинка не поместилась в память браузера');
        }
        this.apply();
    },

    reset() {
        localStorage.removeItem(CUSTOM_KEY);
        if (read(PRESET_KEY) === 'custom') localStorage.setItem(PRESET_KEY, DEFAULT_PRESET);
        this.apply();
    },
};
