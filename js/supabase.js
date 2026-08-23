import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://efbgtwfbonvkpgsfnodp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmYmd0d2Zib252a3Bnc2Zub2RwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0Mzk0MjksImV4cCI6MjEwMzAxNTQyOX0.dEjfiX_jOBTbfpg6Tb5X9GCSdYf0MEZo6VtGin4s_xk';

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

        // Достаем объект заметки из колонки payload
        return data ? data.map(row => row.payload).filter(Boolean) : [];
    },

    async saveNote(note) {
        // Отправляем строго id и обертку payload, больше никаких лишних колонок!
        const { error } = await supabase
            .from('notes')
            .upsert({
                id: String(note.id),
                payload: note
            }, { onConflict: 'id' });

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
