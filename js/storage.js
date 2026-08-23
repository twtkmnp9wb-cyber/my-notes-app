const STORAGE_KEY = 'app_notes_and_tasks';
const RESET_DATE_KEY = 'last_midnight_reset_date';

export const StorageService = {
    load() {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    },

    save(notes) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    },

    // Экспорт в JSON файл
    exportToJSON() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.load(), null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `backup_notes_${new Date().toISOString().slice(0,10)}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    },

    // Импорт из JSON файла
    importFromJSON(file, callback) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (Array.isArray(importedData)) {
                    this.save(importedData);
                    callback(importedData);
                }
            } catch (err) {
                alert("Ошибка чтения JSON-файла!");
            }
        };
        reader.readAsText(file);
    },

    // Проверка полночи (Правило 3 вылетов)
    runMidnightCheck(notes) {
        const lastReset = localStorage.getItem(RESET_DATE_KEY);
        const today = new Date().toDateString();

        if (lastReset !== today) {
            const updated = notes.filter(item => {
                if (item.type !== 'task' || item.completed) return true;
                item.strikes = (item.strikes || 0) + 1;
                return item.strikes < 3;
            });
            localStorage.setItem(RESET_DATE_KEY, today);
            this.save(updated);
            return updated;
        }
        return notes;
    }
};
