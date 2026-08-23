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

        // Поддерживаем как формат с колонкой payload, так и плоскую структуру
        return data ? data.map(row => row.payload || row) : [];
    },

    async saveNote(note) {
        // Пробуем отправить универсальный объект, включая поле payload, 
        // а также дублируем базовые поля на случай строгой схемы таблицы
        const record = {
            id: String(note.id),
            title: note.title || '',
            text: note.text || '',
            payload: note
        };

        const { error } = await supabase
            .from('notes')
            .upsert(record, { onConflict: 'id' });

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
