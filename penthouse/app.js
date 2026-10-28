// Проект «Пентхаус»: трекер уборки кухни для комнат 70–74.
// Данные — лента событий в Supabase (penthouse/setup.sql), очки и тир-лист сайт считает из неё сам.
// Тот же проект Supabase, что и у Монитора Души, но свои таблицы dorm_*.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../js/config.js';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, detectSessionInUrl: true } });

const ROOMS = [70, 71, 72, 73, 74];
const SECTIONS = [[70, 71], [72, 73], [74]];
const ZONES = [
    { name: 'Плита и столы', hint: 'плита, столешницы, микроволновка' },
    { name: 'Раковина и мусорка', hint: 'раковина, сушилка, мусор каждый день' },
    { name: 'Холодильник и пол', hint: 'выкинуть просрочку, протереть полки, помыть пол' },
    { name: 'Коридор и подоконник', hint: 'пол в коридоре, подоконник, выключатели' },
    { name: 'Проверяющие', hint: 'зоны нет, зато вы засчитываете заявки остальных' },
];
const CHECKER_ZONE = 4;
const ACTIONS = {
    zone: { label: 'Зона недели сделана', points: 10 },
    trash: { label: 'Вынесли мусор', points: 3 },
    stove: { label: 'Протёрли плиту / столы', points: 2 },
    foreign: { label: 'Помыли чужое', points: 2 },
    bath: { label: 'Помыли санузел секции', points: 3 },
};
const MESS_POINTS = -5;
const REJECT_STEP = 5; // n-й отказ за 14 дней стоит −5·n
const GOAL = 60;
const UPGRADES = [
    { name: 'Мусорка с педалью и крышкой', price: 1500, icon: '🗑️' },
    { name: 'Нормальная сушилка для посуды', price: 1200, icon: '🍽️' },
    { name: 'Органайзеры: полка на каждую комнату', price: 1000, icon: '🧺' },
    { name: 'Тёплая LED-лента над столом', price: 800, icon: '💡' },
    { name: 'Шторы или рулонка', price: 1500, icon: '🪟' },
    { name: 'Тёплая лампа / абажур', price: 1200, icon: '🛋️' },
    { name: 'Арт-стена: постеры в рамках', price: 1000, icon: '🖼️' },
    { name: 'Растения, которые не убить', price: 1500, icon: '🪴' },
    { name: 'Пуфы или барные табуреты', price: 3000, icon: '🪑' },
    { name: 'Кофе-зона: френч-пресс, кружки, полка', price: 3000, icon: '☕' },
];

const HOUR = 3600e3;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const WINDOW = 14 * DAY;
const MSK = 3 * HOUR;
// Понедельник 26.10.2026, 00:00 по Москве — неделя ротации 0. Должно совпадать с dorm_week() в setup.sql.
const EPOCH = Date.UTC(2026, 9, 26) - MSK;

const mod = (a, n) => ((a % n) + n) % n;
const weekOf = (t) => Math.floor((t - EPOCH) / WEEK);
const weekStart = (w) => EPOCH + w * WEEK;
const zoneOf = (room, w) => mod(ROOMS.indexOf(room) + w, ZONES.length);
const checkerOf = (w) => ROOMS.find((r) => zoneOf(r, w) === CHECKER_ZONE);
const sectionOf = (room) => SECTIONS.find((s) => s.includes(room));
const bathOwner = (section, w) => section[mod(w, section.length)];

const state = { user: null, me: null, members: [], events: [] };
const $ = (id) => document.getElementById(id);

// ---------- Очки ----------

function analyze(now = Date.now()) {
    const claims = new Map();
    const verdicts = new Map(); // id заявки → событие confirm/reject
    const rejectsByRoom = new Map();
    const penalty = new Map(); // id отказа → штраф
    for (const e of state.events) {
        e.t = Date.parse(e.created_at);
        if (e.kind === 'claim') claims.set(e.id, e);
        if (e.kind === 'confirm' || e.kind === 'reject') verdicts.set(e.ref, e);
        if (e.kind === 'reject') {
            const list = rejectsByRoom.get(e.target_room) || [];
            list.push(e.t);
            penalty.set(e.id, REJECT_STEP * list.filter((t) => t > e.t - WINDOW).length);
            rejectsByRoom.set(e.target_room, list);
        }
    }

    const scoreBetween = (from, to) => {
        const s = Object.fromEntries(ROOMS.map((r) => [r, 0]));
        for (const e of state.events) {
            if (e.t < from || e.t >= to) continue;
            if (e.kind === 'confirm') s[e.target_room] += ACTIONS[claims.get(e.ref)?.action]?.points || 0;
            if (e.kind === 'reject') s[e.target_room] -= penalty.get(e.id);
            if (e.kind === 'mess') s[e.target_room] += MESS_POINTS;
        }
        return s;
    };

    const w = weekOf(now);
    const scores = scoreBetween(now - WINDOW, now + 1);
    const lastWeek = scoreBetween(weekStart(w - 1), weekStart(w));
    const hadHistory = state.events.some((e) => e.t < weekStart(w));
    const worst = hadHistory
        ? [...ROOMS].sort((a, b) => lastWeek[a] - lastWeek[b] || scores[a] - scores[b] || a - b)[0]
        : null;
    const purchases = state.events.filter((e) => e.kind === 'purchase');
    const pending = [...claims.values()].filter((c) => !verdicts.has(c.id));
    const nextPenalty = (room) => REJECT_STEP * ((rejectsByRoom.get(room) || []).filter((t) => t > now - WINDOW).length + 1);

    return { w, scores, lastWeek, worst, purchases, pending, claims, verdicts, penalty, nextPenalty };
}

function rank(pct) {
    if (pct >= 100) return { tier: 'S', title: 'Пентхаус 👑' };
    if (pct >= 75) return { tier: 'A', title: 'Евроремонт' };
    if (pct >= 50) return { tier: 'B', title: 'Терпимо' };
    if (pct >= 25) return { tier: 'C', title: 'Обычная общага' };
    if (pct >= 0) return { tier: 'D', title: 'Хрущёвка-засранка' };
    if (pct > -25) return { tier: '☠', title: 'Помойка 🗑️' };
    if (pct > -50) return { tier: '☠', title: 'Чумной барак 🦠' };
    return { tier: '☠', title: 'Чернобыль 2.0 ☢️' };
}
const TIER_COLORS = { S: '#ffcf5a', A: '#8be08b', B: '#c7e07a', C: '#f0c060', D: '#e8875a', '☠': '#7d1d16' };

// ---------- Отрисовка ----------

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const names = (room) => state.members.filter((m) => m.room === room).map((m) => esc(m.name)).join(', ');
const nameOf = (uid) => esc(state.members.find((m) => m.user_id === uid)?.name || 'кто-то');
const dateMsk = (t) => {
    const d = new Date(t + MSK);
    return `${d.getUTCDate()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
function ago(t) {
    const m = Math.round((Date.now() - t) / 60e3);
    if (m < 1) return 'только что';
    if (m < 60) return `${m} мин назад`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} ч назад`;
    return `${Math.round(h / 24)} дн назад`;
}
const signed = (n) => (n > 0 ? `+${n}` : String(n).replace('-', '−'));

function render() {
    const a = analyze();
    const me = state.me;
    const checker = checkerOf(a.w);

    $('who').innerHTML = `${esc(me.name)} · ${me.room} <button class="link" id="logout">выйти</button>`;
    $('logout').onclick = () => sb.auth.signOut();

    // Неделя
    const myBath = bathOwner(sectionOf(me.room), a.w) === me.room;
    $('week').innerHTML = `
        <div class="title">Неделя ${dateMsk(weekStart(a.w))} – ${dateMsk(weekStart(a.w + 1) - DAY)}</div>
        <div>Проверяют заявки: <b>комната ${checker}</b>${checker === me.room ? ' <span class="mine">— это вы</span>' : ''}</div>
        <div class="mine">Ваша зона: ${ZONES[zoneOf(me.room, a.w)].name} — ${ZONES[zoneOf(me.room, a.w)].hint}</div>
        <div class="muted">Санузел секции на этой неделе: ${myBath ? 'моете вы' : `моет ${bathOwner(sectionOf(me.room), a.w)}`}</div>`;

    // Тир-лист
    const pct = (r) => Math.round((a.scores[r] / GOAL) * 100);
    const sorted = [...ROOMS].sort((x, y) => a.scores[y] - a.scores[x] || x - y);
    $('tiers').innerHTML = ['S', 'A', 'B', 'C', 'D', '☠'].map((tier) => {
        const rooms = sorted.filter((r) => rank(pct(r)).tier === tier);
        return `<div class="tier">
            <div class="letter" style="background:${TIER_COLORS[tier]};${tier === '☠' ? 'color:#ffd2c8' : ''}">${tier}</div>
            <div class="slot">${rooms.map((r) => `<span class="chip${r === me.room ? ' me' : ''}">${r} · ${rank(pct(r)).title}</span>`).join('')}</div>
        </div>`;
    }).join('');

    // Комнаты
    const now = Date.now();
    const zoneClaimed = state.events.some((e) => e.kind === 'claim' && e.action === 'zone' && e.room === me.room
        && weekOf(Date.parse(e.created_at)) === a.w && a.verdicts.get(e.id)?.kind !== 'reject');
    const messedRecently = (room) => state.events.some((e) => e.kind === 'mess' && e.room === me.room
        && e.target_room === room && Date.parse(e.created_at) > now - 12 * HOUR);
    $('rooms').innerHTML = sorted.map((r) => {
        const p = pct(r);
        const { title } = rank(p);
        const hue = Math.max(0, Math.min(120, p * 1.2));
        const fill = p >= 0
            ? `<div class="fill" style="width:${Math.min(100, p)}%;background:hsl(${hue} 65% 48%)"></div>`
            : `<div class="fill neg" style="width:${Math.min(100, -p)}%"></div>`;
        const section = sectionOf(r);
        const bath = section.length === 1 ? 'санузел свой, каждую неделю'
            : bathOwner(section, a.w) === r ? 'санузел секции на этой неделе' : 'санузел — на следующей неделе';
        let actions = '';
        if (r === me.room) {
            actions = Object.entries(ACTIONS).filter(([key]) => (key !== 'zone' || zoneOf(r, a.w) !== CHECKER_ZONE)
                && (key !== 'bath' || bathOwner(section, a.w) === r))
                .map(([key, act]) => `<button class="btn good small" data-claim="${key}" ${key === 'zone' && zoneClaimed ? 'disabled' : ''}>${act.label} +${act.points}</button>`)
                .join('');
        } else {
            actions = `<button class="btn bad small" data-mess="${r}" ${messedRecently(r) ? 'disabled' : ''}>Оставили бардак ${signed(MESS_POINTS)}</button>`;
        }
        return `<div class="card room${r === me.room ? ' me' : ''}">
            <div class="room-head"><span class="room-num">${r}</span><span class="room-title">${title}</span></div>
            <div class="people">${names(r) || 'пока никто не заселился'}</div>
            <div class="bar">${fill}</div>
            <div class="score"><span>${signed(a.scores[r])} очков</span><span>${signed(p).replace('+', '')}%${p > 100 ? ' 🚀' : ''}</span></div>
            <div class="duty"><span>Зона: ${ZONES[zoneOf(r, a.w)].name}</span><span class="muted">${bath}</span></div>
            <div class="actions">${actions}</div>
        </div>`;
    }).join('');

    // Заявки
    const canReview = (c) => c.room !== me.room && (me.room === checker || c.room === checker);
    $('pending').innerHTML = a.pending.length ? `<div class="list">${a.pending.map((c) => `
        <div class="item">
            <div class="what"><b>${c.room}</b> · ${ACTIONS[c.action].label} <b>+${ACTIONS[c.action].points}</b>
                <div class="when">${nameOf(c.user_id)} · ${ago(Date.parse(c.created_at))}</div></div>
            ${canReview(c) ? `<div class="row">
                <button class="btn good small" data-confirm="${c.id}">Подтвердить</button>
                <button class="btn bad small" data-reject="${c.id}">Не засчитывать (−${a.nextPenalty(c.room)})</button>
            </div>` : `<span class="when">ждёт комнату ${c.room === checker ? 'любую другую' : checker}</span>`}
        </div>`).join('')}</div>` : '<p class="muted">Всё проверено.</p>';

    renderBuild(a);
    renderFeed(a);
}

function renderBuild(a) {
    const bought = a.purchases.length;
    const next = UPGRADES[bought];
    const floors = UPGRADES.map((u, i) => `<div class="floor${i < bought ? ' lit' : ''}">${i < bought ? u.icon : ''}</div>`).join('');
    const top = `<div class="floor top${bought === UPGRADES.length ? ' lit' : ''}">👑</div>`;
    const purchasedThisWeek = a.purchases.some((p) => p.week === a.w - 1);

    let buyer = '';
    if (!next) buyer = '<div class="buyer"><b>Пентхаус построен 👑</b> Держите чистоту — и придумывайте следующий этаж.</div>';
    else if (a.worst == null) buyer = '<div class="buyer muted">Итоги недели появятся в понедельник, когда будет история. Худшая комната недели покупает следующую вещь.</div>';
    else if (purchasedThisWeek) buyer = `<div class="buyer">За прошлую неделю уже куплено. Следующие итоги — в понедельник.</div>`;
    else {
        buyer = `<div class="buyer">
            <div>Худшая комната прошлой недели: <b>${a.worst}</b> (${signed(a.lastWeek[a.worst])} очков). Покупает: <b>${next.icon} ${next.name}</b>, ~${next.price.toLocaleString('ru')} ₽</div>
            ${state.me.room === a.worst ? `<button class="btn primary" data-buy="${bought}">Куплено ✔</button>` : '<div class="muted">Покупку отмечает сама комната. Чек или фото — в общий чат.</div>'}
        </div>`;
    }

    $('build').innerHTML = `
        <div class="tower">${floors}${top}</div>
        <div>
            <div><b>${bought} из ${UPGRADES.length}</b> апгрейдов · стиль «тёплый лофт»</div>
            <div class="bar" style="margin-top:8px"><div class="fill" style="width:${(bought / UPGRADES.length) * 100}%;background:var(--accent)"></div></div>
            <ul class="upgrades">${UPGRADES.map((u, i) => `<li class="${i < bought ? 'done' : i === bought ? 'next' : ''}">
                <span>${i < bought ? '✔' : u.icon} ${u.name}</span><span class="price">~${u.price.toLocaleString('ru')} ₽</span></li>`).join('')}</ul>
            <div style="margin-top:12px">${buyer}</div>
        </div>`;
}

function renderFeed(a) {
    const describe = (e) => {
        const who = `${nameOf(e.user_id)} (${e.room})`;
        if (e.kind === 'claim') return `${who}: ${ACTIONS[e.action].label}${a.verdicts.has(e.id) ? '' : ' — на проверке'}`;
        if (e.kind === 'confirm') return `${who} засчитал(а) комнате ${e.target_room}: ${ACTIONS[a.claims.get(e.ref)?.action]?.label || 'дело'} +${ACTIONS[a.claims.get(e.ref)?.action]?.points || 0}`;
        if (e.kind === 'reject') return `${who} не засчитал(а) комнате ${e.target_room}: −${a.penalty.get(e.id)}`;
        if (e.kind === 'mess') return `${who}: комната ${e.target_room} оставила бардак ${signed(MESS_POINTS)}`;
        if (e.kind === 'purchase') return `${who} купили: ${UPGRADES[e.item]?.icon || ''} ${UPGRADES[e.item]?.name || 'вещь'}`;
        return '';
    };
    const last = state.events.slice(-30).reverse();
    $('feed').innerHTML = last.length
        ? `<div class="list">${last.map((e) => `<div class="item"><div class="what">${describe(e)}</div><span class="when">${ago(Date.parse(e.created_at))}</span></div>`).join('')}</div>`
        : '<p class="muted">Пока пусто. Начните с кнопок в карточке своей комнаты.</p>';
}

function renderStatic() {
    $('ideas').innerHTML = `
        <p><b>Стиль: тёплый лофт.</b> Тёплый свет вместо белого, дерево, зелень, чёрный металл и пустые столы.</p>
        <div class="palette">
            <span style="background:#f3ebe1" title="тёплый белый"></span><span style="background:#b07a4a" title="дерево"></span>
            <span style="background:#4f6b45" title="зелень"></span><span style="background:#22201d" title="чёрный металл"></span>
            <span style="background:#f0a84a" title="тёплый свет"></span>
        </div>
        <p><b>Бесплатно, уже на этой неделе:</b></p>
        <ul class="ideas-list">
            <li>Пустой подоконник и столы: всё, что не нужно каждый день, — в шкаф.</li>
            <li>Подписать полки холодильника по комнатам, раз в неделю зона «Холодильник» выкидывает просрочку.</li>
            <li>Коробка «ничьё»: брошенная посуда едет туда, в воскресенье — мыть или выкинуть.</li>
            <li>Одна губка и одно средство на всех, висят на виду, а не валяются в раковине.</li>
            <li>Снять со стен старые объявления и скотч — стены сразу выглядят на ремонт дороже.</li>
        </ul>
        <p style="margin-top:10px"><b>Дальше — по списку стройки:</b> каждый понедельник худшая комната покупает следующую вещь.</p>`;

    $('rules').innerHTML = `<ul>
        <li><b>Приготовил — помыл и протёр в тот же день.</b> Не помыл — соседи жмут «Оставили бардак» (${signed(MESS_POINTS)}).</li>
        <li>Зоны каждую неделю сдвигаются по кругу: за 5 недель каждая комната побывает в каждой зоне.</li>
        <li>Комната на «проверке» отдыхает от зоны и засчитывает заявки остальных. Её собственные заявки засчитывает любая другая комната.</li>
        <li>Санузлы по секциям: 70 и 71 чередуются по неделям, 72 и 73 тоже, 74 моет свой сама.</li>
        <li>Очки начисляются только после подтверждения. Липовая заявка — штраф, и он растёт: 1-й отказ за 14 дней −5, 2-й −10, 3-й −15…</li>
        <li>Считаются очки за последние 14 дней, цель — 60 (100%). Бросили убираться — бар сам ползёт вниз. Очки могут уйти в минус.</li>
        <li>Каждый понедельник худшая комната прошлой недели покупает следующую вещь для пентхауса.</li>
    </ul>`;
}

// ---------- Данные ----------

async function loadAll() {
    const events = [];
    for (let from = 0; ; from += 1000) {
        const { data, error } = await sb.from('dorm_events').select('*').order('id').range(from, from + 999);
        if (error) throw error;
        events.push(...data);
        if (data.length < 1000) break;
    }
    const { data: members, error } = await sb.from('dorm_members').select('user_id, room, name');
    if (error) throw error;
    state.events = events;
    state.members = members;
    state.me = members.find((m) => m.user_id === state.user.id) || null;
}

async function addEvent(row) {
    const { error } = await sb.from('dorm_events').insert(row);
    if (error) { toast(error.message); return; }
    await refresh();
}

let refreshing = null;
async function refresh() {
    if (!state.user) return;
    refreshing ??= (async () => {
        try {
            await loadAll();
            show(state.me ? 'main' : 'join');
            if (state.me) render();
        } catch (e) {
            toast(`Не получилось загрузить: ${e.message}`);
        } finally {
            refreshing = null;
        }
    })();
    return refreshing;
}

let channel = null;
function subscribe() {
    if (channel) return;
    channel = sb.channel('dorm')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dorm_events' }, () => refresh())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dorm_members' }, () => refresh())
        .subscribe();
}

// ---------- Экраны и кнопки ----------

function show(name) {
    for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== `screen-${name}`);
    if (name !== 'main') $('who').innerHTML = state.user ? `<button class="link" id="logout">выйти</button>` : '';
    if ($('logout')) $('logout').onclick = () => sb.auth.signOut();
}

let toastTimer;
function toast(text) {
    $('toast').textContent = text;
    $('toast').classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.add('hidden'), 4000);
}

$('auth-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const form = new FormData(ev.target);
    const email = form.get('email').trim();
    const password = form.get('password');
    const msg = $('auth-msg');
    msg.textContent = '…';
    if (ev.submitter?.value === 'up') {
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.href.split('#')[0] } });
        if (error) msg.textContent = error.message;
        else if (!data.session) msg.textContent = 'Письмо отправлено: подтверди почту по ссылке и войди.';
        else msg.textContent = '';
    } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        msg.textContent = error ? (error.message === 'Invalid login credentials' ? 'Неверная почта или пароль' : error.message) : '';
    }
});

$('join-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const form = new FormData(ev.target);
    $('join-msg').textContent = '…';
    const { error } = await sb.rpc('dorm_join', { p_room: Number(form.get('room')), p_name: form.get('name').trim(), p_code: form.get('code') });
    $('join-msg').textContent = error ? error.message : '';
    if (!error) await refresh();
});

document.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button[data-claim], button[data-mess], button[data-confirm], button[data-reject], button[data-buy]');
    if (!b || b.disabled) return;
    b.disabled = true;
    const d = b.dataset;
    if (d.claim) await addEvent({ kind: 'claim', action: d.claim, room: state.me.room });
    else if (d.mess && confirm(`Комната ${d.mess} оставила бардак? Это −5 очков им.`)) await addEvent({ kind: 'mess', target_room: Number(d.mess), room: state.me.room });
    else if (d.confirm) await addEvent({ kind: 'confirm', ref: Number(d.confirm), room: state.me.room });
    else if (d.reject && confirm('Не засчитывать и оштрафовать комнату?')) await addEvent({ kind: 'reject', ref: Number(d.reject), room: state.me.room });
    else if (d.buy && confirm(`Точно купили «${UPGRADES[d.buy].name}»?`)) await addEvent({ kind: 'purchase', item: Number(d.buy), week: weekOf(Date.now()) - 1, room: state.me.room });
    b.disabled = false;
});

document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
setInterval(() => { if (state.me && !document.hidden) render(); }, 60e3);

renderStatic();
sb.auth.onAuthStateChange((_event, session) => {
    const userId = session?.user?.id || null;
    if (userId === state.user?.id) return;
    state.user = session?.user || null;
    state.me = null;
    if (!state.user) { show('auth'); return; }
    show('loading');
    // вне колбэка: запросы к базе изнутри onAuthStateChange могут зависнуть
    setTimeout(() => { refresh(); subscribe(); }, 0);
});
