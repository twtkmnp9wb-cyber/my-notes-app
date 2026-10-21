// Ключи проекта Supabase: кнопка Connect → .env.local (Project URL и publishable key).
// publishable-ключ публичный по задумке — его можно хранить в открытом репозитории: доступ к данным
// ограничен правилами RLS из supabase/setup.sql, каждый пользователь видит только своё.
// Пока ключей нет, синхронизация выключена и приложение работает только локально.
export const SUPABASE_URL = 'https://fcsafjsbljuvfsvlyfeo.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_qjmnJgh7ug-P8OdpXV0T8A_ADRVHitp';
