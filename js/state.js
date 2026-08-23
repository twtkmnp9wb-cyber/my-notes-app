export const AppState = {
    notes: [],
    currentTab: 'feed', // 'feed', 'sprint', 'backlog'
    currentFilter: 'Все', // Активный чипс-фильтр

    init(initialNotes) {
        this.notes = initialNotes || [];
    },

    addNote(note) {
        this.notes.unshift(note);
    },

    deleteNote(id) {
        this.notes = this.notes.filter(n => n.id !== id);
    },

    getFilteredNotes() {
        // 1. Фильтрация по вкладкам (Лента / Спринт / Бэклог)
        let result = this.notes.filter(n => {
            if (this.currentTab === 'feed') return n.type === 'feed';
            if (this.currentTab === 'sprint') return n.type === 'task' && (n.folder === 'sprint' || !n.folder);
            if (this.currentTab === 'backlog') return n.type === 'task' && n.folder === 'backlog';
            return true;
        });

        // 2. Фильтрация по выбранному чипсу (если не "Все")
        if (this.currentFilter && this.currentFilter !== 'Все') {
            result = result.filter(n => {
                const targetText = (n.title + ' ' + (n.text || '') + ' ' + (n.hashtag || '')).toLowerCase();
                return targetText.includes(this.currentFilter.toLowerCase());
            });
        }

        return result;
    }
};
