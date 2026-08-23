export const WallpaperService = {
    init() {
        const bgLayer = document.getElementById('bgLayer');
        const scaleRange = document.getElementById('bgScaleRange');
        const scaleText = document.getElementById('scaleValueText');
        const fileInput = document.getElementById('bgFileInput');
        const customTitleInput = document.getElementById('customBgTitleInput');

        // 1. Загружаем сохраненные обои при старте
        const savedBg = localStorage.getItem('app_custom_bg');
        const savedScale = localStorage.getItem('app_bg_scale') || '100';

        if (savedBg && bgLayer) {
            bgLayer.style.backgroundImage = `url(${savedBg})`;
        }
        if (scaleRange && bgLayer) {
            scaleRange.value = savedScale;
            bgLayer.style.transform = `scale(${savedScale / 100})`;
            if (scaleText) scaleText.innerText = `${savedScale}%`;
        }

        // 2. Обработка ползунка зума/масштаба
        scaleRange?.addEventListener('input', (e) => {
            const val = e.target.value;
            if (bgLayer) {
                bgLayer.style.transform = `scale(${val / 100})`;
            }
            if (scaleText) {
                scaleText.innerText = `${val}%`;
            }
            localStorage.setItem('app_bg_scale', val);
        });

        // 3. Загрузка своего файла обоев с ПК/телефона
        fileInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const base64Image = event.target.result;
                if (bgLayer) {
                    bgLayer.style.backgroundImage = `url(${base64Image})`;
                }
                // Сохраняем в localStorage, чтобы обои не слетали
                localStorage.setItem('app_custom_bg', base64Image);
            };
            reader.readAsDataURL(file);
        });
    }
};
