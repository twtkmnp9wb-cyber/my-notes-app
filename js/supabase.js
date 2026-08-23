import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://efbgtwfbonvkpgsfnodp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wKN1cbveZiaJd_uyCWizkQ_1M_Z2g20';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const CloudStorage = {
    async fetchNotes() {
        const { data, error } = await supabase
            .from('notes')
            .select('*');

        if (error) {
            console.error('Ошибка загрузки из облака:', error);
            return null;
        }
        
        // Преобразуем полученные из базы строки обратно в удобный формат приложения
        return data ? data.map(row => ({
            id: row.id,
            type: row.type || 'feed',
            title: row.title || '',
            text: row.text || '',
            hashtag: row.hashtag || '',
            media: row.media || [],
            todos: row.todos || [],
            completed: row.completed || false,
            createdAt: row.created_at || row.createdAt || ''
        })) : [];
    },

    async saveNote(note) {
        // Отправляем данные в виде плоского объекта, соответствующего колонкам таблицы
        const dbRecord = {
            id: String(note.id),
            type: note.type || 'feed',
            title: note.title || '',
            text: note.text || '',
            hashtag: note.hashtag || '',
            media: note.media || [],
            todos: note.todos || [],
            completed: note.completed || false
        };

        const { error } = await supabase
            .from('notes')
            .upsert(dbRecord, { onConflict: 'id' });

        if (error) {
            console.error('Ошибка сохранения в облако:', error);
        }
    },

    async deleteNote(id) {
        const { error } = await supabase
            .from('notes')
            .delete()
            .eq('id', String(id));

        if (error) {
            console.error('Ошибка удаления из облака:', error);
        }
    }
};
