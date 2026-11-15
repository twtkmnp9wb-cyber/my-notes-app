import { deadlineInfo, formatTime, dayLabel, calendarDayKey, logicalDayKey, daysBetween } from './dates.js';
import { DUMP_TTL_DAYS, STRIKE_LIMIT, SEASON_KINDS, cardProgress, isCardDone, doneCount } from './store.js';
import { formatSize } from './media.js';

// Состояние интерфейса, которое не нужно сохранять (открытый поиск, перевёрнутые карточки и т.п.)
export const view = {
    tab: 'feed',
    archive: null,          // { entry, state } — когда смотрим архивный сезон (только чтение)
    searchOpen: false,
    search: '',
    backlogFilter: 'all',
    flipped: new Set(),
    dumpSub: 'thoughts',
    dumpDraft: '',
    learn: (() => { try { return localStorage.getItem('app_learn') === '1'; } catch { return false; } })(),   // режим обучения: показывает подсказки
    openNotes: new Set(),   // строчки Backlog с раскрытым комментарием
    showStash: false,       // Backlog: показывать склад закрытых карточек вместо активных
};

// '&apos;' вместо '&#39;' — чтобы в экранированном тексте не появлялся лишний «#»,
// иначе регулярка хештегов поймала бы «#39».
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]
));
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const TAG_RE = /#([\p{L}\p{N}_]+)/gu;
export const extractTags = (text) => [...String(text || '').matchAll(TAG_RE)].map((m) => m[1].toLowerCase());
export const postTags = (p) => [...new Set([...p.tags, ...extractTags(p.title), ...extractTags(p.text)])];

// Пояснительные тексты (пустые состояния, подсказки) показываются только в режиме обучения
const tip = (html) => (view.learn ? html : '');
const empty = (text) => tip(`<div class="empty">${text}</div>`);
const bar = (pct) => `<div class="bar"><i style="width:${pct}%"></i></div>`;
const editBtn = (act, attrs) => `<button class="icon-btn" data-act="${act}" ${attrs} title="Edit">✎</button>`;

// ================= ЦВЕТНЫЕ МАРКЕРЫ ЧИПСОВ =================
// У каждой категории и тега есть цвет. Пока не выбран вручную (настройки / «✎» у категорий) —
// берётся из палитры по названию, поэтому он всегда один и тот же. 'none' — без маркера.
export const MARKER_COLORS = {
    red: '#f43f5e', orange: '#fb923c', yellow: '#fbbf24', green: '#34d399',
    cyan: '#22d3ee', blue: '#60a5fa', violet: '#a78bfa', pink: '#f472b6',
};
const MARKER_KEYS = Object.keys(MARKER_COLORS);

// kind: 'c' — категория, 't' — тег
export function markerKey(s, kind, name) {
    if (!name) return '';
    const saved = s.colors?.[`${kind}:${name}`];
    if (saved === 'none') return '';
    if (saved && MARKER_COLORS[saved]) return saved;
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return MARKER_KEYS[h % MARKER_KEYS.length];
}
const mk = (s, kind, name) => {
    const k = markerKey(s, kind, name);
    return k ? `<i class="mk" style="--mk:${MARKER_COLORS[k]}"></i>` : '';
};
const tagStyle = (s, tag) => {
    const k = markerKey(s, 't', tag);
    return k ? `style="--mk:${MARKER_COLORS[k]}"` : '';
};

// ================= ЛЕНТА =================
function postMatches(p, q) {
    if (q.startsWith('#')) {
        const t = q.slice(1);
        return !t || postTags(p).some((x) => x.startsWith(t));
    }
    const names = (p.attachments || []).map((a) => a.name).join('\n');
    return `${p.title}\n${p.text}\n${names}`.toLowerCase().includes(q) || postTags(p).some((x) => x.includes(q));
}

// ================= ВЛОЖЕНИЯ =================
const ALBUM_MAX = 4;
const ext = (name) => (name.includes('.') ? name.split('.').pop().slice(0, 4).toUpperCase() : 'FILE');
const visualOf = (p) => (p.attachments || []).filter((a) => a.kind === 'image' || a.kind === 'video');

function tileHtml(postId, a, extra = '') {
    const inner = a.kind === 'image'
        ? `<img data-att="${a.id}" alt="" loading="lazy" decoding="async">`
        : `<video data-att="${a.id}" data-poster="1" muted playsinline preload="metadata"></video><span class="play">▶</span>`;
    return `<button class="att att-tile" data-act="open-media" data-post="${postId}" data-id="${a.id}">${inner}${extra}</button>`;
}

// Альбом как в Telegram: до 4 плиток, на последней «+N», остальное листается в просмотрщике
function albumHtml(p) {
    const visual = visualOf(p);
    if (!visual.length) return '';
    const shown = visual.slice(0, ALBUM_MAX);
    const more = visual.length - ALBUM_MAX;
    // Одно фото — в точных пропорциях файла, без обрезки (раньше они зажимались в 0.6–1.9)
    const style = shown.length === 1 && shown[0].w && shown[0].h
        ? `style="aspect-ratio:${shown[0].w} / ${shown[0].h}"` : '';
    return `<div class="album album-${shown.length}" ${style}>${shown.map((a, i) =>
        tileHtml(p.id, a, more > 0 && i === ALBUM_MAX - 1 ? `<span class="more">+${more}</span>` : '')).join('')}</div>`;
}

function otherAttsHtml(p) {
    return (p.attachments || []).filter((a) => a.kind === 'audio' || a.kind === 'file').map((a) => (a.kind === 'audio'
        ? `<div class="att att-audio">
               <div class="att-row"><span class="file-icon">♪</span><span class="file-meta"><span class="file-name">${esc(a.name)}</span><span class="file-size">${formatSize(a.size)}</span></span></div>
               <audio data-att="${a.id}" controls preload="metadata"></audio>
           </div>`
        // PDF откроется в новой вкладке, остальное — скачается
        : `<a class="att att-file att-row" data-att="${a.id}" target="_blank" rel="noopener" ${a.type === 'application/pdf' ? '' : `download="${esc(a.name)}"`}>
               <span class="file-icon">${esc(ext(a.name))}</span>
               <span class="file-meta"><span class="file-name">${esc(a.name)}</span><span class="file-size">${formatSize(a.size)}</span></span>
           </a>`)).join('');
}

// Список вложений в форме поста. Новые файлы показываются по превью-ссылке, сохранённые — из базы.
export function renderAttList(list) {
    return list.map((a) => {
        let thumb = `<span class="file-icon">${a.kind === 'audio' ? '♪' : a.kind === 'video' ? '▶' : esc(ext(a.name))}</span>`;
        if (a.kind === 'image') thumb = a.preview ? `<img src="${a.preview}" alt="">` : `<img data-att="${a.id}" alt="">`;
        let meta = formatSize(a.size);
        if (a.busy) {
            meta = a.kind === 'video' ? `compressing… ${Math.round((a.progress || 0) * 100)}%` : 'compressing…';
        } else if (a.originalSize && a.originalSize > a.size) {
            meta = `${formatSize(a.originalSize)} → ${formatSize(a.size)}`;
        }
        return `<div class="att-chip ${a.busy ? 'is-busy' : ''}">
            ${thumb}
            <span class="file-meta">
                <span class="file-name">${esc(a.name)}</span>
                <span class="file-size">${meta}</span>
                ${a.busy && a.kind === 'video' ? `<span class="bar"><i style="width:${Math.round((a.progress || 0) * 100)}%"></i></span>` : ''}
            </span>
            <button type="button" class="icon-btn danger" data-act="att-remove" data-id="${a.id}" title="Remove">✕</button>
        </div>`;
    }).join('');
}

export function renderViewer(items, index) {
    const a = items[index];
    const stage = a.kind === 'image'
        ? `<img data-att="${a.id}" alt="">`
        : `<video data-att="${a.id}" controls autoplay playsinline></video>`;
    return `
        <div class="viewer-top">
            <span class="viewer-count">${items.length > 1 ? `${index + 1} / ${items.length}` : ''}</span>
            <a class="viewer-btn" data-att="${a.id}" download="${esc(a.name)}" title="Download">⤓</a>
            <button class="viewer-btn" data-act="media-close" title="Close">✕</button>
        </div>
        <div class="viewer-stage" data-act="media-close">${stage}</div>
        ${items.length > 1 ? `
            <button class="viewer-nav prev" data-act="media-nav" data-dir="-1" ${index === 0 ? 'disabled' : ''}>‹</button>
            <button class="viewer-nav next" data-act="media-nav" data-dir="1" ${index === items.length - 1 ? 'disabled' : ''}>›</button>` : ''}`;
}
export { visualOf };

function richText(text, q, s) {
    let html = esc(text).replace(TAG_RE, (m, tag) =>
        `<button class="hashtag" ${tagStyle(s, tag.toLowerCase())} data-act="search-tag" data-tag="${tag.toLowerCase()}">${m}</button>`);
    if (q && !q.startsWith('#')) {
        html = html.replace(new RegExp(`(${escRe(esc(q))})(?![^<]*>)`, 'gi'), '<mark>$1</mark>');
    }
    return html;
}

export function feedCounts(s) {
    const q = view.search.trim().toLowerCase();
    return { shown: q ? s.posts.filter((p) => postMatches(p, q)).length : s.posts.length, total: s.posts.length };
}

export function renderFeedHeader(s, ro) {
    const words = s.manifest.length
        ? s.manifest.map((w) => `<span>#${esc(w)}</span>`).join('')
        : `<span class="muted">${ro ? '' : view.learn ? 'tap to set the direction of the season' : '+'}</span>`;
    const allTags = [...new Set([...s.tags, ...s.posts.flatMap(postTags)])];
    const q = view.search.trim().toLowerCase();
    return `
        <button class="manifest" data-act="edit-manifest" ${ro ? 'disabled' : ''}>
            <span class="kicker">Manifest</span>
            <span class="manifest-words">${words}</span>
        </button>
        ${view.searchOpen ? `
            <div class="search-bar">
                <span class="muted">🔍</span>
                <input type="search" id="searchInput" class="search-input" placeholder="Search or #tag" value="${esc(view.search)}" autocomplete="off">
                <span id="searchCounter" class="search-counter"></span>
                <button class="icon-btn" data-act="search-close" title="Close">✕</button>
            </div>
            ${allTags.length ? `<div class="chips-scroll search-tags">${allTags.map((t) =>
                `<button class="chip ${q === '#' + t ? 'is-active' : ''}" data-act="search-tag" data-tag="${esc(t)}">${mk(s, 't', t)}#${esc(t)}</button>`).join('')}</div>` : ''}
        ` : ''}
        <h2 class="born">Born to win.</h2>
    `;
}

export function renderFeed(s, ro) {
    const q = view.search.trim().toLowerCase();
    const all = [...s.posts].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    const posts = q ? all.filter((p) => postMatches(p, q)) : all;
    if (!posts.length) {
        return q ? '<div class="empty">Nothing found</div>' : empty(ro ? 'No posts in this season.' : 'The library is empty. Tap + to write your first post.');
    }

    let out = '';
    let lastDay = '';
    for (const p of posts) {
        const day = calendarDayKey(p.createdAt);
        if (day !== lastDay) {
            out += `<div class="day-sep"><span>${esc(dayLabel(day))}</span></div>`;
            lastDay = day;
        }
        const inline = new Set([...extractTags(p.title), ...extractTags(p.text)]);
        const extra = p.tags.filter((t) => !inline.has(t));
        out += `
            <article class="post">
                ${ro ? '' : `<button class="post-menu" data-act="edit-post" data-id="${p.id}" title="Edit">⋯</button>`}
                ${albumHtml(p)}
                ${p.title ? `<h3 class="post-title">${richText(p.title, q, s)}</h3>` : ''}
                ${p.text ? `<div class="post-text">${richText(p.text, q, s)}</div>` : ''}
                ${otherAttsHtml(p)}
                ${extra.length ? `<div class="post-tags">${extra.map((t) =>
                    `<button class="hashtag" ${tagStyle(s, t)} data-act="search-tag" data-tag="${esc(t)}">#${esc(t)}</button>`).join(' ')}</div>` : ''}
                <div class="post-meta">${p.editedAt ? 'edited ' : ''}${formatTime(p.createdAt)}</div>
            </article>`;
    }
    return out;
}

// ================= ROADMAP =================
export function renderRoadmap(s, ro) {
    const done = s.goals.filter((g) => g.done).length;
    // Если у цели выбрана тема — под ней счётчик выполненных за сезон задач этой категории
    const items = s.goals.map((g) => `
        <div class="item ${g.done ? 'is-done' : ''}">
            <button class="check" data-act="toggle-goal" data-id="${g.id}" aria-label="Done"></button>
            <div class="item-main">
                <span class="item-text">${esc(g.text)}</span>
                ${g.category ? `<span class="item-meta goal-count">${esc(g.category)} · <b>${doneCount(s, g.category)} done</b></span>` : ''}
            </div>
            ${ro ? '' : editBtn('edit-goal', `data-id="${g.id}"`)}
        </div>`).join('');
    return `<div class="pane">
        <section class="panel">
            <span class="kicker">Goals</span>
            <h2 class="panel-title">${esc(s.season.name)}</h2>
            ${s.goals.length ? `${bar(Math.round((done / s.goals.length) * 100))}<div class="panel-sub">${done} / ${s.goals.length}</div>` : ''}
        </section>
        <div class="scroll-area" data-scroll="goals">
            <div class="list">${items || empty('No goals yet. A good goal is one you can honestly answer with yes or no at the end of the season.')}</div>
        </div>
    </div>`;
}

// ================= SPRINT =================
function sourceLabel(s, t) {
    if (t.source?.kind === 'row') return 'from backlog';
    if (t.source?.kind === 'sub') {
        const card = s.cards.find((c) => c.id === t.source.cardId);
        return card ? `from ${esc(card.title)}` : '';
    }
    return '';
}

export const isTodayTask = (t) => !t.plannedFor || daysBetween(t.plannedFor, logicalDayKey()) >= 0;

export function renderSprint(s, ro) {
    const done = s.sprint.filter((t) => t.done).length;
    const todayCount = s.sprint.filter(isTodayTask).length;
    const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    const items = s.sprint.map((t) => {
        const meta = [sourceLabel(s, t), t.strikes ? `<span class="hot">day ${t.strikes + 1} of ${STRIKE_LIMIT}</span>` : '']
            .filter(Boolean).join(' · ');
        return `
            <div class="item ${t.done ? 'is-done' : ''}">
                <button class="check" data-act="toggle-task" data-id="${t.id}" aria-label="Done"></button>
                <div class="item-main">
                    <span class="item-text">${esc(t.text)}</span>
                    ${meta ? `<span class="item-meta">${meta}</span>` : ''}
                </div>
                ${ro ? '' : `<span class="drag-handle" title="Drag to reorder" aria-label="Drag">⠿</span>`}
                ${ro ? '' : editBtn('edit-task', `data-id="${t.id}"`)}
            </div>`;
    }).join('');
    return `<div class="pane">
        <section class="panel panel-sprint">
            ${ro || !todayCount ? '' : '<button class="panel-action" data-act="sprint-clear-today" title="Clear today\'s tasks">Clear</button>'}
            <span class="kicker">Sprint</span>
            <h2 class="panel-title">${esc(today)}</h2>
            ${s.sprint.length ? `${bar(Math.round((done / s.sprint.length) * 100))}<div class="panel-sub">${done} / ${s.sprint.length}</div>` : ''}
        </section>
        <div class="scroll-area" data-scroll="sprint">
            <div class="list">${items || empty('Nothing planned for today. Add a task with + or send one from Backlog.')}</div>
            ${ro ? '' : tip(`<p class="hint">Tasks added after 18:00 are planned for tomorrow and survive the night. Done tasks disappear at 04:00, or tap Clear to wipe today at once. A task left unfinished for ${STRIKE_LIMIT} days moves to Dump → Missed.</p>`)}
        </div>
    </div>`;
}

// ================= BACKLOG =================
const inSprint = (s, pred) => s.sprint.some((t) => t.source && pred(t.source));

export function hotCount(s, cat) {
    const inCat = (x) => cat === 'all' || x.category === cat;
    return s.cards.filter((c) => inCat(c) && !isCardDone(c) && deadlineInfo(c.due).level === 'hot').length
        + s.rows.filter((r) => inCat(r) && !r.done && deadlineInfo(r.due).level === 'hot').length;
}

export function renderBacklogChips(s, ro) {
    const cats = ['all', ...s.categories];
    const doneTotal = s.cards.filter(isCardDone).length + s.rows.filter((r) => r.done).length;
    return `<div class="chips-scroll">
        ${cats.map((c) => {
            const n = hotCount(s, c);
            return `<button class="chip ${view.backlogFilter === c && !view.showStash ? 'is-active' : ''}" data-act="filter" data-cat="${esc(c)}">
                ${c === 'all' ? 'All' : `${mk(s, 'c', c)}${esc(c)}`}${n ? `<span class="badge">${n}</span>` : ''}</button>`;
        }).join('')}
        ${ro ? '' : `<button class="chip chip-ghost" data-act="add-category" title="New category">＋</button>
                     <button class="chip chip-ghost" data-act="manage-categories" title="Edit categories">✎</button>`}
        ${doneTotal ? `<button class="chip chip-muted ${view.showStash ? 'is-active' : ''}" data-act="stash-toggle">Done</button>` : ''}
    </div>`;
}

export function cardHtml(s, c, ro) {
    const dl = deadlineInfo(c.due);
    const { total, pct } = cardProgress(c);
    const subs = c.subtasks.map((st) => {
        const queued = inSprint(s, (src) => src.kind === 'sub' && src.id === st.id);
        let tail = '';
        if (!ro && !st.done) {
            tail = queued
                ? '<span class="tag-sprint">in sprint</span>'
                : `<button class="to-sprint" data-act="sub-to-sprint" data-card="${c.id}" data-id="${st.id}" title="To sprint">↗</button>`;
        }
        return `<div class="sub ${st.done ? 'is-done' : ''}">
            <button class="check sm" data-act="toggle-sub" data-card="${c.id}" data-id="${st.id}" aria-label="Done"></button>
            <span class="sub-text">${esc(st.text)}</span>${tail}
        </div>`;
    }).join('');

    return `
        <div class="flip ${view.flipped.has(c.id) ? 'is-flipped' : ''}" data-act="flip" data-id="${c.id}">
            <div class="flip-inner">
                <div class="flip-face">
                    <div class="card-top">
                        <span class="pill">${mk(s, 'c', c.category)}${esc(c.category || '—')}</span>
                        ${dl.label ? `<span class="dl dl-${dl.level}"><i class="dot"></i>${esc(dl.label)}</span>` : ''}
                    </div>
                    <h4 class="card-title">${esc(c.title)}</h4>
                    <div>
                        ${bar(pct)}
                        <div class="card-foot"><span>${total ? `${pct}%` : ''}</span></div>
                    </div>
                </div>
                <div class="flip-face flip-back">
                    <div class="card-top">
                        <span class="card-back-title">${esc(c.title)}</span>
                        ${ro ? '' : editBtn('edit-card', `data-id="${c.id}"`)}
                    </div>
                    <div class="subs">${subs}</div>
                    ${ro ? '' : '<button class="sub-add" data-act="add-sub" data-id="' + c.id + '">＋ Subtask</button>'}
                </div>
            </div>
        </div>`;
}

// Строчка: галочка → название (+ стрелка комментария) → метки (категория, затем дедлайн — как на карточке)
function rowHtml(s, r, ro) {
    const dl = deadlineInfo(r.due);
    const queued = inSprint(s, (src) => src.kind === 'row' && src.id === r.id);
    const open = view.openNotes.has(r.id);
    const meta = [
        r.category ? `<span class="meta-cat">${mk(s, 'c', r.category)}${esc(r.category)}</span>` : '',
        dl.label ? `<span class="dl dl-${dl.level}"><i class="dot"></i>${esc(dl.label)}</span>` : '',
    ].filter(Boolean).join('');
    return `
        <div class="item row-item ${r.done ? 'is-done' : ''} ${open ? 'is-open' : ''}">
            ${ro ? '' : `<button class="check" data-act="toggle-row" data-id="${r.id}" aria-label="Done"></button>`}
            <div class="item-main">
                <div class="item-line">
                    <span class="item-text">${esc(r.title)}</span>
                    ${r.note ? `<button class="note-toggle" data-act="toggle-note" data-id="${r.id}" aria-label="Comment"></button>` : ''}
                </div>
                ${r.note ? `<span class="item-note">${esc(r.note)}</span>` : ''}
                ${meta ? `<div class="item-meta row-meta">${meta}</div>` : ''}
            </div>
            ${r.done ? '' : queued ? '<span class="tag-sprint">in sprint</span>'
                : ro ? '' : `<button class="btn-mini" data-act="row-to-sprint" data-id="${r.id}">To sprint ↗</button>`}
            ${ro ? '' : editBtn('edit-row', `data-id="${r.id}"`)}
        </div>`;
}

export function renderBacklog(s, ro) {
    const f = view.backlogFilter;
    if (view.showStash && !s.cards.some(isCardDone) && !s.rows.some((r) => r.done)) view.showStash = false;   // в Done пусто — возвращаемся
    const inCat = (x) => view.showStash || f === 'all' || x.category === f;
    const byDue = (a, b) => deadlineInfo(a.due).sort - deadlineInfo(b.due).sort;
    // Закрытые карточки и строчки не висят среди планов, а лежат в Stash
    const activeCards = s.cards.filter((c) => inCat(c) && !isCardDone(c)).sort(byDue);
    const doneCards = s.cards.filter((c) => inCat(c) && isCardDone(c)).sort(byDue);
    const activeRows = s.rows.filter((r) => inCat(r) && !r.done).sort(byDue);
    const doneRows = s.rows.filter((r) => inCat(r) && r.done).sort(byDue);
    const cards = view.showStash ? doneCards : activeCards;
    const rows = view.showStash ? doneRows : activeRows;

    const emptyText = view.showStash ? 'Nothing here yet.'
        : doneCards.length ? 'All cards are done. Find them under Done.'
        : 'No cards. A card is a bigger task closed through subtasks.';
    // Карточки и строчки крутятся каждые в своём контейнере, страница остаётся на месте
    return `<div class="pane">
        <div class="section-head"><span class="kicker">Cards · ${cards.length}</span></div>
        <div class="scroll-area scroll-cards" data-scroll="cards">
            ${cards.length ? `<div class="card-grid">${cards.map((c) => cardHtml(s, c, ro)).join('')}</div>` : empty(emptyText)}
        </div>
        <div class="section-head">
            <span class="kicker">Tasks · ${rows.length}</span>
            ${ro || view.showStash ? '' : '<button class="btn-mini" data-act="add-row">＋ Task</button>'}
        </div>
        <div class="scroll-area scroll-rows" data-scroll="rows">
            <div class="list">${rows.map((r) => rowHtml(s, r, ro)).join('') || empty('No tasks.')}</div>
        </div>
    </div>`;
}

// ================= DUMP =================
export function renderDump(s, ro) {
    const tabs = `
        <div class="segmented">
            <button class="${view.dumpSub === 'thoughts' ? 'is-active' : ''}" data-act="dump-sub" data-sub="thoughts">Thoughts</button>
            <button class="${view.dumpSub === 'failed' ? 'is-active' : ''}" data-act="dump-sub" data-sub="failed">
                Missed${s.failed.length ? `<span class="badge">${s.failed.length}</span>` : ''}</button>
        </div>`;

    if (view.dumpSub === 'failed') {
        const items = s.failed.map((f) => `
            <div class="item">
                <div class="item-main">
                    <span class="item-text">${esc(f.text)}</span>
                    <span class="item-meta">${STRIKE_LIMIT} days in sprint</span>
                </div>
                ${ro ? '' : `<button class="btn-mini" data-act="failed-to-backlog" data-id="${f.id}">To backlog</button>
                             <button class="icon-btn danger" data-act="failed-delete" data-id="${f.id}" title="Discard">✕</button>`}
            </div>`).join('');
        return `<div class="pane">${tabs}
            ${tip(`<p class="hint">If a task has not moved for ${STRIKE_LIMIT} days it is probably noise. Move it back to the backlog or discard it.</p>`)}
            <div class="scroll-area" data-scroll="failed">
                <div class="list">${items || empty('Nothing missed.')}</div>
            </div>
            ${s.failed.length && !ro ? '<button class="btn-wide danger" data-act="failed-clear">Clear all</button>' : ''}
        </div>`;
    }

    const today = logicalDayKey();
    const groups = new Map();
    for (const d of [...s.dump].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))) {
        const key = logicalDayKey(d.createdAt);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(d);
    }
    const groupsHtml = [...groups].map(([key, notes]) => {
        const left = DUMP_TTL_DAYS - daysBetween(key, today);
        return `
            <div class="section-head">
                <span class="kicker">${esc(dayLabel(key, today))}</span>
                <span class="muted small">${left <= 1 ? 'expires tonight' : `expires in ${left}d`}</span>
            </div>
            <div class="list">${notes.map((d) => `
                <div class="dump-note">
                    <div class="dump-text">${esc(d.text)}</div>
                    <div class="dump-actions">
                        <span class="muted small">${formatTime(d.createdAt)}</span>
                        ${ro ? '' : `<button class="btn-mini" data-act="dump-to-backlog" data-id="${d.id}">To backlog</button>
                                     <button class="btn-mini" data-act="dump-to-feed" data-id="${d.id}">To library ↗</button>
                                     <button class="icon-btn danger" data-act="dump-delete" data-id="${d.id}" title="Delete">✕</button>`}
                    </div>
                </div>`).join('')}
            </div>`;
    }).join('');

    // Поле ввода — компактная строка внизу (как в мессенджере), растёт по мере набора.
    // Раньше оно было большой панелью сверху и закрывало уже написанное.
    return `<div class="pane">${tabs}
        <div class="scroll-area" data-scroll="dump">
            ${groupsHtml || empty(`Entries live for ${DUMP_TTL_DAYS} days, then disappear. Move anything valuable to the library or backlog.`)}
        </div>
        ${ro ? '' : `
            <div class="composer-bar">
                <textarea id="dumpInput" rows="1" placeholder="Dump a thought…">${esc(view.dumpDraft)}</textarea>
                <button class="send-btn" data-act="dump-save" aria-label="Dump">↑</button>
            </div>`}
    </div>`;
}

// ================= НАСТРОЙКИ =================
// Блок синхронизации рендерится отдельно: его статус меняется в фоне, а остальные настройки — нет
const CLOUD_LIMIT = 1024 ** 3;   // бесплатный тариф Supabase — 1 ГБ хранилища

// usage — суммарный вес фото/видео/файлов во всех постах (текущий сезон + архив)
function usageHtml(usage) {
    const pct = Math.min(100, Math.round((usage / CLOUD_LIMIT) * 100));
    return `<div class="usage">
        <div class="usage-line"><span>Media</span><span>${formatSize(usage)} / 1 GB</span></div>
        <div class="bar ${pct >= 85 ? 'is-full' : ''}"><i style="width:${Math.max(pct, usage ? 1 : 0)}%"></i></div>
    </div>`;
}

export function renderSyncSection(st, usage = 0) {
    const time = st.lastSync ? st.lastSync.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
    let body;
    if (st.state === 'off') {
        body = '<p class="muted small">Not configured: Supabase keys are missing in js/config.js.</p>';
    } else if (st.state === 'signed-out') {
        const byPassword = st.loginMode === 'password';
        body = `
            ${tip('<p class="muted small">Sign in to keep the library, tasks, archive and files identical on phone and laptop.</p>')}
            <label class="field"><input type="email" id="syncEmail" placeholder="Email" autocomplete="username email"></label>
            ${byPassword ? `
                <label class="field"><input type="password" id="syncPassword" placeholder="Password" autocomplete="current-password"></label>
                <button class="btn-wide primary" data-act="sync-login-password">Sign in</button>
                <button class="btn-wide ghost" data-act="sync-mode" data-mode="link">No password — sign in with an email link</button>`
            : `
                <button class="btn-wide primary" data-act="sync-login">Send sign-in email</button>
                <button class="btn-wide ghost" data-act="sync-mode" data-mode="password">Sign in with password</button>`}`;
    } else if (st.state === 'code-sent') {
        body = `
            <p class="muted small">Email sent to ${esc(st.pendingEmail)}. Tap “Sign in” in the email — or, if the app runs from the Home Screen, long-press the link, copy it and paste it here.</p>
            <label class="field"><input type="text" id="syncCode" autocomplete="one-time-code" placeholder="Link from the email"></label>
            <button class="btn-wide primary" data-act="sync-verify">Sign in</button>
            <button class="btn-wide ghost" data-act="sync-cancel">Use another email</button>`;
    } else {
        const line = {
            syncing: '<span class="sync-dot is-busy"></span>Syncing…',
            ok: `<span class="sync-dot is-ok"></span>Synced${time ? ` at ${time}` : ''}`,
            error: `<span class="sync-dot is-error"></span>Error: ${esc(st.error)}`,
        }[st.state] || '';
        body = `
            <div class="item">
                <div class="item-main">
                    <span class="item-text">${esc(st.email)}</span>
                    <span class="item-meta sync-line">${line}</span>
                </div>
                <button class="btn-mini" data-act="sync-now">Sync now</button>
            </div>
            ${usageHtml(usage)}
            ${st.warning ? `<p class="muted small hot">${esc(st.warning)}</p>` : ''}
            <button class="btn-wide ghost" data-act="sync-set-password">Set or change password</button>
            <button class="btn-wide ghost" data-act="sync-logout">Sign out</button>`;
    }
    return `<span class="kicker">Sync</span>${body}`;
}

export function renderSettings(s, archive, hasWallpaper, syncSt, usage, look = {}) {
    const presets = look.presets || {};
    const glass = Math.round((look.glass || 0) * 100);
    const fmt = (d) => new Date(d).toLocaleDateString('en-GB');
    return `
        <div class="modal-header"><h3>Settings</h3><button class="close-btn" data-act="close-modal">×</button></div>

        <div class="settings-section" id="syncSection">${renderSyncSection(syncSt, usage)}</div>

        <div class="settings-section">
            <span class="kicker">Appearance</span>
            <div class="bg-presets">${Object.entries(presets).map(([id, p]) => `
                <button type="button" class="bg-swatch ${!hasWallpaper && look.preset === id ? 'is-active' : ''}" data-act="bg-preset" data-id="${id}" title="${esc(p.name)}" style="background:${p.css}"></button>`).join('')}
            </div>
            <label class="btn-wide ghost">${hasWallpaper ? 'Replace photo' : 'Upload photo'}<input type="file" id="bgFileInput" accept="image/*" hidden></label>
            ${hasWallpaper || look.preset ? '<button class="btn-wide ghost" data-act="reset-wallpaper">Reset background</button>' : ''}
            <label class="range-row"><span>Glass</span>
                <input type="range" id="glassRange" min="0" max="100" value="${glass}">
                <span class="range-ends"><i>Clear</i><i>Matte</i></span>
            </label>
            <button class="btn-wide ghost" data-act="toggle-learn">Learning mode · ${look.learn ? 'On' : 'Off'}</button>
        </div>

        <div class="settings-section">
            <span class="kicker">Season</span>
            <div class="item">
                <div class="item-main">
                    <span class="item-text">${esc(s.season.name)}</span>
                    <span class="item-meta">${esc(SEASON_KINDS[s.season.kind])} · since ${fmt(s.season.startedAt)}</span>
                </div>
                ${editBtn('edit-season', '')}
            </div>
            <button class="btn-wide" data-act="close-season">Close season</button>
        </div>

        <div class="settings-section">
            <span class="kicker">Archive</span>
            ${archive.length ? archive.map((a) => `
                <div class="item">
                    <div class="item-main">
                        <span class="item-text">${esc(a.state.season?.name || 'Season')}</span>
                        <span class="item-meta">${(a.state.posts || []).length} posts · closed ${fmt(a.closedAt)}</span>
                    </div>
                    <button class="btn-mini" data-act="open-archive" data-id="${a.id}">Open</button>
                    <button class="icon-btn danger" data-act="delete-archive" data-id="${a.id}" title="Delete">✕</button>
                </div>`).join('') : tip('<p class="muted small">No closed seasons yet.</p>')}
        </div>

        <div class="settings-section">
            <span class="kicker">Tags</span>
            <div class="chips-wrap">${s.tags.map((t) => `<button class="chip" data-act="tag-color" data-tag="${esc(t)}" title="Color">${mk(s, 't', t)}#${esc(t)}</button>`).join('') || '<span class="muted small">—</span>'}</div>
            ${s.tags.length ? tip('<p class="muted small">Tap a tag to choose its color.</p>') : ''}
            <button class="btn-wide ghost" data-act="manage-tags">Edit tags</button>
        </div>

        <div class="settings-section">
            <span class="kicker">Data</span>
            ${tip('<p class="muted small">A backup file holds texts, tasks and the archive. Photos, videos and files are not included — sync keeps them.</p>')}
            <button class="btn-wide ghost" data-act="export">Export backup</button>
            <label class="btn-wide ghost">Import backup<input type="file" id="importInput" accept="application/json,.json" hidden></label>
            <button class="btn-wide ghost" data-act="screen-debug">Screen debug</button>
        </div>`;
}

// ================= УНИВЕРСАЛЬНАЯ ФОРМА =================
// fields: [{ type: 'text'|'textarea'|'date'|'select'|'chips'|'checkbox', name, label, value, placeholder, options, rows }]
export function renderForm(cfg) {
    const field = (f) => {
        const label = f.label ? `<span class="field-label">${esc(f.label)}</span>` : '';
        switch (f.type) {
        case 'textarea':
            return `<label class="field">${label}<textarea name="${f.name}" rows="${f.rows || 4}" placeholder="${esc(f.placeholder || '')}">${esc(f.value || '')}</textarea></label>`;
        case 'select':
            return `<label class="field">${label}<select name="${f.name}">${f.options.map((o) =>
                `<option value="${esc(o.value)}" ${String(o.value) === String(f.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`;
        case 'chips':
            return `<div class="field">${label}<div class="chips-wrap" data-chips="${f.name}">${f.options.map((o) =>
                `<button type="button" class="chip ${(f.value || []).includes(o) ? 'is-active' : ''}" data-act="form-chip" data-value="${esc(o)}">#${esc(o)}</button>`).join('')
                || tip('<span class="muted small">No tags yet — add them in Settings.</span>')}</div></div>`;
        case 'attachments':
            return `<div class="field">${label}
                <div id="attList" class="att-list">${renderAttList(f.value || [])}</div>
                <label class="btn-wide ghost attach-btn">📎 Attach<input type="file" id="attInput" multiple hidden></label>
            </div>`;
        case 'swatches':
            return `<div class="field">${label}<input type="hidden" name="${f.name}" value="${esc(f.value || 'none')}">
                <div class="swatches">${['none', ...MARKER_KEYS].map((k) =>
                    `<button type="button" class="swatch ${k === (f.value || 'none') ? 'is-active' : ''}" data-act="form-swatch" data-value="${k}" style="--mk:${MARKER_COLORS[k] || 'transparent'}" aria-label="${k}">${k === 'none' ? '∅' : ''}</button>`).join('')}</div></div>`;
        case 'checkbox':
            return `<label class="field field-check"><input type="checkbox" name="${f.name}" ${f.value ? 'checked' : ''}><span>${esc(f.label)}</span></label>`;
        default:
            return `<label class="field">${label}<input type="${f.type || 'text'}" name="${f.name}" value="${esc(f.value || '')}" placeholder="${esc(f.placeholder || '')}" autocomplete="off"></label>`;
        }
    };
    return `
        <form id="formEl" novalidate>
            <div class="modal-header"><h3>${esc(cfg.title)}</h3><button type="button" class="close-btn" data-act="close-modal">×</button></div>
            ${cfg.note ? tip(`<p class="muted small">${esc(cfg.note)}</p>`) : ''}
            ${cfg.fields.map(field).join('')}
            <div class="form-actions">
                ${cfg.onDelete ? `<button type="button" class="btn-wide danger" data-act="form-delete">${esc(cfg.deleteLabel || 'Delete')}</button>` : ''}
                <button type="submit" class="btn-wide primary">${esc(cfg.submitLabel || 'Save')}</button>
            </div>
        </form>`;
}