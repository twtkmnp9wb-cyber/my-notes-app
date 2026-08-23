import { CloudStorage } from './supabase.js';

export const AppState = {
    notes: [],
    currentTab: 'feed', // 'feed', 'sprint', 'backlog', 'dump'
    currentFilter: 'Все', // для чипсов (Учеба, Проект и т.д.)
    currentFolder: 'all', // для папок
    searchQuery: '', // текст для поиска

    async init() {
        const cloudData = await CloudStorage.fetchNotes();
        if (cloudData) {
            this.notes = cloudData;
        }
    },

    async addNote(noteData) {
        const newNote = {
            id: Date.now(),
            createdAt: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            folder: noteData.folder || 'general',
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

    // Универсальная фильтрация с учетом вкладки, чипсов, папок и поиска
    getFilteredNotes() {
        let result = [...this.notes];

        // 1. Фильтрация по вкладкам
        if (this.currentTab === 'feed') {
            result = result.filter(n => n.type === 'feed');
        } else if (this.currentTab === 'sprint') {
            result = result.filter(n => n.type === 'task' && n.folder === 'sprint');
        } else if (this.currentTab === 'backlog') {
            result = result.filter(n => n.type === 'task' && n.folder === 'backlog');
        } else if (this.currentTab === 'dump') {
            result = result.filter(n => n.type === 'dump' || !n.type);
        }

        // 2. Фильтрация по чипсам категорий (если выбрано не «Все»)
        if (this.currentFilter && this.currentFilter !== 'Все') {
            result = result.filter(n => n.hashtag === this.currentFilter || n.category === this.currentFilter);
        }

        // 3. Фильтрация по папке (если задана)
        if (this.currentFolder && this.currentFolder !== 'all') {
            result = result.filter(n => n.folder === this.currentFolder);
        }

        // 4. Фильтрация по поисковому запросу
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
