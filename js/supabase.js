import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Твои ключи из панели Supabase
const SUPABASE_URL = 'https://efbgtwfbonvkpgsfnodp.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_wKN1cbveZiaJd_uyCWizkQ_1M_Z2g20'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const CloudStorage = {
    // Загрузка всех заметок из облака
    async fetchNotes() {
        const { data, error } = await supabase
            .from('notes')
            .select('*')
            .order('id', { ascending: false });

        if (error) {
            console.error('Ошибка загрузки из облака:', error);
            return null;
        }
        return data;
    },

    // Сохранение / обновление записей в облаке
    async saveNote(note) {
        const { error } = await supabase
            .from('notes')
            .upsert(note);

        if (error) console.error('Ошибка сохранения в облако:', error);
    },

    // Удаление из облака
    async deleteNote(id) {
        const { error } = await supabase
            .from('notes')
            .delete()
            .eq('id', id);

        if (error) console.error('Ошибка удаления из облака:', error);
    }
};
