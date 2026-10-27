import { logicalDayKey, daysBetween, addDays, DAY_START_HOUR } from './dates.js';

// Всё состояние приложения — один объект под одним ключом. Архив сезонов лежит отдельно.
const STATE_KEY = 'mdusha_state_v1';
const ARCHIVE_KEY = 'mdusha_archive_v1';

export const DUMP_TTL_DAYS = 3;   // мысли из Dump живут 3 логических дня
export const STRIKE_LIMIT = 3;    // столько ночей подряд задача может висеть в спринте невыполненной
export const EVENING_HOUR = 18;   // с этого часа задачи в спринт планируются уже на завтра

// На какой день задача попадает в спринт. Вечером (с 18:00 до утренней пересменки) — на завтра:
// так спринт планируется перед сном, и ночная пересменка не считает эти задачи просроченными.
export function sprintDayFor(date = new Date()) {
    const h = date.getHours();
    const today = logicalDayKey(date);
    return h >= EVENING_HOUR || h < DAY_START_HOUR ? addDays(today, 1) : today;
}

export const SEASON_KINDS = {
    1: 'Семестр I',
    2: 'Зимние каникулы',
    3: 'Семестр II',
    4: 'Лето',
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Сезон по дате — только подсказка по умолчанию, реально сезон закрывается вручную в настройках.
export function guessSeasonKind(date = new Date()) {
    const m = date.getMonth() + 1;
    const d = date.getDate();
    if (m >= 9 && (m < 12 || d < 25)) return 1;
    if (m === 12 || m === 1 || (m === 2 && d <= 8)) return 2;
    if (m <= 6) return 3;
    return 4;
}

// Учебный год: с сентября по август, поэтому «Семестр II · 2026/27» — это весна 2027.
export function seasonName(kind, date = new Date()) {
    const y = date.getFullYear();
    const start = date.getMonth() + 1 >= 9 ? y : y - 1;
    return `${SEASON_KINDS[kind]} · ${start}/${String(start + 1).slice(2)}`;
}

export function makeSeason(kind = guessSeasonKind(), name = seasonName(kind)) {
    return { kind, name, startedAt: new Date().toISOString() };
}

export function cardProgress(card) {
    const total = card.subtasks.length;
    const done = card.subtasks.filter((s) => s.done).length;
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export const isCardDone = (card) => card.subtasks.length > 0 && card.subtasks.every((s) => s.done);

// Счётчики целей Roadmap: каждое выполненное дело пишется в журнал с категорией, отмена — убирает запись.
// Ключ — id того, что выполнено (строчки, подпункта, задачи спринта, «card:<id>» за закрытую карточку),
// поэтому одно и то же дело не посчитается дважды, с какой бы вкладки его ни отметили.
export function logDone(s, id, category, done) {
    s.doneLog = s.doneLog.filter((e) => e.id !== id);
    if (done && category) s.doneLog.push({ id, category, at: logicalDayKey() });
}

export const doneCount = (s, category) => s.doneLog.filter((e) => e.category === category).length;

function emptyState(season = makeSeason()) {
    return {
        version: 1,
        season,
        posts: [],      // { id, title, text, tags[], attachments[], createdAt, editedAt? } — сами файлы в IndexedDB (media.js)
        manifest: [],   // тейки сезона: «красота», «осанка»...
        tags: ['мысли', 'учёба', 'спорт', 'музыка'],  // регламент тегов ленты
        goals: [],      // Roadmap: { id, text, done }
        sprint: [],     // { id, text, done, plannedFor, strikes, source: {kind:'row', id} | {kind:'sub', cardId, id} | null }
        categories: ['Учёба', 'Проекты', 'Быт'],
        cards: [],      // { id, title, category, due, subtasks: [{ id, text, done }] }
        rows: [],       // { id, title, category, due }
        dump: [],       // { id, text, createdAt }
        failed: [],     // задачи, провисевшие в спринте STRIKE_LIMIT дней: { id, text, source, failedOn }
        doneLog: [],    // журнал выполненного за сезон для счётчиков Roadmap: { id, category, at }
        lastRollover: logicalDayKey(),
    };
}

export function normalize(s) {
    const base = emptyState(s?.season || makeSeason());
    const out = { ...base, ...s };
    for (const k of Object.keys(base)) {
        if (Array.isArray(base[k]) && !Array.isArray(out[k])) out[k] = base[k];
    }
    out.cards.forEach((c) => { if (!Array.isArray(c.subtasks)) c.subtasks = []; });
    // Журнала не было до появления счётчиков — засеваем его тем, что уже отмечено в карточках
    if (!Array.isArray(s?.doneLog)) {
        const at = logicalDayKey();
        out.doneLog = [];
        for (const c of out.cards) {
            if (!c.category) continue;
            c.subtasks.filter((st) => st.done).forEach((st) => out.doneLog.push({ id: st.id, category: c.category, at }));
            if (isCardDone(c)) out.doneLog.push({ id: `card:${c.id}`, category: c.category, at });
        }
    }
    out.posts.forEach((p) => {
        if (!Array.isArray(p.tags)) p.tags = [];
        if (!Array.isArray(p.attachments)) p.attachments = [];
    });
    return out;
}

// ---------- Перенос данных из старой версии (ключи app_*) ----------
function readLegacy(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function migrateLegacy() {
    const notes = [...(readLegacy('app_notes') || []), ...(readLegacy('app_notes_and_tasks') || [])];
    const goals = readLegacy('app_roadmap_goals');
    const sprint = readLegacy('app_sprint_tasks');
    const cats = readLegacy('app_backlog_categories');
    const cards = readLegacy('app_backlog_custom_items');
    const rows = readLegacy('app_backlog_rows');
    const manifest = readLegacy('app_manifest_words');
    const dumpDays = readLegacy('app_dump_days_v2');
    if (!notes.length && !goals && !sprint && !cats && !cards && !rows && !manifest && !dumpDays) return null;

    const s = emptyState();
    const seen = new Set();
    for (const n of notes) {
        if (n.type !== 'feed' || seen.has(String(n.id))) continue;
        seen.add(String(n.id));
        const ts = Number(n.id);
        s.posts.push({
            id: String(n.id),
            title: n.title || '',
            text: n.text || '',
            tags: String(n.hashtag || '').split(/\s+/).map((t) => t.replace(/^#/, '').toLowerCase()).filter(Boolean),
            createdAt: new Date(Number.isFinite(ts) && ts > 1e12 ? ts : Date.now()).toISOString(),
        });
    }
    if (goals) s.goals = goals.map((g) => ({ id: String(g.id), text: g.text || '', done: !!g.done }));
    if (sprint) s.sprint = sprint.map((t) => ({ id: String(t.id), text: t.title || '', done: !!t.done, strikes: 0, source: null }));
    if (cats) s.categories = cats.filter((c) => c && c !== 'All');
    if (cards) s.cards = cards.map((c) => ({
        id: String(c.id), title: c.title || '', category: c.category || '', due: c.dueDate || '',
        subtasks: (c.subtasks || []).map((st) => ({ id: String(st.id), text: st.text || '', done: !!st.done })),
    }));
    if (rows) s.rows = rows.map((r) => ({ id: String(r.id), title: r.title || '', category: r.category || '', due: r.dueDate || '' }));
    if (manifest) s.manifest = manifest.filter(Boolean);
    if (dumpDays) {
        const now = new Date().toISOString();
        for (const day of Object.values(dumpDays)) {
            for (const n of day.notes || []) {
                s.dump.push({ id: uid(), text: [n.title, n.text].filter(Boolean).join('\n'), createdAt: now });
            }
        }
    }
    return s;
}

export const store = {
    state: null,
    onSave: null,   // ставит sync.js: после каждого сохранения запланировать отправку в облако

    load() {
        let s = null;
        try { s = JSON.parse(localStorage.getItem(STATE_KEY)); } catch { s = null; }
        this.state = normalize(s || migrateLegacy() || emptyState());
        this.rollover();
        this.save();
    },

    save() {
        try {
            localStorage.setItem(STATE_KEY, JSON.stringify(this.state));
            this.onSave?.();
            return true;
        } catch (e) {
            console.error(e);
            alert('Не удалось сохранить: память браузера переполнена. Сделай экспорт в настройках и удали лишнее (например, обои).');
            return false;
        }
    },

    replace(state) {
        this.state = normalize(state);
        this.rollover();
        this.save();
    },

    // Ночная пересменка. Выполненные задачи спринта уходят (а их строчки — из бэклога),
    // невыполненные получают «страйк» за каждую прошедшую ночь; на STRIKE_LIMIT — в Dump → Невыполненное.
    // Заодно чистим мысли Dump старше DUMP_TTL_DAYS. Возвращает true, если что-то поменялось.
    rollover() {
        const s = this.state;
        const today = logicalDayKey();
        let changed = false;

        const passed = daysBetween(s.lastRollover || today, today);
        if (passed > 0) {
            const keep = [];
            for (const t of s.sprint) {
                // Старые задачи без дня: восстанавливаем его по числу уже прошедших ночей
                if (!t.plannedFor) t.plannedFor = addDays(s.lastRollover || today, -(t.strikes || 0));
                const overdue = daysBetween(t.plannedFor, today);
                // Задача на сегодня или на будущее (запланирована вечером на завтра) — ночь её не касается
                if (overdue <= 0) { t.strikes = 0; keep.push(t); continue; }
                if (t.done) {
                    if (t.source?.kind === 'row') s.rows = s.rows.filter((r) => r.id !== t.source.id);
                    continue;
                }
                t.strikes = overdue;
                if (t.strikes >= STRIKE_LIMIT) {
                    s.failed.push({ id: t.id, text: t.text, source: t.source || null, failedOn: today });
                } else {
                    keep.push(t);
                }
            }
            s.sprint = keep;
            s.lastRollover = today;
            changed = true;
        }

        const before = s.dump.length;
        s.dump = s.dump.filter((d) => daysBetween(logicalDayKey(d.createdAt), today) < DUMP_TTL_DAYS);
        return changed || s.dump.length !== before;
    },

    loadArchive() {
        return readLegacy(ARCHIVE_KEY) || [];
    },

    saveArchive(list) {
        try {
            localStorage.setItem(ARCHIVE_KEY, JSON.stringify(list));
            this.onSave?.();
            return true;
        } catch (e) {
            console.error(e);
            alert('Архив не поместился в память браузера. Сделай экспорт и удали старые сезоны.');
            return false;
        }
    },

    // Закрыть сезон: снимок целиком уходит в архив, новый сезон стартует с чистой лентой,
    // целями и спринтом. Категории и теги переносятся всегда, незакрытый бэклог — по желанию.
    closeSeason({ name, kind, carryBacklog }) {
        const old = this.state;
        const archive = this.loadArchive();
        archive.unshift({ id: uid(), closedAt: new Date().toISOString(), state: old });
        if (!this.saveArchive(archive)) return false;

        const next = emptyState(makeSeason(kind, name));
        next.tags = [...old.tags];
        next.categories = [...old.categories];
        if (carryBacklog) {
            next.cards = old.cards.filter((c) => !isCardDone(c));
            next.rows = [...old.rows];
        }
        this.state = next;
        this.save();
        return true;
    },
};
