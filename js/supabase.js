import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://efbgtwfbonvkpgsfnodp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wKN1cbveZiaJd_uyCWizkQ_1M_Z2g20';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const CloudStorage = {
    // Загрузка всех заметок из облака
    async fetchNotes() {
        const { data, error } = await supabase
            .from('notes')
            .select('*');

        if (error) {
            console.error('Ошибка загрузки из облака:', error);
            return null;
        }
        // Если данные хранятся в поле payload, достаем их оттуда, иначе возвращаем как есть
        return data ? data.map(row => row.payload || row) : [];
    },

    // Сохранение / обновление записей в облаке
    async saveNote(note) {
        // Упаковываем всю заметку в объект с id и payload, чтобы база не искала несуществующие колонки
        const { error } = await supabase
            .from('notes')
            .upsert({ 
                id: String(note.id), 
                payload: note 
            });

        if (error) console.error('Ошибка сохранения в облако:', error);
    },

    // Удаление из облака
    async deleteNote(id) {
        const { error } = await supabase
            .from('notes')
            .delete()
            .eq('id', String(id));

        if (error) console.error('Ошибка удаления из облака:', error);
    }
};
