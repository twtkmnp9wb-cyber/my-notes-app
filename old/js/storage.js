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
