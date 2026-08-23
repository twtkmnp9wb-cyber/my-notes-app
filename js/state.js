export const AppState = {
    notes: [],
    currentTab: 'feed',
    currentType: 'feed',

    // Загрузка состояния
    init(initialNotes = []) {
        this.notes = initialNotes;
    },

    // Получение отфильтрованных записей
    getFilteredNotes() {
        if (this.currentTab === 'sprint') {
            return this.notes.filter(n => n.type === 'task' && n.folder === 'sprint');
        }
        if (this.currentTab === 'backlog') {
            return this.notes.filter(n => n.type === 'task' && n.folder === 'backlog');
        }
        if (this.currentTab === 'feed') {
            return this.notes.filter(n => n.type === 'feed');
        }
        return this.notes;
    },

    addNote(newNote) {
        this.notes.unshift(newNote);
    },

    deleteNote(id) {
        this.notes = this.notes.filter(n => n.id !== id);
    }
};
