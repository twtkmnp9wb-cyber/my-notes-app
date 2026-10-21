import { store, uid, normalize, seasonName, SEASON_KINDS } from './store.js';
import {
    view, esc, feedCounts,
    renderFeedHeader, renderFeed, renderRoadmap, renderSprint,
    renderBacklogChips, renderBacklog, renderDump, renderSettings, renderForm,
    renderAttList, renderViewer, visualOf,
} from './ui.js';
import { media, kindOf, measure } from './media.js';
import { WallpaperService } from './wallpaper.js';

const $ = (sel) => document.querySelector(sel);

// Что показываем: живое состояние или снимок архивного сезона (тогда всё только для чтения)
const S = () => (view.archive ? view.archive.state : store.state);
const RO = () => !!view.archive;

let currentForm = null;

// ================= РЕНДЕР =================
function render({ scrollToEnd = false, keepScroll = true } = {}) {
    const s = S();
    const ro = RO();
    const viewport = $('#scrollViewport');
    const prevScroll = viewport.scrollTop;
    // Во всех вкладках, кроме ленты, прокручиваются отдельные области [data-scroll] —
    // запоминаем их положение, чтобы отметка задачи не сбрасывала список наверх
    const prevInner = {};
    document.querySelectorAll('[data-scroll]').forEach((el) => { prevInner[el.dataset.scroll] = el.scrollTop; });

    document.body.dataset.season = s.season.kind;
    document.body.dataset.tab = view.tab;
    document.querySelectorAll('.menu-btn[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === view.tab));

    const banner = $('#archiveBanner');
    banner.hidden = !ro;
    if (ro) {
        banner.innerHTML = `<span>📦 Архив · ${esc(s.season.name)}</span><button data-act="exit-archive">Выйти</button>`;
    }

    $('#feedStickyHeader').classList.toggle('hidden', view.tab !== 'feed');
    $('#backlogStickyHeader').classList.toggle('hidden', view.tab !== 'backlog');
    if (view.tab === 'feed') $('#feedStickyHeader .page-sticky-header-inner').innerHTML = renderFeedHeader(s, ro);
    if (view.tab === 'backlog') $('#backlogChipsSlot').innerHTML = renderBacklogChips(s, ro);

    renderContent();

    $('#searchToggleBtn').hidden = view.tab !== 'feed';
    $('#addNoteBtn').hidden = ro || view.tab === 'dump';

    updateSearchCounter();
    updateChipFades();

    if (scrollToEnd) viewport.scrollTop = viewport.scrollHeight;
    else if (keepScroll) viewport.scrollTop = prevScroll;
    else viewport.scrollTop = 0;
    if (keepScroll) {
        document.querySelectorAll('[data-scroll]').forEach((el) => { el.scrollTop = prevInner[el.dataset.scroll] || 0; });
    }
}

function renderContent() {
    const s = S();
    const ro = RO();
    const renderers = { feed: renderFeed, roadmap: renderRoadmap, sprint: renderSprint, backlog: renderBacklog, dump: renderDump };
    $('.main-container').innerHTML = renderers[view.tab](s, ro);
    media.hydrate($('.main-container'));
}

// Затухание края ряда чипсов — только там, куда ещё можно прокрутить
function updateChipFades(root = document) {
    root.querySelectorAll('.chips-scroll').forEach((el) => {
        el.classList.toggle('fade-l', el.scrollLeft > 2);
        el.classList.toggle('fade-r', el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    });
}

function updateSearchCounter() {
    const el = $('#searchCounter');
    if (!el) return;
    const { shown, total } = feedCounts(S());
    el.textContent = view.search.trim() ? `${shown} из ${total}` : '';
}

function commit(opts) {
    store.save();
    render(opts);
}

function toast(message) {
    $('#appToast')?.remove();
    const el = document.createElement('div');
    el.id = 'appToast';
    el.className = 'toast';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
}

// ================= МОДАЛКИ =================
function openModal(id) {
    $(id).classList.add('active');
}

function closeModals() {
    document.querySelectorAll('.modal.active').forEach((m) => m.classList.remove('active'));
    currentForm = null;
}

function openForm(cfg) {
    closeModals();
    currentForm = cfg;
    $('#formModal .modal-content').innerHTML = renderForm(cfg);
    openModal('#formModal');
    const first = $('#formModal').querySelector('input:not([type=checkbox]), textarea');
    if (first && !matchMedia('(pointer: coarse)').matches) first.focus();
}

function readForm() {
    const form = $('#formEl');
    const values = {};
    for (const f of currentForm.fields) {
        if (f.type === 'attachments') continue;   // вложения живут в currentForm.atts, а не в полях формы
        if (f.type === 'chips') {
            values[f.name] = [...form.querySelectorAll(`[data-chips="${f.name}"] .chip.is-active`)].map((c) => c.dataset.value);
        } else if (f.type === 'checkbox') {
            values[f.name] = form.elements[f.name].checked;
        } else {
            values[f.name] = form.elements[f.name].value.trim();
        }
    }
    return values;
}

function openSettings() {
    $('#settingsModal .modal-content').innerHTML = renderSettings(store.state, store.loadArchive(), WallpaperService.has());
    openModal('#settingsModal');
}

const lines = (text) => text.split('\n').map((l) => l.trim()).filter(Boolean);
const cleanTag = (t) => t.replace(/^#/, '').trim().toLowerCase();
const categoryOptions = (s) => [{ value: '', label: 'Без категории' }, ...s.categories.map((c) => ({ value: c, label: c }))];
const defaultCategory = (s) => (view.backlogFilter !== 'all' ? view.backlogFilter : s.categories[0] || '');

// ================= ФОРМЫ СУЩНОСТЕЙ =================
function postForm(post) {
    const s = store.state;
    // Рабочий список вложений формы: сохранённые + только что выбранные (у них есть file и preview)
    const atts = (post?.attachments || []).map((a) => ({ ...a }));
    openForm({
        title: post ? 'Редактировать пост' : 'Новый пост',
        atts,
        fields: [
            { type: 'text', name: 'title', label: 'Заголовок', value: post?.title, placeholder: 'необязательно' },
            { type: 'textarea', name: 'text', label: 'Текст', value: post?.text, rows: 7, placeholder: 'Что происходит? #теги прямо в тексте тоже работают' },
            { type: 'attachments', name: 'atts', label: 'Вложения', value: atts },
            { type: 'chips', name: 'tags', label: 'Теги', options: s.tags, value: post?.tags },
        ],
        submitLabel: post ? 'Сохранить' : 'Опубликовать',
        onDelete: post && (() => {
            if (!confirm('Удалить пост?')) return false;
            s.posts = s.posts.filter((p) => p.id !== post.id);
            gcMedia();
        }),
        onSubmit: async (v) => {
            const list = currentForm.atts;
            if (!v.title && !v.text && !list.length) { toast('Пост пустой'); return false; }
            const fresh = list.filter((a) => a.file);
            if (fresh.length) toast(`Сохраняю ${fresh.length > 1 ? 'файлы' : 'файл'}…`);
            try {
                for (const a of fresh) await media.put(a.id, a.file);
            } catch (e) {
                console.error(e);
                alert('Не удалось сохранить файл: в браузере не хватает места.');
                return false;
            }
            list.forEach((a) => { if (a.preview) URL.revokeObjectURL(a.preview); });
            const attachments = list.map(({ id, name, type, size, kind, w, h }) => ({ id, name, type, size, kind, w, h }));
            if (post) {
                Object.assign(post, { title: v.title, text: v.text, tags: v.tags, attachments, editedAt: new Date().toISOString() });
                gcMedia();
            } else {
                s.posts.push({ id: uid(), title: v.title, text: v.text, tags: v.tags, attachments, createdAt: new Date().toISOString() });
                return { scrollToEnd: true };
            }
        },
    });
}

async function addFormFiles(files) {
    if (!currentForm?.atts) return;
    for (const file of files) {
        const kind = kindOf(file.type);
        const size = await measure(file);
        currentForm.atts.push({
            id: uid(), name: file.name || 'файл', type: file.type, size: file.size, kind, ...size, file,
            preview: kind === 'image' ? URL.createObjectURL(file) : null,
        });
    }
    refreshAttList();
}

function refreshAttList() {
    const el = $('#attList');
    if (!el) return;
    el.innerHTML = renderAttList(currentForm.atts);
    media.hydrate(el);
}

// Файлы, на которые не ссылается ни один пост ни в текущем сезоне, ни в архиве, удаляются из IndexedDB
function gcMedia() {
    const ids = new Set();
    const collect = (state) => (state?.posts || []).forEach((p) => (p.attachments || []).forEach((a) => ids.add(a.id)));
    collect(store.state);
    store.loadArchive().forEach((a) => collect(a.state));
    media.gc(ids).catch((e) => console.error(e));
}

// ================= ПРОСМОТРЩИК МЕДИА =================
let viewerState = null;

function openViewer(items, index) {
    viewerState = { items, index };
    drawViewer();
    $('#mediaViewer').hidden = false;
}

function drawViewer() {
    const el = $('#mediaViewer');
    el.innerHTML = renderViewer(viewerState.items, viewerState.index);
    media.hydrate(el);
}

function navViewer(dir) {
    if (!viewerState) return;
    const next = viewerState.index + dir;
    if (next < 0 || next >= viewerState.items.length) return;
    viewerState.index = next;
    drawViewer();
}

function closeViewer() {
    if (!viewerState) return false;
    viewerState = null;
    const el = $('#mediaViewer');
    el.hidden = true;
    el.innerHTML = '';   // заодно останавливает видео
    return true;
}

function goalForm(goal) {
    const s = store.state;
    openForm({
        title: goal ? 'Цель сезона' : 'Новая цель сезона',
        note: goal ? '' : 'Формулируй так, чтобы в конце сезона можно было ответить «да» или «нет».',
        fields: [{ type: 'text', name: 'text', label: 'Цель', value: goal?.text, placeholder: 'Подтягиваться 15 раз' }],
        onDelete: goal && (() => { s.goals = s.goals.filter((g) => g.id !== goal.id); }),
        onSubmit: (v) => {
            if (!v.text) return false;
            if (goal) goal.text = v.text;
            else s.goals.push({ id: uid(), text: v.text, done: false });
        },
    });
}

function taskForm(task) {
    const s = store.state;
    openForm({
        title: task ? 'Задача спринта' : 'Задача на сегодня',
        fields: [{ type: 'text', name: 'text', label: 'Что сделать', value: task?.text }],
        onDelete: task && (() => { s.sprint = s.sprint.filter((t) => t.id !== task.id); }),
        onSubmit: (v) => {
            if (!v.text) return false;
            if (task) task.text = v.text;
            else s.sprint.push({ id: uid(), text: v.text, done: false, strikes: 0, source: null });
        },
    });
}

function backlogNewForm(kind = 'card') {
    const s = store.state;
    openForm({
        title: 'Добавить в Backlog',
        fields: [
            { type: 'select', name: 'kind', label: 'Тип', value: kind, options: [
                { value: 'card', label: 'Карточка — крупная задача с подпунктами' },
                { value: 'row', label: 'Строчка — простая задача' },
            ] },
            { type: 'text', name: 'title', label: 'Название' },
            { type: 'select', name: 'category', label: 'Категория', value: defaultCategory(s), options: categoryOptions(s) },
            { type: 'date', name: 'due', label: 'Дедлайн (можно пусто)' },
            { type: 'textarea', name: 'subs', label: 'Подпункты — только для карточки, по одному на строку', rows: 4 },
        ],
        submitLabel: 'Добавить',
        onSubmit: (v) => {
            if (!v.title) { toast('Нужно название'); return false; }
            if (v.kind === 'row') {
                s.rows.push({ id: uid(), title: v.title, category: v.category, due: v.due });
            } else {
                s.cards.push({
                    id: uid(), title: v.title, category: v.category, due: v.due,
                    subtasks: lines(v.subs).map((text) => ({ id: uid(), text, done: false })),
                });
            }
        },
    });
}

function cardForm(card) {
    const s = store.state;
    openForm({
        title: 'Карточка',
        note: 'Подпункты — по одному на строку. Отметки «выполнено» сохраняются у строк с тем же текстом.',
        fields: [
            { type: 'text', name: 'title', label: 'Название', value: card.title },
            { type: 'select', name: 'category', label: 'Категория', value: card.category, options: categoryOptions(s) },
            { type: 'date', name: 'due', label: 'Дедлайн', value: card.due },
            { type: 'textarea', name: 'subs', label: 'Подпункты', value: card.subtasks.map((st) => st.text).join('\n'), rows: 6 },
        ],
        deleteLabel: 'Удалить карточку',
        onDelete: () => {
            if (!confirm(`Удалить карточку «${card.title}»?`)) return false;
            s.cards = s.cards.filter((c) => c.id !== card.id);
            s.sprint.forEach((t) => { if (t.source?.cardId === card.id) t.source = null; });
            view.flipped.delete(card.id);
        },
        onSubmit: (v) => {
            if (!v.title) return false;
            const old = card.subtasks;
            const kept = new Set();
            card.subtasks = lines(v.subs).map((text) => {
                const prev = old.find((st) => st.text === text && !kept.has(st.id));
                if (prev) { kept.add(prev.id); return prev; }
                return { id: uid(), text, done: false };
            });
            s.sprint.forEach((t) => {
                if (t.source?.kind === 'sub' && t.source.cardId === card.id && !kept.has(t.source.id)) t.source = null;
            });
            Object.assign(card, { title: v.title, category: v.category, due: v.due });
        },
    });
}

function rowForm(row) {
    const s = store.state;
    openForm({
        title: 'Строчка',
        fields: [
            { type: 'text', name: 'title', label: 'Задача', value: row.title },
            { type: 'select', name: 'category', label: 'Категория', value: row.category, options: categoryOptions(s) },
            { type: 'date', name: 'due', label: 'Дедлайн', value: row.due },
        ],
        onDelete: () => {
            s.rows = s.rows.filter((r) => r.id !== row.id);
            s.sprint.forEach((t) => { if (t.source?.kind === 'row' && t.source.id === row.id) t.source = null; });
        },
        onSubmit: (v) => {
            if (!v.title) return false;
            Object.assign(row, { title: v.title, category: v.category, due: v.due });
            s.sprint.forEach((t) => { if (t.source?.kind === 'row' && t.source.id === row.id && !t.done) t.text = v.title; });
        },
    });
}

function categoriesForm() {
    const s = store.state;
    openForm({
        title: 'Категории',
        note: 'Очисти поле, чтобы удалить категорию. Её задачи останутся во вкладке «Все».',
        fields: s.categories.map((c, i) => ({ type: 'text', name: `c${i}`, value: c })),
        onSubmit: (v) => {
            const next = [];
            s.categories.forEach((old, i) => {
                const name = v[`c${i}`];
                [...s.cards, ...s.rows].forEach((x) => { if (x.category === old) x.category = name; });
                if (view.backlogFilter === old) view.backlogFilter = name || 'all';
                if (name && !next.includes(name)) next.push(name);
            });
            s.categories = next;
        },
    });
}

function seasonForm() {
    const s = store.state;
    openForm({
        title: 'Текущий сезон',
        fields: [
            { type: 'text', name: 'name', label: 'Название', value: s.season.name },
            { type: 'select', name: 'kind', label: 'Тип сезона', value: s.season.kind,
                options: Object.entries(SEASON_KINDS).map(([value, label]) => ({ value, label })) },
        ],
        onSubmit: (v) => {
            s.season.kind = Number(v.kind);
            s.season.name = v.name || seasonName(s.season.kind);
            return { reopenSettings: true };
        },
    });
}

function closeSeasonForm() {
    const s = store.state;
    const nextKind = (s.season.kind % 4) + 1;
    openForm({
        title: 'Закрыть сезон',
        note: `«${s.season.name}» целиком уйдёт в архив — его можно будет открыть и полистать. Лента, цели, спринт и Dump начнутся с чистого листа.`,
        fields: [
            { type: 'text', name: 'name', label: 'Новый сезон', value: seasonName(nextKind) },
            { type: 'select', name: 'kind', label: 'Тип', value: nextKind,
                options: Object.entries(SEASON_KINDS).map(([value, label]) => ({ value, label })) },
            { type: 'checkbox', name: 'carry', label: 'Перенести незакрытые задачи Backlog', value: true },
        ],
        submitLabel: 'Закрыть и начать новый',
        onSubmit: (v) => {
            if (!confirm('Точно закрыть сезон?')) return false;
            const kind = Number(v.kind);
            if (!store.closeSeason({ name: v.name || seasonName(kind), kind, carryBacklog: v.carry })) return false;
            view.tab = 'feed';
            view.archive = null;
            toast('Сезон в архиве. Новый старт ✨');
        },
    });
}

// ================= ДЕЙСТВИЯ =================
// Все клики идут через data-act. В архиве разрешены только действия из READONLY_OK.
const READONLY_OK = new Set([
    'tab', 'settings', 'search-toggle', 'search-close', 'search-tag', 'filter', 'flip', 'dump-sub',
    'exit-archive', 'close-modal', 'form-chip', 'form-delete', 'open-media', 'media-nav', 'media-close',
    'edit-season', 'close-season', 'open-archive', 'delete-archive', 'manage-tags', 'reset-wallpaper', 'export',
]);

const find = (list, id) => list.find((x) => x.id === id);

const actions = {
    tab({ tab }) {
        if (tab === 'settings') return openSettings();
        const was = view.tab;
        view.tab = tab;
        if (tab !== 'feed') { view.searchOpen = false; view.search = ''; }
        render({ scrollToEnd: tab === 'feed', keepScroll: tab === was });
    },
    settings: () => openSettings(),

    add() {
        const t = view.tab;
        if (t === 'feed') postForm();
        else if (t === 'roadmap') goalForm();
        else if (t === 'sprint') taskForm();
        else if (t === 'backlog') backlogNewForm();
    },

    // --- лента
    'search-toggle'() {
        view.searchOpen = !view.searchOpen;
        if (!view.searchOpen) view.search = '';
        render();
        if (view.searchOpen) $('#searchInput')?.focus();
    },
    'search-close'() {
        view.searchOpen = false;
        view.search = '';
        render({ scrollToEnd: true });
    },
    'search-tag'({ tag }) {
        const q = `#${tag}`;
        view.tab = 'feed';
        view.searchOpen = true;
        view.search = view.search === q ? '' : q;
        render({ keepScroll: false });
    },
    'edit-post'({ id }) { const p = find(S().posts, id); if (p) postForm(p); },
    'edit-manifest'() {
        const s = store.state;
        openForm({
            title: 'Манифест сезона',
            note: 'Направления, которые не превратишь в задачу, но важно держать перед глазами. По одному на строку.',
            fields: [{ type: 'textarea', name: 'words', value: s.manifest.join('\n'), rows: 5, placeholder: 'красота\nосанка\nфокус' }],
            onSubmit: (v) => { s.manifest = lines(v.words).map(cleanTag); },
        });
    },

    // --- roadmap
    'toggle-goal'({ id }) { const g = find(S().goals, id); if (g) { g.done = !g.done; commit(); } },
    'edit-goal'({ id }) { const g = find(S().goals, id); if (g) goalForm(g); },

    // --- sprint
    'toggle-task'({ id }) {
        const s = S();
        const t = find(s.sprint, id);
        if (!t) return;
        t.done = !t.done;
        if (t.source?.kind === 'sub') {
            const sub = find(find(s.cards, t.source.cardId)?.subtasks || [], t.source.id);
            if (sub) sub.done = t.done;
        }
        commit();
    },
    'edit-task'({ id }) { const t = find(S().sprint, id); if (t) taskForm(t); },

    // --- backlog
    filter({ cat }) { view.backlogFilter = cat; render({ keepScroll: false }); },
    flip({ id }) {
        if (view.flipped.has(id)) view.flipped.delete(id); else view.flipped.add(id);
        $(`.flip[data-id="${id}"]`)?.classList.toggle('is-flipped');
    },
    'toggle-sub'({ card, id }) {
        const s = S();
        const sub = find(find(s.cards, card)?.subtasks || [], id);
        if (!sub) return;
        sub.done = !sub.done;
        s.sprint.forEach((t) => { if (t.source?.kind === 'sub' && t.source.id === id) t.done = sub.done; });
        commit();
    },
    'sub-to-sprint'({ card, id }) {
        const s = S();
        const sub = find(find(s.cards, card)?.subtasks || [], id);
        if (!sub) return;
        s.sprint.push({ id: uid(), text: sub.text, done: false, strikes: 0, source: { kind: 'sub', cardId: card, id } });
        toast('🚀 Подпункт отправлен в спринт');
        commit();
    },
    'row-to-sprint'({ id }) {
        const s = S();
        const r = find(s.rows, id);
        if (!r) return;
        s.sprint.push({ id: uid(), text: r.title, done: false, strikes: 0, source: { kind: 'row', id } });
        toast('🚀 Задача отправлена в спринт');
        commit();
    },
    'add-sub'({ id }) {
        const card = find(S().cards, id);
        if (!card) return;
        openForm({
            title: `Подпункт · ${card.title}`,
            fields: [{ type: 'text', name: 'text', label: 'Что сделать' }],
            submitLabel: 'Добавить',
            onSubmit: (v) => {
                if (!v.text) return false;
                card.subtasks.push({ id: uid(), text: v.text, done: false });
            },
        });
    },
    'edit-card'({ id }) { const c = find(S().cards, id); if (c) cardForm(c); },
    'add-row'() { backlogNewForm('row'); },
    'edit-row'({ id }) { const r = find(S().rows, id); if (r) rowForm(r); },
    'add-category'() {
        const s = store.state;
        openForm({
            title: 'Новая категория',
            fields: [{ type: 'text', name: 'name', label: 'Название', placeholder: 'Музыка' }],
            submitLabel: 'Добавить',
            onSubmit: (v) => {
                if (!v.name) return false;
                if (!s.categories.includes(v.name)) s.categories.push(v.name);
                view.backlogFilter = v.name;
            },
        });
    },
    'manage-categories': () => categoriesForm(),

    // --- dump
    'dump-sub'({ sub }) { view.dumpSub = sub; render({ keepScroll: false }); },
    'dump-save'() {
        const text = $('#dumpInput')?.value.trim();
        if (!text) return;
        S().dump.push({ id: uid(), text, createdAt: new Date().toISOString() });
        view.dumpDraft = '';
        toast('Выгружено. Можно спать 🌙');
        commit({ keepScroll: false });
    },
    'dump-to-feed'({ id }) {
        const s = S();
        const d = find(s.dump, id);
        if (!d) return;
        // Пост встаёт в ленту с исходным временем мысли — так видно, что думал в тот момент
        s.posts.push({ id: uid(), title: '', text: d.text, tags: [], createdAt: d.createdAt });
        s.dump = s.dump.filter((x) => x.id !== id);
        toast('✨ Сохранено в ленту');
        commit();
    },
    'dump-delete'({ id }) { S().dump = S().dump.filter((x) => x.id !== id); commit(); },
    'failed-to-backlog'({ id }) {
        const s = S();
        const f = find(s.failed, id);
        if (!f) return;
        const src = f.source;
        const stillThere = (src?.kind === 'row' && find(s.rows, src.id))
            || (src?.kind === 'sub' && find(find(s.cards, src.cardId)?.subtasks || [], src.id));
        if (!stillThere) s.rows.push({ id: uid(), title: f.text, category: s.categories[0] || '', due: '' });
        s.failed = s.failed.filter((x) => x.id !== id);
        toast('Вернул в бэклог');
        commit();
    },
    'failed-delete'({ id }) { S().failed = S().failed.filter((x) => x.id !== id); commit(); },
    'failed-clear'() {
        if (!confirm('Выбросить все невыполненные задачи?')) return;
        S().failed = [];
        commit();
    },

    // --- настройки / сезоны / архив
    'reset-wallpaper'() { WallpaperService.reset(); openSettings(); },
    'edit-season': () => seasonForm(),
    'close-season': () => closeSeasonForm(),
    'open-archive'({ id }) {
        const entry = store.loadArchive().find((a) => a.id === id);
        if (!entry) return;
        view.archive = { entry, state: normalize(entry.state) };
        view.tab = 'feed';
        view.search = '';
        view.searchOpen = false;
        closeModals();
        render({ scrollToEnd: true });
    },
    'exit-archive'() {
        view.archive = null;
        view.search = '';
        view.searchOpen = false;
        render({ scrollToEnd: view.tab === 'feed' });
    },
    'delete-archive'({ id }) {
        const list = store.loadArchive();
        const entry = list.find((a) => a.id === id);
        if (!entry || !confirm(`Удалить архив «${entry.state.season?.name}» навсегда?`)) return;
        store.saveArchive(list.filter((a) => a.id !== id));
        if (view.archive?.entry.id === id) view.archive = null;
        gcMedia();
        openSettings();
        render();
    },
    'manage-tags'() {
        const s = store.state;
        openForm({
            title: 'Теги ленты',
            note: 'Регламент тегов: по одному на строку. Эти теги предлагаются при создании поста.',
            fields: [{ type: 'textarea', name: 'tags', value: s.tags.join('\n'), rows: 8 }],
            onSubmit: (v) => {
                s.tags = [...new Set(lines(v.tags).map(cleanTag).filter(Boolean))];
                return { reopenSettings: true };
            },
        });
    },
    export() {
        const data = { app: 'monitor-dushi', exportedAt: new Date().toISOString(), state: store.state, archive: store.loadArchive() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `monitor-dushi-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },

    // --- формы
    'close-modal': () => closeModals(),
    'form-chip'(_, el) { el.classList.toggle('is-active'); },
    'att-remove'({ id }) {
        const a = currentForm?.atts?.find((x) => x.id === id);
        if (!a) return;
        if (a.preview) URL.revokeObjectURL(a.preview);
        currentForm.atts = currentForm.atts.filter((x) => x.id !== id);
        refreshAttList();
    },

    // --- просмотр медиа
    'open-media'({ post, id }) {
        const p = find(S().posts, post);
        if (!p) return;
        const items = visualOf(p);
        openViewer(items, Math.max(0, items.findIndex((a) => a.id === id)));
    },
    'media-nav'({ dir }) { navViewer(Number(dir)); },
    'media-close'(_, el, e) {
        // Клик по самой картинке/видео не закрывает просмотр — только по фону и крестику
        if (e.target.closest('.viewer-stage img, .viewer-stage video')) return;
        closeViewer();
    },
    'form-delete'() {
        if (!currentForm?.onDelete) return;
        if (currentForm.onDelete() === false) return;
        closeModals();
        commit();
    },
};

async function submitCurrentForm() {
    if (!currentForm || currentForm.busy) return;
    const form = currentForm;
    form.busy = true;   // сохранение файлов асинхронное — защищаемся от двойного нажатия
    const result = await form.onSubmit(readForm());
    form.busy = false;
    if (result === false || currentForm !== form) return;
    closeModals();
    commit(result || {});
    if (result?.reopenSettings) openSettings();
}

// ================= ИНИЦИАЛИЗАЦИЯ =================
document.addEventListener('DOMContentLoaded', () => {
    store.load();
    WallpaperService.apply();

    document.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal && e.target === modal) { closeModals(); return; }

        const el = e.target.closest('[data-act]');
        if (!el || el.disabled) return;
        const fn = actions[el.dataset.act];
        if (!fn) return;
        if (RO() && !READONLY_OK.has(el.dataset.act) && !el.closest('#settingsModal')) {
            toast('Это архив — только просмотр');
            return;
        }
        fn(el.dataset, el, e);
    });

    document.addEventListener('submit', (e) => {
        if (e.target.id !== 'formEl') return;
        e.preventDefault();
        submitCurrentForm();
    });

    document.addEventListener('keydown', (e) => {
        if (viewerState) {
            if (e.key === 'Escape') closeViewer();
            if (e.key === 'ArrowLeft') navViewer(-1);
            if (e.key === 'ArrowRight') navViewer(1);
            return;
        }
        if (e.key === 'Escape') closeModals();
        // Cmd/Ctrl+Enter — отправить форму или выгрузить Dump
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            if (currentForm) submitCurrentForm();
            else if (e.target.id === 'dumpInput') actions['dump-save']();
        }
    });

    // Свайп влево/вправо в просмотрщике листает фото и видео
    let touchX = null;
    $('#mediaViewer').addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    $('#mediaViewer').addEventListener('touchend', (e) => {
        if (touchX === null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        touchX = null;
        if (Math.abs(dx) > 50) navViewer(dx < 0 ? 1 : -1);
    });

    // scroll не всплывает, поэтому ловим на фазе перехвата
    document.addEventListener('scroll', (e) => {
        if (e.target.classList?.contains('chips-scroll')) updateChipFades(e.target.parentElement);
    }, true);
    window.addEventListener('resize', () => updateChipFades());

    document.addEventListener('input', (e) => {
        if (e.target.id === 'searchInput') {
            view.search = e.target.value;
            renderContent();
            updateSearchCounter();
        } else if (e.target.id === 'dumpInput') {
            view.dumpDraft = e.target.value;
        }
    });

    document.addEventListener('change', async (e) => {
        if (e.target.id === 'attInput' && e.target.files.length) {
            await addFormFiles([...e.target.files]);
            e.target.value = '';
        }
        if (e.target.id === 'bgFileInput' && e.target.files[0]) {
            try {
                await WallpaperService.setFromFile(e.target.files[0]);
                toast('Обои обновлены');
                openSettings();
            } catch (err) {
                alert(err.message);
            }
        }
        if (e.target.id === 'importInput' && e.target.files[0]) {
            try {
                const data = JSON.parse(await e.target.files[0].text());
                if (!data.state) throw new Error('bad file');
                if (!confirm('Заменить текущие данные данными из файла?')) return;
                store.replace(data.state);
                if (Array.isArray(data.archive)) store.saveArchive(data.archive);
                view.archive = null;
                closeModals();
                render({ scrollToEnd: true });
                toast('Данные восстановлены');
            } catch {
                alert('Не получилось прочитать файл резервной копии');
            }
        }
    });

    // Пересменка дня может случиться, пока вкладка открыта или висит в фоне
    const checkRollover = () => {
        if (store.rollover()) { store.save(); if (!RO()) render(); }
    };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkRollover(); });
    setInterval(checkRollover, 60000);

    render({ scrollToEnd: true });
});

