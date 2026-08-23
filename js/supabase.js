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

        // Возвращаем данные как есть или разворачиваем из payload, если он используется
        return data ? data.map(row => row.payload || row) : [];
    },

    async saveNote(note) {
        // Формируем чистый объект, где гарантированно нет undefined или null для ключевых полей
        const cleanRecord = {
            id: String(note.id),
            title: note.title || '',
            text: note.text || '',
            type: note.type || 'feed',
            folder: note.folder || 'general',
            hashtag: note.hashtag || '',
            deadline: note.deadline || null,
            todos: note.todos || [],
            media: note.media || [],
            createdAt: note.createdAt || ''
        };

        const { error } = await supabase
            .from('notes')
            .upsert(cleanRecord, { onConflict: 'id' });

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
