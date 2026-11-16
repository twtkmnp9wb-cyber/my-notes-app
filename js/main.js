import { store, uid, normalize, seasonName, SEASON_KINDS, sprintDayFor, logDone, isCardDone } from './store.js';
import {
    view, esc, searchMatches,
    renderFeedHeader, renderFeed, renderRoadmap, renderSprint,
    renderBacklogChips, renderBacklog, renderDump, renderSettings, renderForm,
    renderAttList, renderViewer, visualOf, renderSyncSection, cardHtml, markerChoice, freeColorKey, isTodayTask, renderManifest,
} from './ui.js';
import { initSync, syncStatus, syncNow, signIn, verifyCode, signOut, cancelSignIn, signInWithPassword, setPassword, setLoginMode } from './sync.js';
import { media, kindOf, measure } from './media.js';
import { logicalDayKey } from './dates.js';
import { compressImage, compressVideo } from './compress.js';
import { openScreenDebug } from './screen-debug.js';
import { WallpaperService, GlassService, PRESETS } from './wallpaper.js';

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
        banner.innerHTML = `<span>Archive · ${esc(s.season.name)}</span><button data-act="exit-archive">Exit</button>`;
    }

    // Карусели чипсов перерисовываются вместе с шапкой — запоминаем, где они были промотаны
    const feedChipsLeft = $('#feedStickyHeader .search-tags')?.scrollLeft || 0;
    const backlogChipsLeft = $('#backlogChipsSlot .chips-scroll')?.scrollLeft || 0;

    $('#feedStickyHeader').classList.toggle('hidden', view.tab !== 'feed');
    $('#backlogStickyHeader').classList.toggle('hidden', view.tab !== 'backlog');
    if (view.tab === 'feed') $('#feedStickyHeader .page-sticky-header-inner').innerHTML = renderFeedHeader(s, ro);
    if (view.tab === 'backlog') $('#backlogChipsSlot').innerHTML = renderBacklogChips(s, ro);

    const feedChips = $('#feedStickyHeader .search-tags');
    if (feedChips) feedChips.scrollLeft = feedChipsLeft;
    const backlogChips = $('#backlogChipsSlot .chips-scroll');
    if (backlogChips) backlogChips.scrollLeft = backlogChipsLeft;

    const sideM = $('#sideManifest');
    if (sideM) sideM.innerHTML = renderManifest(s, ro);
    renderContent();
    autosizeDump();

    $('#searchToggleBtn').hidden = view.tab !== 'feed';
    $('#addNoteBtn').hidden = ro || view.tab === 'dump';

    updateSearchCounter();
    updateChipFades();
    syncTopHeight();

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

// Поле Dump растёт по мере набора (до ~5 строк), а в покое занимает одну строку
function autosizeDump() {
    const el = $('#dumpInput');
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
}

// Поиск как в Telegram: лента остаётся целой, результаты подсвечены, «N of M» и стрелки листают их
function updateSearchCounter() {
    const el = $('#searchCounter');
    if (!el) return;
    const ids = searchMatches(S());
    if (view.search.trim()) {
        view.searchIdx = Math.min(Math.max(view.searchIdx, 0), Math.max(0, ids.length - 1));
        el.textContent = ids.length ? `${view.searchIdx + 1} of ${ids.length}` : '0';
    } else {
        el.textContent = '';
    }
    // «вверх» недоступна на самом старом результате, «вниз» — на самом свежем; по кругу не листаем
    document.querySelectorAll('[data-act="search-prev"]').forEach((b) => { b.disabled = view.searchIdx <= 0 || !ids.length; });
    document.querySelectorAll('[data-act="search-next"]').forEach((b) => { b.disabled = view.searchIdx >= ids.length - 1 || !ids.length; });
    document.querySelectorAll('.post.is-current').forEach((p) => p.classList.remove('is-current'));
    const cur = ids[view.searchIdx];
    if (cur) document.querySelector(`.post[data-pid="${cur}"]`)?.classList.add('is-current');
}

let scrollAnim = 0;
function scrollViewportTo(target, smooth) {
    const vp = $('#scrollViewport');
    cancelAnimationFrame(scrollAnim);
    if (!smooth) { vp.scrollTop = target; return; }
    const from = vp.scrollTop;
    const dist = target - from;
    const t0 = performance.now();
    const DUR = 220;
    const step = (now) => {
        const k = Math.min(1, (now - t0) / DUR);
        vp.scrollTop = from + dist * (1 - (1 - k) ** 3);   // easeOutCubic
        if (k < 1) scrollAnim = requestAnimationFrame(step);
    };
    scrollAnim = requestAnimationFrame(step);
}

function goToMatch(smooth = true) {
    updateSearchCounter();
    const id = searchMatches(S())[view.searchIdx];
    const el = id && document.querySelector(`.post[data-pid="${id}"]`);
    if (!el) return;
    // Центрируем пост в видимой области: ниже плавающей шапки и выше нижних кнопок
    const vp = $('#scrollViewport');
    const topH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top-h')) || 0;
    const r = el.getBoundingClientRect();
    const vr = vp.getBoundingClientRect();
    const visibleTop = vr.top + topH;
    const visibleH = vr.height - topH - 90;
    const delta = (r.top + r.height / 2) - (visibleTop + visibleH / 2);
    scrollViewportTo(vp.scrollTop + delta, smooth);
}

// Шапка и подшапка лежат поверх ленты (как в Telegram): сообщаем CSS их суммарную высоту
function syncTopHeight() {
    const h = [...document.querySelectorAll('.fixed-top-bar, .page-sticky-header')].reduce((sum, el) => sum + el.offsetHeight, 0);
    document.documentElement.style.setProperty('--top-h', `${h}px`);
}

// Новый тег прямо в форме поста
function addTagFromInput(input) {
    const name = input.value.trim().replace(/^#+/, '').toLowerCase().replace(/\s+/g, '-');
    input.value = '';
    if (!name) return;
    const wrap = input.closest('.chips-wrap');
    let chip = [...wrap.querySelectorAll('.chip')].find((c) => c.dataset.value === name);
    if (!chip) {
        chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.dataset.act = 'form-chip';
        chip.dataset.value = name;
        chip.textContent = `#${name}`;
        wrap.insertBefore(chip, input);
    }
    chip.classList.add('is-active');
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
    currentForm?.atts?.forEach((a) => { if (a.busy) a.abort?.abort(); });
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
            // Пароль не обрезаем: пробелы по краям — тоже его часть
            const raw = form.elements[f.name].value;
            values[f.name] = f.type === 'password' ? raw : raw.trim();
        }
    }
    return values;
}

function openSettings() {
    $('#settingsModal .modal-content').innerHTML = renderSettings(store.state, store.loadArchive(), WallpaperService.has(), syncStatus, mediaUsage(),
        { preset: WallpaperService.preset(), glass: GlassService.get(), learn: view.learn, presets: PRESETS });
    openModal('#settingsModal');
}

const lines = (text) => text.split('\n').map((l) => l.trim()).filter(Boolean);
const cleanTag = (t) => t.replace(/^#/, '').trim().toLowerCase();
const categoryOptions = (s) => [{ value: '', label: 'No category' }, ...s.categories.map((c) => ({ value: c, label: c }))];
const defaultCategory = (s) => (view.backlogFilter !== 'all' ? view.backlogFilter : s.categories[0] || '');

// ================= ФОРМЫ СУЩНОСТЕЙ =================
function postForm(post) {
    const s = store.state;
    // Рабочий список вложений формы: сохранённые + только что выбранные (у них есть file и preview)
    const atts = (post?.attachments || []).map((a) => ({ ...a }));
    openForm({
        title: post ? 'Edit post' : 'New post',
        atts,
        fields: [
            { type: 'text', name: 'title', label: 'Title', value: post?.title, placeholder: 'optional' },
            { type: 'textarea', name: 'text', label: 'Text', value: post?.text, rows: 7, placeholder: 'Write something… #tags work inline' },
            { type: 'attachments', name: 'atts', label: 'Attachments', value: atts },
            { type: 'chips', name: 'tags', label: 'Tags', options: s.tags, value: post?.tags },
        ],
        submitLabel: post ? 'Save' : 'Post',
        onDelete: post && (() => {
            if (!confirm('Delete post?')) return false;
            s.posts = s.posts.filter((p) => p.id !== post.id);
            gcMedia();
        }),
        onSubmit: async (v) => {
            const list = currentForm.atts;
            if (!v.title && !v.text && !list.length) { toast('Empty post'); return false; }
            if (list.some((a) => a.busy)) { toast('Still compressing files…'); return false; }
            const fresh = list.filter((a) => a.file);
            if (fresh.length) toast('Saving files…');
            try {
                for (const a of fresh) await media.put(a.id, a.file);
            } catch (e) {
                console.error(e);
                alert(`Couldn't save the file: ${/quota/i.test(e.name + e.message) ? 'not enough browser storage' : e.message}`);
                return false;
            }
            list.forEach((a) => { if (a.preview) URL.revokeObjectURL(a.preview); });
            const attachments = list.map(({ id, name, type, size, kind, w, h }) => ({ id, name, type, size, kind, w, h }));
            // Теги, созданные прямо в форме, попадают в общий список с неповторяющимся цветом
            (v.tags || []).forEach((tag) => {
                if (s.tags.includes(tag)) return;
                s.colors[`t:${tag}`] = freeColorKey(s, 't');
                s.tags.push(tag);
            });
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

// Файлы сразу появляются в форме, а сжатие идёт по очереди в фоне с прогрессом.
// Пока что-то сжимается, опубликовать пост нельзя (см. onSubmit в postForm).
async function addFormFiles(files) {
    const form = currentForm;
    if (!form?.atts) return;
    const added = files.map((file) => {
        const kind = kindOf(file.type);
        const a = {
            id: uid(), name: file.name || 'file', type: file.type, size: file.size, kind, file,
            preview: kind === 'image' ? URL.createObjectURL(file) : null,
            busy: kind === 'image' || kind === 'video', progress: 0, originalSize: file.size,
            abort: new AbortController(),
        };
        form.atts.push(a);
        return a;
    });
    refreshAttList();

    for (const a of added) {
        if (a.abort.signal.aborted) continue;
        let file = a.file;
        if (a.kind === 'image') {
            file = await compressImage(a.file);
        } else if (a.kind === 'video') {
            file = await compressVideo(a.file, {
                signal: a.abort.signal,
                onProgress: (p) => { a.progress = p; refreshAttListSoon(form); },
            });
        }
        if (a.abort.signal.aborted) continue;
        Object.assign(a, { file, name: file.name || a.name, type: file.type, size: file.size, busy: false });
        Object.assign(a, await measure(file));
        if (form === currentForm) refreshAttList();
    }
}

let attListTimer = null;
function refreshAttListSoon(form) {
    if (attListTimer || form !== currentForm) return;
    attListTimer = setTimeout(() => { attListTimer = null; if (form === currentForm) refreshAttList(); }, 250);
}

function refreshAttList() {
    const el = $('#attList');
    if (!el) return;
    el.innerHTML = renderAttList(currentForm.atts);
    media.hydrate(el);
}

// Сколько весят все вложения (текущий сезон + архив) — для индикатора места в облаке
function mediaUsage() {
    const sizes = new Map();
    const collect = (state) => (state?.posts || []).forEach((p) => (p.attachments || []).forEach((a) => sizes.set(a.id, a.size || 0)));
    collect(store.state);
    store.loadArchive().forEach((a) => collect(a.state));
    return [...sizes.values()].reduce((sum, n) => sum + n, 0);
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
        title: goal ? 'Goal' : 'New goal',
        note: 'Phrase it so that at the end of the season the answer is a clear yes or no. Counter: shows how many tasks of the chosen category you completed this season.',
        fields: [
            { type: 'text', name: 'text', label: 'Goal', value: goal?.text, placeholder: 'Do 15 pull-ups' },
            { type: 'select', name: 'category', label: 'Counter',
                value: goal?.category || '', options: [{ value: '', label: 'No counter' }, ...s.categories.map((c) => ({ value: c, label: c }))] },
        ],
        onDelete: goal && (() => { s.goals = s.goals.filter((g) => g.id !== goal.id); }),
        onSubmit: (v) => {
            if (!v.text) return false;
            if (goal) Object.assign(goal, { text: v.text, category: v.category });
            else { s.goals.push({ id: uid(), text: v.text, category: v.category, done: false }); s.roadmapClosedAt = ''; }
        },
    });
}

function taskForm(task) {
    const s = store.state;
    openForm({
        title: task ? 'Sprint task' : 'New sprint task',
        fields: [{ type: 'text', name: 'text', label: 'Task', value: task?.text }],
        onDelete: task && (() => { s.sprint = s.sprint.filter((t) => t.id !== task.id); }),
        onSubmit: (v) => {
            if (!v.text) return false;
            if (task) task.text = v.text;
            else s.sprint.push({ id: uid(), text: v.text, done: false, plannedFor: sprintDayFor(), strikes: 0, source: null });
        },
    });
}

// Записать/снять отметку задачи спринта в журнале выполненного (счётчики целей Roadmap)
function logTaskDone(s, t) {
    if (t.source?.kind === 'row') {
        logDone(s, t.source.id, find(s.rows, t.source.id)?.category || t.category, t.done);
    } else if (t.source?.kind === 'sub') {
        const card = find(s.cards, t.source.cardId);
        logDone(s, t.source.id, card?.category, t.done);
        if (card) logDone(s, `card:${card.id}`, card.category, isCardDone(card));
    } else {
        logDone(s, t.id, t.category, t.done);
    }
}

function backlogNewForm(kind = 'card') {
    const s = store.state;
    openForm({
        title: 'Add to Backlog',
        fields: [
            { type: 'select', name: 'kind', label: 'Type', value: kind, options: [
                { value: 'card', label: 'Card' },
                { value: 'row', label: 'Task' },
            ] },
            { type: 'text', name: 'title', label: 'Title' },
            { type: 'select', name: 'category', label: 'Category', value: defaultCategory(s), options: categoryOptions(s) },
            { type: 'date', name: 'due', label: 'Deadline' },
            { type: 'textarea', name: 'note', label: 'Comment (tasks only)', rows: 3 },
            { type: 'textarea', name: 'subs', label: 'Subtasks (cards only, one per line)', rows: 4 },
        ],
        submitLabel: 'Add',
        onSubmit: (v) => {
            if (!v.title) { toast('Title required'); return false; }
            if (v.kind === 'row') {
                s.rows.push({ id: uid(), title: v.title, note: v.note, category: v.category, due: v.due });
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
        title: 'Card',
        note: 'Subtasks: one per line. Done marks are kept for lines with the same text.',
        fields: [
            { type: 'text', name: 'title', label: 'Title', value: card.title },
            { type: 'select', name: 'category', label: 'Category', value: card.category, options: categoryOptions(s) },
            { type: 'date', name: 'due', label: 'Deadline', value: card.due },
            { type: 'textarea', name: 'subs', label: 'Subtasks', value: card.subtasks.map((st) => st.text).join('\n'), rows: 6 },
        ],
        deleteLabel: 'Delete card',
        onDelete: () => {
            if (!confirm(`Delete card “${card.title}”?`)) return false;
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
            // Сделанное по карточке переезжает в счётчик новой категории
            const ids = new Set([`card:${card.id}`, ...card.subtasks.map((st) => st.id)]);
            s.doneLog.forEach((e) => { if (ids.has(e.id)) e.category = v.category; });
            Object.assign(card, { title: v.title, category: v.category, due: v.due });
        },
    });
}

function rowForm(row) {
    const s = store.state;
    openForm({
        title: 'Task',
        fields: [
            { type: 'text', name: 'title', label: 'Task', value: row.title },
            { type: 'select', name: 'category', label: 'Category', value: row.category, options: categoryOptions(s) },
            { type: 'date', name: 'due', label: 'Deadline', value: row.due },
            { type: 'textarea', name: 'note', label: 'Comment', value: row.note, rows: 3 },
        ],
        onDelete: () => {
            s.rows = s.rows.filter((r) => r.id !== row.id);
            s.sprint.forEach((t) => { if (t.source?.kind === 'row' && t.source.id === row.id) t.source = null; });
        },
        onSubmit: (v) => {
            if (!v.title) return false;
            s.doneLog.forEach((e) => { if (e.id === row.id) e.category = v.category; });
            Object.assign(row, { title: v.title, note: v.note, category: v.category, due: v.due });
            s.sprint.forEach((t) => { if (t.source?.kind === 'row' && t.source.id === row.id && !t.done) t.text = v.title; });
        },
    });
}

function categoriesForm() {
    const s = store.state;
    openForm({
        title: 'Categories',
        note: 'Clear a field to delete the category; its tasks stay under All. The circles below a name set its marker color. The last row adds a new category.',
        fields: [
            ...s.categories.flatMap((c, i) => [
                { type: 'text', name: `c${i}`, value: c },
                { type: 'swatches', name: `k${i}`, value: markerChoice(s, 'c', c) },
            ]),
            { type: 'text', name: 'cNew', placeholder: 'New category' },
            { type: 'swatches', name: 'kNew', value: freeColorKey(s, 'c') },
        ],
        onSubmit: (v) => {
            const next = [];
            const colors = {};
            s.categories.forEach((old, i) => {
                const name = v[`c${i}`];
                [...s.cards, ...s.rows, ...s.sprint, ...s.goals, ...s.doneLog].forEach((x) => { if (x.category === old) x.category = name; });
                if (view.backlogFilter === old) view.backlogFilter = name || 'all';
                if (name && !next.includes(name)) { next.push(name); colors[`c:${name}`] = v[`k${i}`]; }
            });
            if (v.cNew && !next.includes(v.cNew)) { next.push(v.cNew); colors[`c:${v.cNew}`] = v.kNew; }
            s.categories = next;
            // Цвета категорий пересобираем заново: переименованные и удалённые не оставляют мусора
            Object.keys(s.colors).filter((k) => k.startsWith('c:')).forEach((k) => delete s.colors[k]);
            Object.assign(s.colors, colors);
        },
    });
}

function seasonForm() {
    const s = store.state;
    openForm({
        title: 'Season',
        fields: [
            { type: 'text', name: 'name', label: 'Name', value: s.season.name },
            { type: 'select', name: 'kind', label: 'Type', value: s.season.kind,
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
        title: 'Close season',
        note: `“${s.season.name}” moves to the archive as a whole and can be opened later. Library, goals, sprint and dump start from scratch.`,
        fields: [
            { type: 'text', name: 'name', label: 'Next season', value: seasonName(nextKind) },
            { type: 'select', name: 'kind', label: 'Type', value: nextKind,
                options: Object.entries(SEASON_KINDS).map(([value, label]) => ({ value, label })) },
            { type: 'checkbox', name: 'carry', label: 'Carry over open backlog', value: true },
        ],
        submitLabel: 'Close & start new',
        onSubmit: (v) => {
            if (!confirm('Close the season?')) return false;
            const kind = Number(v.kind);
            if (!store.closeSeason({ name: v.name || seasonName(kind), kind, carryBacklog: v.carry })) return false;
            view.tab = 'feed';
            view.archive = null;
            toast('Season archived');
        },
    });
}

// ================= ДЕЙСТВИЯ =================
// Все клики идут через data-act. В архиве разрешены только действия из READONLY_OK.
const READONLY_OK = new Set([
    'tab', 'settings', 'search-toggle', 'search-close', 'search-tag', 'search-prev', 'search-next', 'filter', 'flip', 'dump-sub',
    'exit-archive', 'close-modal', 'form-chip', 'form-swatch', 'stash-toggle', 'form-delete', 'open-media', 'media-nav', 'media-close',
    'edit-season', 'close-season', 'open-archive', 'delete-archive', 'manage-tags', 'reset-wallpaper', 'export',
    'toggle-note', 'toggle-learn', 'bg-preset', 'glass-set',
]);

const find = (list, id) => list.find((x) => x.id === id);

// Перерисовываем одну карточку на месте, а не весь Backlog: иначе список подпунктов на обороте
// прыгал в начало после каждой отметки, а завершённая карточка тут же уезжала в конец сетки.
function refreshCard(card) {
    const old = $(`.flip[data-id="${card.id}"]`);
    if (!old) { render(); return; }
    const scrollTop = old.querySelector('.subs')?.scrollTop || 0;
    const tmp = document.createElement('div');
    tmp.innerHTML = cardHtml(S(), card, RO()).trim();
    const fresh = tmp.firstElementChild;
    old.replaceWith(fresh);
    const subs = fresh.querySelector('.subs');
    if (subs) subs.scrollTop = scrollTop;
}

// Красные бейджи на чипсах считают «горящие» незакрытые карточки — обновляем, когда карточка закрылась или открылась
function refreshBacklogChips() {
    const slot = $('#backlogChipsSlot');
    const scroller = slot.querySelector('.chips-scroll');
    const left = scroller?.scrollLeft || 0;
    slot.innerHTML = renderBacklogChips(S(), RO());
    const next = slot.querySelector('.chips-scroll');
    if (next) next.scrollLeft = left;
    updateChipFades(slot);
}

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
    'search-prev'() {
        const n = searchMatches(S()).length;
        if (!n) return;
        if (view.searchIdx <= 0) return;
        view.searchIdx -= 1;
        goToMatch();
    },
    'search-next'() {
        const n = searchMatches(S()).length;
        if (!n) return;
        if (view.searchIdx >= n - 1) return;
        view.searchIdx += 1;
        goToMatch();
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
        view.searchIdx = Infinity;   // начинаем с самого свежего результата
        render({ keepScroll: false });
        goToMatch(false);
    },
    'edit-post'({ id }) { const p = find(S().posts, id); if (p) postForm(p); },
    'edit-manifest'() {
        const s = store.state;
        openForm({
            title: 'Manifest',
            note: 'Directions that cannot become a task but matter to keep in sight. One per line.',
            fields: [{ type: 'textarea', name: 'words', value: s.manifest.join('\n'), rows: 5, placeholder: 'focus\nposture\nstyle' }],
            onSubmit: (v) => { s.manifest = lines(v.words).map(cleanTag); },
        });
    },

    // --- roadmap
    'toggle-goal'({ id }) { const g = find(S().goals, id); if (g) { g.done = !g.done; S().roadmapClosedAt = ''; commit(); } },
    // Закрыть Roadmap можно, только когда выполнены все цели
    'close-roadmap'() {
        const s = S();
        if (!s.goals.length || s.goals.some((g) => !g.done)) return;
        s.roadmapClosedAt = logicalDayKey();
        commit();
    },
    'edit-goal'({ id }) { const g = find(S().goals, id); if (g) goalForm(g); },

    // --- sprint
    'toggle-task'({ id }) {
        const s = S();
        const t = find(s.sprint, id);
        if (!t) return;
        t.done = !t.done;
        if (t.source?.kind === 'sub') {
            const card = find(s.cards, t.source.cardId);
            const sub = find(card?.subtasks || [], t.source.id);
            if (sub) sub.done = t.done;
            if (card) { if (isCardDone(card)) card.closedAt = card.closedAt || logicalDayKey(); else delete card.closedAt; }
        }
        logTaskDone(s, t);
        commit();
    },
    'edit-task'({ id }) { const t = find(S().sprint, id); if (t) taskForm(t); },
    // Вечером, когда записываешь планы на завтра: одной кнопкой убрать весь сегодняшний день.
    // Задачи, добавленные вечером (они запланированы на завтра), не трогаем.
    // Выполненные строчки уходят и из бэклога, как при ночной пересменке; невыполненные остаются в бэклоге.
    'sprint-clear-today'() {
        const s = S();
        const today = s.sprint.filter(isTodayTask);
        if (!today.length) return;
        const open = today.filter((t) => !t.done).length;
        if (open && !confirm(`Clear today's tasks (${today.length})? Unfinished: ${open}.`)) return;
        today.forEach((t) => {
            if (t.done && t.source?.kind === 'row') s.rows = s.rows.filter((r) => r.id !== t.source.id);
        });
        s.sprint = s.sprint.filter((t) => !isTodayTask(t));
        toast('Cleared');
        commit();
    },

    // --- backlog
    filter({ cat }) { view.backlogFilter = cat; view.showStash = false; render({ keepScroll: false }); },
    'stash-toggle'() { view.showStash = !view.showStash; render({ keepScroll: false }); },   // чип Done в ряду категорий
    // Выполненная строчка уходит в Stash (и из спринта, если была там); повторное нажатие в Stash возвращает её
    'toggle-row'({ id }, el) {
        const s = S();
        const r = find(s.rows, id);
        if (!r) return;
        r.done = !r.done;
        if (r.done) r.doneAt = logicalDayKey(); else delete r.doneAt;
        logDone(s, r.id, r.category, r.done);
        if (r.done) s.sprint = s.sprint.filter((t) => !(t.source?.kind === 'row' && t.source.id === id));
        el.closest('.item')?.classList.toggle('is-done', r.done);
        store.save();
        setTimeout(() => render(), 320);
    },
    'toggle-note'({ id }, el) {
        const open = el.closest('.item').classList.toggle('is-open');
        if (open) view.openNotes.add(id); else view.openNotes.delete(id);
    },
    'toggle-learn'() {
        view.learn = !view.learn;
        try { localStorage.setItem('app_learn', view.learn ? '1' : '0'); } catch { /* приватный режим */ }
        render();
        openSettings();
    },
    'bg-preset'({ id }) { WallpaperService.setPreset(id); openSettings(); },
    // «Clear» и «Matte» под ползунком — быстрые положения
    'glass-set'({ v }) {
        GlassService.set(Number(v) / 100);
        const range = $('#glassRange');
        if (range) range.value = v;
    },
    flip({ id }) {
        if (view.flipped.has(id)) view.flipped.delete(id); else view.flipped.add(id);
        $(`.flip[data-id="${id}"]`)?.classList.toggle('is-flipped');
    },
    'toggle-sub'({ card, id }) {
        const s = S();
        const c = find(s.cards, card);
        const sub = find(c?.subtasks || [], id);
        if (!sub) return;
        const wasComplete = isCardDone(c);
        sub.done = !sub.done;
        s.sprint.forEach((t) => { if (t.source?.kind === 'sub' && t.source.id === id) t.done = sub.done; });
        logDone(s, id, c.category, sub.done);
        logDone(s, `card:${c.id}`, c.category, isCardDone(c));
        if (isCardDone(c)) c.closedAt = c.closedAt || logicalDayKey(); else delete c.closedAt;
        store.save();
        refreshCard(c);
        if (wasComplete !== isCardDone(c)) refreshBacklogChips();
        if (!wasComplete && isCardDone(c) && !view.showStash) {
            // Закрытая карточка на мгновение остаётся на месте, потом уезжает в Stash
            setTimeout(() => {
                if (view.tab === 'backlog' && !view.showStash && isCardDone(c)) render();
            }, 450);
        }
    },
    'sub-to-sprint'({ card, id }) {
        const s = S();
        const c = find(s.cards, card);
        const sub = find(c?.subtasks || [], id);
        if (!sub) return;
        s.sprint.push({ id: uid(), text: sub.text, done: false, plannedFor: sprintDayFor(), strikes: 0, source: { kind: 'sub', cardId: card, id } });
        toast('Added to sprint');
        store.save();
        refreshCard(c);
    },
    'row-to-sprint'({ id }) {
        const s = S();
        const r = find(s.rows, id);
        if (!r) return;
        s.sprint.push({ id: uid(), text: r.title, done: false, plannedFor: sprintDayFor(), strikes: 0, source: { kind: 'row', id } });
        toast('Added to sprint');
        commit();
    },
    'add-sub'({ id }) {
        const card = find(S().cards, id);
        if (!card) return;
        openForm({
            title: `Subtask · ${card.title}`,
            fields: [{ type: 'text', name: 'text', label: 'Task' }],
            submitLabel: 'Add',
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
            title: 'New category',
            fields: [{ type: 'text', name: 'name', label: 'Name', placeholder: 'Music' }],
            submitLabel: 'Add',
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
        toast('Saved');
        commit({ keepScroll: false });
    },
    'dump-to-feed'({ id }) {
        const s = S();
        const d = find(s.dump, id);
        if (!d) return;
        // Пост встаёт в ленту с исходным временем мысли — так видно, что думал в тот момент
        s.posts.push({ id: uid(), title: '', text: d.text, tags: [], createdAt: d.createdAt });
        s.dump = s.dump.filter((x) => x.id !== id);
        toast('Moved to library');
        commit();
    },
    // Идея, которая не ложится в ленту: заголовок — первая строка, всё остальное уходит в комментарий строчки
    'dump-to-backlog'({ id }) {
        const s = S();
        const d = find(s.dump, id);
        if (!d) return;
        const [first = '', ...rest] = d.text.split('\n');
        let title = first.trim();
        let note = rest.join('\n').trim();
        if (title.length > 80) { note = d.text.trim(); title = `${title.slice(0, 79).trimEnd()}…`; }
        s.rows.push({ id: uid(), title, note, category: '', due: '' });
        s.dump = s.dump.filter((x) => x.id !== id);
        toast('Moved to backlog');
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
        toast('Moved to backlog');
        commit();
    },
    'failed-delete'({ id }) { S().failed = S().failed.filter((x) => x.id !== id); commit(); },
    'failed-clear'() {
        if (!confirm('Discard all missed tasks?')) return;
        S().failed = [];
        commit();
    },

    // --- настройки / сезоны / архив
    // --- синхронизация
    async 'sync-login'() {
        const email = $('#syncEmail')?.value.trim();
        if (!/^\S+@\S+\.\S+$/.test(email || '')) { toast('Enter your email'); return; }
        try { await signIn(email); } catch (e) { alert(`Couldn't send the email: ${e.message}`); }
    },
    async 'sync-verify'() {
        const code = $('#syncCode')?.value.trim();
        if (!code) return;
        try { await verifyCode(code); toast('Signed in'); } catch (e) { alert(`Couldn't sign in: ${e.message}`); }
    },
    async 'sync-login-password'() {
        const email = $('#syncEmail')?.value.trim();
        const password = $('#syncPassword')?.value;
        if (!email || !password) { toast('Enter email and password'); return; }
        try { await signInWithPassword(email, password); toast('Signed in'); } catch (e) { alert(`Couldn't sign in: ${e.message}`); }
    },
    'sync-mode'({ mode }) { setLoginMode(mode); },
    'sync-set-password'() {
        openForm({
            title: 'Password',
            note: 'Lets you sign in on a new device or in the Home Screen app without an email. Minimum 6 characters.',
            fields: [
                { type: 'password', name: 'p1', label: 'New password' },
                { type: 'password', name: 'p2', label: 'Repeat' },
            ],
            onSubmit: async (v) => {
                if (v.p1.length < 6) { toast('Minimum 6 characters'); return false; }
                if (v.p1 !== v.p2) { toast("Passwords don't match"); return false; }
                try { await setPassword(v.p1); } catch (e) { alert(`Couldn't set the password: ${e.message}`); return false; }
                toast('Password set');
                return { reopenSettings: true };
            },
        });
    },
    'sync-cancel': () => cancelSignIn(),
    'sync-now': () => syncNow(),
    async 'sync-logout'() {
        if (!confirm('Sign out? Data stays on this device but stops syncing.')) return;
        await signOut();
    },

    'screen-debug'() { closeModals(); openScreenDebug(); },
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
        if (!entry || !confirm(`Delete archive “${entry.state.season?.name}” permanently?`)) return;
        store.saveArchive(list.filter((a) => a.id !== id));
        if (view.archive?.entry.id === id) view.archive = null;
        gcMedia();
        openSettings();
        render();
    },
    'manage-tags'() {
        const s = store.state;
        openForm({
            title: 'Tags',
            backToSettings: true,
            note: 'One tag per line. These tags are offered when you create a post.',
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
    'close-modal': () => cancelModal(),
    'form-chip'(_, el) { el.classList.toggle('is-active'); },
    'form-swatch'({ value }, el) {
        const wrap = el.closest('.swatches');
        wrap.querySelectorAll('.swatch').forEach((b) => b.classList.toggle('is-active', b === el));
        wrap.previousElementSibling.value = value;   // скрытое поле формы стоит прямо перед рядом кружков
    },
    'tag-color'({ tag }) {
        const s = store.state;
        openForm({
            title: `Color · #${tag}`,
            backToSettings: true,
            fields: [{ type: 'swatches', name: 'color', value: markerChoice(s, 't', tag) }],
            onSubmit: (v) => { s.colors[`t:${tag}`] = v.color; return { reopenSettings: true }; },
        });
    },
    'att-remove'({ id }) {
        const a = currentForm?.atts?.find((x) => x.id === id);
        if (!a) return;
        a.abort?.abort();   // если файл ещё сжимается — останавливаем
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

// Крестик, тап по фону и Esc: формы, открытые из настроек, возвращают обратно в настройки
function cancelModal() {
    const back = currentForm?.backToSettings;
    closeModals();
    if (back) openSettings();
}

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
    // Приложение с экрана «Домой»: у него свои отступы от статус-бара — см. .is-standalone в CSS
    const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
    document.documentElement.classList.toggle('is-standalone', standalone);

    store.load();
    WallpaperService.apply();
    GlassService.apply();

    document.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal && e.target === modal) { cancelModal(); return; }

        const el = e.target.closest('[data-act]');
        if (!el || el.disabled) return;
        const fn = actions[el.dataset.act];
        if (!fn) return;
        if (RO() && !READONLY_OK.has(el.dataset.act) && !el.closest('#settingsModal')) {
            toast('Archive is read-only');
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
        if (e.key === 'Escape') cancelModal();
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

    // Матовость стекла: меняется на лету
    document.addEventListener('input', (e) => {
        if (e.target.id === 'glassRange') GlassService.set(e.target.value / 100);
    });

    // Порядок задач спринта: тянешь за «⠿». Остальные задачи плавно расступаются, порядок применяется при отпускании.
    document.addEventListener('pointerdown', (e) => {
        const handle = e.target.closest('.drag-handle');
        if (!handle || RO()) return;
        const item = handle.closest('.item');
        const items = [...item.parentElement.children];
        if (items.length < 2) return;
        e.preventDefault();

        const from = items.indexOf(item);
        const rects = items.map((el) => el.getBoundingClientRect());
        const shift = rects[from].height + (rects[1].top - rects[0].bottom);
        const startY = e.clientY;
        let to = from;

        handle.setPointerCapture(e.pointerId);
        item.classList.add('is-dragging');
        items.forEach((el) => { if (el !== item) el.classList.add('is-shifting'); });

        const move = (ev) => {
            const dy = ev.clientY - startY;
            item.style.transform = `translateY(${dy}px)`;
            const center = rects[from].top + rects[from].height / 2 + dy;
            to = from;
            items.forEach((_, i) => {
                if (i === from) return;
                const mid = rects[i].top + rects[i].height / 2;
                if (i < from && center < mid) to = Math.min(to, i);
                if (i > from && center > mid) to = Math.max(to, i);
            });
            items.forEach((el, i) => {
                if (i === from) return;
                let y = 0;
                if (to < from && i >= to && i < from) y = shift;
                if (to > from && i > from && i <= to) y = -shift;
                el.style.transform = y ? `translateY(${y}px)` : '';
            });
        };
        const end = (ev) => {
            handle.removeEventListener('pointermove', move);
            handle.removeEventListener('pointerup', end);
            handle.removeEventListener('pointercancel', end);
            if (ev.type === 'pointerup' && to !== from) {
                const list = S().sprint;
                list.splice(to, 0, list.splice(from, 1)[0]);
                commit();
            } else {
                item.classList.remove('is-dragging');
                items.forEach((el) => { el.classList.remove('is-shifting'); el.style.transform = ''; });
            }
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', end);
        handle.addEventListener('pointercancel', end);
    });

    // scroll не всплывает, поэтому ловим на фазе перехвата
    document.addEventListener('scroll', (e) => {
        if (e.target.classList?.contains('chips-scroll')) updateChipFades(e.target.parentElement);
    }, true);
    window.addEventListener('resize', () => { updateChipFades(); syncTopHeight(); });

    const topObserver = new ResizeObserver(syncTopHeight);
    document.querySelectorAll('.fixed-top-bar, .page-sticky-header').forEach((el) => topObserver.observe(el));

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        if (e.target.matches?.('[data-new-tag]')) { e.preventDefault(); addTagFromInput(e.target); }
        else if (e.target.id === 'searchInput') { e.preventDefault(); actions['search-prev']?.(); }
    });
    document.addEventListener('focusout', (e) => {
        if (e.target.matches?.('[data-new-tag]') && e.target.value.trim()) addTagFromInput(e.target);
    });

    document.addEventListener('input', (e) => {
        if (e.target.id === 'searchInput') {
            view.search = e.target.value;
            view.searchIdx = Infinity;
            renderContent();
            goToMatch(false);
        } else if (e.target.matches?.('[data-swatch-color]')) {
            // Свой цвет: нативный выбор цвета рядом с палитрой
            const label = e.target.closest('.swatch');
            const wrap = e.target.closest('.swatches');
            wrap.previousElementSibling.value = e.target.value;
            wrap.querySelectorAll('.swatch').forEach((b) => b.classList.toggle('is-active', b === label));
            label.style.setProperty('--mk', e.target.value);
        } else if (e.target.id === 'dumpInput') {
            view.dumpDraft = e.target.value;
            autosizeDump();
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
                toast('Background updated');
                openSettings();
            } catch (err) {
                alert(err.message);
            }
        }
        if (e.target.id === 'importInput' && e.target.files[0]) {
            try {
                const data = JSON.parse(await e.target.files[0].text());
                if (!data.state) throw new Error('bad file');
                if (!confirm('Replace current data with the file?')) return;
                store.replace(data.state);
                if (Array.isArray(data.archive)) store.saveArchive(data.archive);
                view.archive = null;
                closeModals();
                render({ scrollToEnd: true });
                toast('Data restored');
            } catch {
                alert("Couldn't read the backup file");
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

    // Офлайн-режим: файлы приложения кэшируются и открываются без интернета (sw.js)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Офлайн-режим недоступен', e));
    }

    initSync({
        // Перерисовываем только блок синхронизации и сохраняем то, что уже введено в его поля
        onStatus: () => {
            if (syncStatus.state === 'ok') media.retryMissing();
            const el = $('#syncSection');
            if (!el) return;
            const typed = [...el.querySelectorAll('input')].map((i) => [i.id, i.value]);
            el.innerHTML = renderSyncSection(syncStatus, mediaUsage());
            typed.forEach(([id, v]) => { const i = document.getElementById(id); if (i) i.value = v; });
        },
        onRemoteChange: () => render(),
    });
});