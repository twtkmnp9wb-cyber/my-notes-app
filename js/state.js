import { CloudStorage } from './supabase.js';

export const AppState = {
    notes: [],
    currentTab: 'feed', // 'feed', 'sprint', 'backlog', 'dump'
    currentFilter: 'Все', 
    currentFolder: 'all',
    searchQuery: '',

    init(notes) {
        if (notes) {
            this.notes = notes;
        }
    },

    async addNote(noteData) {
        const newNote = {
            id: Date.now(),
            createdAt: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            folder: noteData.folder || 'general',
            type: noteData.type || 'feed',
            todos: noteData.todos || [],
            ...noteData
        };
        this.notes.unshift(newNote);
        await CloudStorage.saveNote(newNote);
    },

    async updateNote(updatedNote) {
        const index = this.notes.findIndex(n => n.id === updatedNote.id);
        if (index !== -1) {
            this.notes[index] = updatedNote;
            await CloudStorage.saveNote(updatedNote);
        }
    },

    async deleteNote(id) {
        this.notes = this.notes.filter(n => n.id !== id);
        await CloudStorage.deleteNote(id);
    },

    getFilteredNotes() {
        let result = [...this.notes];

        if (this.currentTab === 'feed') {
            result = result.filter(n => n.type === 'feed');
        } else if (this.currentTab === 'sprint') {
            result = result.filter(n => n.type === 'task' && n.folder === 'sprint');
        } else if (this.currentTab === 'backlog') {
            result = result.filter(n => n.type === 'task' && n.folder === 'backlog');
        }

        if (this.currentFilter && this.currentFilter !== 'Все') {
            result = result.filter(n => n.hashtag === this.currentFilter || n.category === this.currentFilter);
        }

        if (this.searchQuery && this.searchQuery.trim() !== '') {
            const query = this.searchQuery.toLowerCase().trim();
            result = result.filter(n => {
                const titleMatch = n.title && n.title.toLowerCase().includes(query);
                const textMatch = n.text && n.text.toLowerCase().includes(query);
                const tagMatch = n.hashtag && n.hashtag.toLowerCase().includes(query);
                return titleMatch || textMatch || tagMatch;
            });
        }

        return result;
    }
};
