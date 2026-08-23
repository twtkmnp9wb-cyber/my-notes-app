// Полностью переводим хранилище на локальный localStorage, чтобы забыть про ошибки сервера
export const CloudStorage = {
    async fetchNotes() {
        try {
            const data = localStorage.getItem('app_notes');
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Ошибка чтения локальных данных:', e);
            return [];
        }
    },

    async saveNote(note) {
        try {
            let notes = await this.fetchNotes() || [];
            const index = notes.findIndex(n => String(n.id) === String(note.id));
            
            if (index >= 0) {
                notes[index] = note;
            } else {
                notes.push(note);
            }
            
            localStorage.setItem('app_notes', JSON.stringify(notes));
        } catch (e) {
            console.error('Ошибка сохранения:', e);
        }
    },

    async deleteNote(id) {
        try {
            let notes = await this.fetchNotes() || [];
            notes = notes.filter(n => String(n.id) !== String(id));
            localStorage.setItem('app_notes', JSON.stringify(notes));
        } catch (e) {
            console.error('Ошибка удаления:', e);
        }
    }
};
