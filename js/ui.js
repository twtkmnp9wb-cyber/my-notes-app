import { deadlineInfo, formatTime, dayLabel, calendarDayKey, logicalDayKey, daysBetween } from './dates.js';
import { DUMP_TTL_DAYS, STRIKE_LIMIT, SEASON_KINDS, cardProgress, isCardDone } from './store.js';
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

const empty = (text) => `<div class="empty">${text}</div>`;
const bar = (pct) => `<div class="bar"><i style="width:${pct}%"></i></div>`;
const editBtn = (act, attrs) => `<button class="icon-btn" data-act="${act}" ${attrs} title="Редактировать">✎</button>`;

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
    const style = shown.length === 1 && shown[0].w
        ? `style="aspect-ratio:${Math.min(1.9, Math.max(0.6, shown[0].w / shown[0].h))}"` : '';
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
        return `<div class="att-chip">
            ${thumb}
            <span class="file-meta"><span class="file-name">${esc(a.name)}</span><span class="file-size">${formatSize(a.size)}</span></span>
            <button type="button" class="icon-btn danger" data-act="att-remove" data-id="${a.id}" title="Убрать">✕</button>
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
            <span class="viewer-count">${items.length > 1 ? `${index + 1} из ${items.length}` : ''}</span>
            <a class="viewer-btn" data-att="${a.id}" download="${esc(a.name)}" title="Скачать">⤓</a>
            <button class="viewer-btn" data-act="media-close" title="Закрыть">✕</button>
        </div>
        <div class="viewer-stage" data-act="media-close">${stage}</div>
        ${items.length > 1 ? `
            <button class="viewer-nav prev" data-act="media-nav" data-dir="-1" ${index === 0 ? 'disabled' : ''}>‹</button>
            <button class="viewer-nav next" data-act="media-nav" data-dir="1" ${index === items.length - 1 ? 'disabled' : ''}>›</button>` : ''}`;
}
export { visualOf };

function richText(text, q) {
    let html = esc(text).replace(TAG_RE, (m, tag) =>
        `<button class="hashtag" data-act="search-tag" data-tag="${tag.toLowerCase()}">${m}</button>`);
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
        : `<span class="muted">${ro ? 'манифест не задан' : 'нажми, чтобы задать направление сезона'}</span>`;
    const allTags = [...new Set([...s.tags, ...s.posts.flatMap(postTags)])];
    const q = view.search.trim().toLowerCase();
    return `
        <button class="manifest" data-act="edit-manifest" ${ro ? 'disabled' : ''}>
            <span class="kicker">Манифест сезона</span>
            <span class="manifest-words">${words}</span>
        </button>
        ${view.searchOpen ? `
            <div class="search-bar">
                <span class="muted">🔍</span>
                <input type="search" id="searchInput" class="search-input" placeholder="Поиск или #тег" value="${esc(view.search)}" autocomplete="off">
                <span id="searchCounter" class="search-counter"></span>
                <button class="icon-btn" data-act="search-close" title="Закрыть">✕</button>
            </div>
            ${allTags.length ? `<div class="chips-scroll search-tags">${allTags.map((t) =>
                `<button class="chip ${q === '#' + t ? 'is-active' : ''}" data-act="search-tag" data-tag="${esc(t)}">#${esc(t)}</button>`).join('')}</div>` : ''}
        ` : ''}
        <h2 class="born">Born to win.</h2>
    `;
}

export function renderFeed(s, ro) {
    const q = view.search.trim().toLowerCase();
    const all = [...s.posts].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    const posts = q ? all.filter((p) => postMatches(p, q)) : all;
    if (!posts.length) {
        return empty(q ? 'Ничего не найдено' : ro ? 'В этом сезоне постов не было' : 'Лента пуста. Нажми +, чтобы записать первый пост.');
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
                ${ro ? '' : `<button class="post-menu" data-act="edit-post" data-id="${p.id}" title="Редактировать">⋯</button>`}
                ${albumHtml(p)}
                ${p.title ? `<h3 class="post-title">${richText(p.title, q)}</h3>` : ''}
                ${p.text ? `<div class="post-text">${richText(p.text, q)}</div>` : ''}
                ${otherAttsHtml(p)}
                ${extra.length ? `<div class="post-tags">${extra.map((t) =>
                    `<button class="hashtag" data-act="search-tag" data-tag="${esc(t)}">#${esc(t)}</button>`).join(' ')}</div>` : ''}
                <div class="post-meta">${p.editedAt ? 'изм. ' : ''}${formatTime(p.createdAt)}</div>
            </article>`;
    }
    return out;
}

// ================= ROADMAP =================
export function renderRoadmap(s, ro) {
    const done = s.goals.filter((g) => g.done).length;
    const items = s.goals.map((g) => `
        <div class="item ${g.done ? 'is-done' : ''}">
            <button class="check" data-act="toggle-goal" data-id="${g.id}" aria-label="Отметить"></button>
            <span class="item-text">${esc(g.text)}</span>
            ${ro ? '' : editBtn('edit-goal', `data-id="${g.id}"`)}
        </div>`).join('');
    return `<div class="pane">
        <section class="panel">
            <span class="kicker">Цели на сезон</span>
            <h2 class="panel-title">${esc(s.season.name)}</h2>
            ${s.goals.length ? `${bar(Math.round((done / s.goals.length) * 100))}<div class="panel-sub">${done} из ${s.goals.length}</div>` : ''}
        </section>
        <div class="scroll-area" data-scroll="goals">
            <div class="list">${items || empty('Целей пока нет. Хорошая цель — та, про которую в конце сезона можно честно сказать «да» или «нет».')}</div>
        </div>
    </div>`;
}

// ================= SPRINT =================
function sourceLabel(s, t) {
    if (t.source?.kind === 'row') return 'из бэклога';
    if (t.source?.kind === 'sub') {
        const card = s.cards.find((c) => c.id === t.source.cardId);
        return card ? `из «${esc(card.title)}»` : '';
    }
    return '';
}

export function renderSprint(s, ro) {
    const done = s.sprint.filter((t) => t.done).length;
    const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
    const items = s.sprint.map((t) => {
        const meta = [sourceLabel(s, t), t.strikes ? `<span class="hot">висит ${t.strikes + 1}-й день из ${STRIKE_LIMIT}</span>` : '']
            .filter(Boolean).join(' · ');
        return `
            <div class="item ${t.done ? 'is-done' : ''}">
                <button class="check" data-act="toggle-task" data-id="${t.id}" aria-label="Отметить"></button>
                <div class="item-main">
                    <span class="item-text">${esc(t.text)}</span>
                    ${meta ? `<span class="item-meta">${meta}</span>` : ''}
                </div>
                ${ro ? '' : editBtn('edit-task', `data-id="${t.id}"`)}
            </div>`;
    }).join('');
    return `<div class="pane">
        <section class="panel panel-sprint">
            <span class="kicker">Спринт</span>
            <h2 class="panel-title">${esc(today)}</h2>
            ${s.sprint.length ? `${bar(Math.round((done / s.sprint.length) * 100))}<div class="panel-sub">${done} из ${s.sprint.length}</div>` : ''}
        </section>
        <div class="scroll-area" data-scroll="sprint">
            <div class="list">${items || empty('На сегодня пусто. Добавь задачу через + или отправь её из Backlog.')}</div>
            ${ro ? '' : `<p class="hint">Выполненное уберётся ночью (в 04:00). Задача, которая ${STRIKE_LIMIT} дня подряд остаётся невыполненной, уезжает в Dump → Невыполненное.</p>`}
        </div>
    </div>`;
}

// ================= BACKLOG =================
const inSprint = (s, pred) => s.sprint.some((t) => t.source && pred(t.source));

export function hotCount(s, cat) {
    const inCat = (x) => cat === 'all' || x.category === cat;
    return s.cards.filter((c) => inCat(c) && !isCardDone(c) && deadlineInfo(c.due).level === 'hot').length
        + s.rows.filter((r) => inCat(r) && deadlineInfo(r.due).level === 'hot').length;
}

export function renderBacklogChips(s, ro) {
    const cats = ['all', ...s.categories];
    return `<div class="chips-scroll">
        ${cats.map((c) => {
            const n = hotCount(s, c);
            return `<button class="chip ${view.backlogFilter === c ? 'is-active' : ''}" data-act="filter" data-cat="${esc(c)}">
                ${c === 'all' ? 'Все' : esc(c)}${n ? `<span class="badge">${n}</span>` : ''}</button>`;
        }).join('')}
        ${ro ? '' : `<button class="chip chip-ghost" data-act="add-category" title="Новая категория">＋</button>
                     <button class="chip chip-ghost" data-act="manage-categories" title="Изменить категории">✎</button>`}
    </div>`;
}

function cardHtml(s, c, ro) {
    const dl = deadlineInfo(c.due);
    const { done, total, pct } = cardProgress(c);
    const subs = c.subtasks.map((st) => {
        const queued = inSprint(s, (src) => src.kind === 'sub' && src.id === st.id);
        let tail = '';
        if (!ro && !st.done) {
            tail = queued
                ? '<span class="tag-sprint">в спринте</span>'
                : `<button class="to-sprint" data-act="sub-to-sprint" data-card="${c.id}" data-id="${st.id}" title="В спринт">↗</button>`;
        }
        return `<div class="sub ${st.done ? 'is-done' : ''}">
            <button class="check sm" data-act="toggle-sub" data-card="${c.id}" data-id="${st.id}" aria-label="Отметить"></button>
            <span class="sub-text">${esc(st.text)}</span>${tail}
        </div>`;
    }).join('');

    return `
        <div class="flip ${view.flipped.has(c.id) ? 'is-flipped' : ''} ${isCardDone(c) ? 'is-complete' : ''}" data-act="flip" data-id="${c.id}">
            <div class="flip-inner">
                <div class="flip-face">
                    <div class="card-top">
                        <span class="pill">${esc(c.category || '—')}</span>
                        <span class="dl dl-${dl.level}"><i class="dot"></i>${esc(dl.label)}</span>
                    </div>
                    <h4 class="card-title">${esc(c.title)}</h4>
                    <div>
                        ${bar(pct)}
                        <div class="card-foot"><span>${total ? `${done}/${total} · ${pct}%` : 'нет подпунктов'}</span><span class="accent">↻</span></div>
                    </div>
                </div>
                <div class="flip-face flip-back">
                    <div class="card-top">
                        <span class="card-back-title">${esc(c.title)}</span>
                        ${ro ? '' : editBtn('edit-card', `data-id="${c.id}"`)}
                    </div>
                    <div class="subs">${subs || '<span class="muted small">Подпунктов нет</span>'}</div>
                    ${ro ? '' : `<button class="sub-add" data-act="add-sub" data-id="${c.id}">＋ подпункт</button>`}
                </div>
            </div>
        </div>`;
}

function rowHtml(s, r, ro) {
    const dl = deadlineInfo(r.due);
    const queued = inSprint(s, (src) => src.kind === 'row' && src.id === r.id);
    const meta = [view.backlogFilter === 'all' && r.category ? esc(r.category) : '', esc(dl.label)].filter(Boolean).join(' · ');
    return `
        <div class="item">
            <i class="dot dot-${dl.level}"></i>
            <div class="item-main">
                <span class="item-text">${esc(r.title)}</span>
                <span class="item-meta">${meta}</span>
            </div>
            ${queued ? '<span class="tag-sprint">в спринте</span>'
                : ro ? '' : `<button class="btn-mini" data-act="row-to-sprint" data-id="${r.id}">В спринт ↗</button>`}
            ${ro ? '' : editBtn('edit-row', `data-id="${r.id}"`)}
        </div>`;
}

export function renderBacklog(s, ro) {
    const f = view.backlogFilter;
    const inCat = (x) => f === 'all' || x.category === f;
    const byDue = (a, b) => deadlineInfo(a.due).sort - deadlineInfo(b.due).sort;
    const cards = s.cards.filter(inCat).sort((a, b) => (isCardDone(a) - isCardDone(b)) || byDue(a, b));
    const rows = s.rows.filter(inCat).sort(byDue);

    // Карточки и строчки крутятся каждые в своём контейнере, страница остаётся на месте
    return `<div class="pane">
        <div class="section-head"><span class="kicker">Карточки · ${cards.length}</span></div>
        <div class="scroll-area scroll-cards" data-scroll="cards">
            ${cards.length ? `<div class="card-grid">${cards.map((c) => cardHtml(s, c, ro)).join('')}</div>`
                : empty('Крупных задач нет. Карточка — то, что закрывается через подпункты.')}
        </div>
        <div class="section-head">
            <span class="kicker">Строчки · ${rows.length}</span>
            ${ro ? '' : '<button class="btn-mini" data-act="add-row">＋ Строчка</button>'}
        </div>
        <div class="scroll-area scroll-rows" data-scroll="rows">
            <div class="list">${rows.map((r) => rowHtml(s, r, ro)).join('') || empty('Простых задач нет.')}</div>
        </div>
    </div>`;
}

// ================= DUMP =================
export function renderDump(s, ro) {
    const tabs = `
        <div class="segmented">
            <button class="${view.dumpSub === 'thoughts' ? 'is-active' : ''}" data-act="dump-sub" data-sub="thoughts">Мысли</button>
            <button class="${view.dumpSub === 'failed' ? 'is-active' : ''}" data-act="dump-sub" data-sub="failed">
                Невыполненное${s.failed.length ? `<span class="badge">${s.failed.length}</span>` : ''}</button>
        </div>`;

    if (view.dumpSub === 'failed') {
        const items = s.failed.map((f) => `
            <div class="item">
                <div class="item-main">
                    <span class="item-text">${esc(f.text)}</span>
                    <span class="item-meta">${STRIKE_LIMIT} дня в спринте без результата</span>
                </div>
                ${ro ? '' : `<button class="btn-mini" data-act="failed-to-backlog" data-id="${f.id}">В бэклог</button>
                             <button class="icon-btn danger" data-act="failed-delete" data-id="${f.id}" title="Выбросить">✕</button>`}
            </div>`).join('');
        return `<div class="pane">${tabs}
            <p class="hint">Если задача ${STRIKE_LIMIT} дня подряд не сдвинулась — скорее всего, это мусор. Либо честно верни её в бэклог, либо выброси.</p>
            <div class="scroll-area" data-scroll="failed">
                <div class="list">${items || empty('Пусто — все задачи доходят до конца 👌')}</div>
            </div>
            ${s.failed.length && !ro ? '<button class="btn-wide danger" data-act="failed-clear">Очистить всё</button>' : ''}
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
                <span class="muted small">${left <= 1 ? 'исчезнет этой ночью' : `исчезнет через ${left} дн`}</span>
            </div>
            <div class="list">${notes.map((d) => `
                <div class="dump-note">
                    <div class="dump-text">${esc(d.text)}</div>
                    <div class="dump-actions">
                        <span class="muted small">${formatTime(d.createdAt)}</span>
                        ${ro ? '' : `<button class="btn-mini" data-act="dump-to-feed" data-id="${d.id}">В ленту ↗</button>
                                     <button class="icon-btn danger" data-act="dump-delete" data-id="${d.id}" title="Удалить">✕</button>`}
                    </div>
                </div>`).join('')}
            </div>`;
    }).join('');

    return `<div class="pane">${tabs}
        ${ro ? '' : `
            <div class="panel composer">
                <textarea id="dumpInput" rows="4" placeholder="Всё, что крутится в голове. Без фильтра и без оформления.">${esc(view.dumpDraft)}</textarea>
                <button class="btn-wide" data-act="dump-save">Выгрузить</button>
            </div>`}
        <div class="scroll-area" data-scroll="dump">
            ${groupsHtml || empty(`Голова чистая. Записи хранятся ${DUMP_TTL_DAYS} дня, потом исчезают — ценное успей отправить в ленту.`)}
        </div>
    </div>`;
}

// ================= НАСТРОЙКИ =================
// Блок синхронизации рендерится отдельно: его статус меняется в фоне, а остальные настройки — нет
export function renderSyncSection(st) {
    const time = st.lastSync ? st.lastSync.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
    let body;
    if (st.state === 'off') {
        body = '<p class="muted small">Не настроена: нужны ключи Supabase в js/config.js.</p>';
    } else if (st.state === 'signed-out') {
        body = `
            <p class="muted small">Войди по почте — и лента, задачи, архив и файлы будут одинаковыми на телефоне и ноутбуке.</p>
            <label class="field"><input type="email" id="syncEmail" placeholder="почта@example.com" autocomplete="email"></label>
            <button class="btn-wide primary" data-act="sync-login">Прислать письмо для входа</button>`;
    } else if (st.state === 'code-sent') {
        body = `
            <p class="muted small">Письмо ушло на ${esc(st.pendingEmail)}. Нажми «Sign in» в письме — или, если приложение открыто с экрана «Домой», зажми ссылку, скопируй и вставь сюда.</p>
            <label class="field"><input type="text" id="syncCode" autocomplete="one-time-code" placeholder="Ссылка из письма"></label>
            <button class="btn-wide primary" data-act="sync-verify">Войти</button>
            <button class="btn-wide ghost" data-act="sync-cancel">Другая почта</button>`;
    } else {
        const line = {
            syncing: '<span class="sync-dot is-busy"></span>Синхронизация…',
            ok: `<span class="sync-dot is-ok"></span>Синхронизировано${time ? ` в ${time}` : ''}`,
            error: `<span class="sync-dot is-error"></span>Ошибка: ${esc(st.error)}`,
        }[st.state] || '';
        body = `
            <div class="item">
                <div class="item-main">
                    <span class="item-text">${esc(st.email)}</span>
                    <span class="item-meta sync-line">${line}</span>
                </div>
                <button class="btn-mini" data-act="sync-now">Сейчас</button>
            </div>
            ${st.warning ? `<p class="muted small hot">${esc(st.warning)}</p>` : ''}
            <button class="btn-wide ghost" data-act="sync-logout">Выйти из аккаунта</button>`;
    }
    return `<span class="kicker">Синхронизация</span>${body}`;
}

export function renderSettings(s, archive, hasWallpaper, syncSt) {
    return `
        <div class="modal-header"><h3>Настройки</h3><button class="close-btn" data-act="close-modal">×</button></div>

        <div class="settings-section" id="syncSection">${renderSyncSection(syncSt)}</div>

        <div class="settings-section">
            <span class="kicker">Обои</span>
            <label class="btn-wide">Загрузить картинку<input type="file" id="bgFileInput" accept="image/*" hidden></label>
            ${hasWallpaper ? '<button class="btn-wide ghost" data-act="reset-wallpaper">Убрать обои</button>' : ''}
        </div>

        <div class="settings-section">
            <span class="kicker">Сезон</span>
            <div class="item">
                <div class="item-main">
                    <span class="item-text">${esc(s.season.name)}</span>
                    <span class="item-meta">${esc(SEASON_KINDS[s.season.kind])} · с ${new Date(s.season.startedAt).toLocaleDateString('ru-RU')}</span>
                </div>
                ${editBtn('edit-season', '')}
            </div>
            <button class="btn-wide" data-act="close-season">Закрыть сезон и отправить в архив</button>
        </div>

        <div class="settings-section">
            <span class="kicker">Архив сезонов</span>
            ${archive.length ? archive.map((a) => `
                <div class="item">
                    <div class="item-main">
                        <span class="item-text">${esc(a.state.season?.name || 'Сезон')}</span>
                        <span class="item-meta">${(a.state.posts || []).length} постов · закрыт ${new Date(a.closedAt).toLocaleDateString('ru-RU')}</span>
                    </div>
                    <button class="btn-mini" data-act="open-archive" data-id="${a.id}">Открыть</button>
                    <button class="icon-btn danger" data-act="delete-archive" data-id="${a.id}" title="Удалить">✕</button>
                </div>`).join('') : '<p class="muted small">Закрытых сезонов пока нет.</p>'}
        </div>

        <div class="settings-section">
            <span class="kicker">Теги ленты</span>
            <div class="chips-wrap">${s.tags.map((t) => `<span class="chip">#${esc(t)}</span>`).join('') || '<span class="muted small">нет</span>'}</div>
            <button class="btn-wide ghost" data-act="manage-tags">Изменить список тегов</button>
        </div>

        <div class="settings-section">
            <span class="kicker">Данные</span>
            <p class="muted small">Резервная копия в файл: тексты, задачи и архив. Фото, видео и файлы в неё не входят — их сохраняет синхронизация.</p>
            <button class="btn-wide ghost" data-act="export">Скачать резервную копию</button>
            <label class="btn-wide ghost">Восстановить из файла<input type="file" id="importInput" accept="application/json,.json" hidden></label>
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
                || '<span class="muted small">Список тегов пуст — добавь их в настройках</span>'}</div></div>`;
        case 'attachments':
            return `<div class="field">${label}
                <div id="attList" class="att-list">${renderAttList(f.value || [])}</div>
                <label class="btn-wide ghost attach-btn">📎 Фото, видео, аудио или файл<input type="file" id="attInput" multiple hidden></label>
            </div>`;
        case 'checkbox':
            return `<label class="field field-check"><input type="checkbox" name="${f.name}" ${f.value ? 'checked' : ''}><span>${esc(f.label)}</span></label>`;
        default:
            return `<label class="field">${label}<input type="${f.type || 'text'}" name="${f.name}" value="${esc(f.value || '')}" placeholder="${esc(f.placeholder || '')}" autocomplete="off"></label>`;
        }
    };
    return `
        <form id="formEl" novalidate>
            <div class="modal-header"><h3>${esc(cfg.title)}</h3><button type="button" class="close-btn" data-act="close-modal">×</button></div>
            ${cfg.note ? `<p class="muted small">${esc(cfg.note)}</p>` : ''}
            ${cfg.fields.map(field).join('')}
            <div class="form-actions">
                ${cfg.onDelete ? `<button type="button" class="btn-wide danger" data-act="form-delete">${esc(cfg.deleteLabel || 'Удалить')}</button>` : ''}
                <button type="submit" class="btn-wide primary">${esc(cfg.submitLabel || 'Сохранить')}</button>
            </div>
        </form>`;
}
