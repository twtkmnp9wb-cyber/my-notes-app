// Логический день начинается в 04:00: то, что делаешь в час ночи, ещё относится ко «вчера».
// От этого зависят ночная пересменка спринта и группировка Dump.
export const DAY_START_HOUR = 4;
const MS_DAY = 86400000;

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function logicalDayKey(date = new Date()) {
    const d = new Date(date);
    d.setHours(d.getHours() - DAY_START_HOUR);
    return keyOf(d);
}

export function calendarDayKey(date = new Date()) {
    return keyOf(new Date(date));
}

export function parseKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
}

export function isDateKey(v) {
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function daysBetween(fromKey, toKey) {
    return Math.round((parseKey(toKey) - parseKey(fromKey)) / MS_DAY);
}

export function shortDate(key) {
    return parseKey(key).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function formatTime(iso) {
    return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

// Подпись разделителя дней, как в Telegram. Для Dump «сегодня» — логический день, поэтому todayKey передаётся.
export function dayLabel(dateOrKey, todayKey = calendarDayKey()) {
    const key = isDateKey(dateOrKey) ? dateOrKey : calendarDayKey(dateOrKey);
    const diff = daysBetween(key, todayKey);
    if (diff === 0) return 'Сегодня';
    if (diff === 1) return 'Вчера';
    const d = parseKey(key);
    const opts = { day: 'numeric', month: 'long' };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    return d.toLocaleDateString('ru-RU', opts);
}

// Цвет дедлайна по регламенту: нет даты — белый, ≥3 дней — оранжевый, <3 дней (и просрочка) — красный.
export function deadlineInfo(due) {
    if (!isDateKey(due)) return { level: 'none', label: 'без дедлайна', sort: 1e9 };
    const days = daysBetween(logicalDayKey(), due);
    let label;
    if (days < 0) label = `просрочено ${-days} дн`;
    else if (days === 0) label = 'сегодня';
    else if (days === 1) label = 'завтра';
    else label = `${days} дн · ${shortDate(due)}`;
    return { level: days < 3 ? 'hot' : 'calm', label, sort: days };
}
