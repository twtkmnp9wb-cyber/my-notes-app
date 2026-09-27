export const AppState = {
    notes: [],
    activeTab: 'feed',
    searchQuery: '',

    getFilteredNotes() {
        return this.notes.filter(note => {
            const matchesTab = this.activeTab === 'feed' ? note.type === 'feed' : note.type === 'task';
            const matchesSearch = !this.searchQuery || 
                (note.title && note.title.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
                (note.text && note.text.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
                (note.hashtag && note.hashtag.toLowerCase().includes(this.searchQuery.toLowerCase()));
            
            return matchesTab && matchesSearch;
        });
    },

    addNote(newNote) {
        this.notes.unshift(newNote);
    },

    updateNote(id, updatedFields) {
        const index = this.notes.findIndex(n => String(n.id) === String(id));
        if (index !== -1) {
            this.notes[index] = { ...this.notes[index], ...updatedFields };
        }
    },

    deleteNote(id) {
        this.notes = this.notes.filter(n => String(n.id) !== String(id));
    }
};
