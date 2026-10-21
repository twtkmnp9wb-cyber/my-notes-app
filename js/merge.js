// Трёхстороннее слияние данных двух устройств.
// base — то, что было при последней успешной синхронизации; local — текущее на этом устройстве;
// remote — то, что сейчас в облаке. Сравнивая каждую сторону с base, понимаем, кто что поменял:
// поменяли только здесь — берём здешнее, только там — тамошнее, удалили — удаляем.
// Если одну и ту же запись поменяли на обоих устройствах, побеждает это устройство.

// В облаке JSON лежит в jsonb, который переставляет ключи — сравниваем в каноническом виде
function canon(v) {
    if (Array.isArray(v)) return v.map(canon);
    if (v && typeof v === 'object') {
        return Object.fromEntries(Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => [k, canon(v[k])]));
    }
    return v;
}
export const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

function mergeValue(b, l, r) {
    if (same(l, r)) return l;
    if (same(l, b)) return r;
    if (same(r, b)) return l;
    return l;
}

// Списки записей с id: решаем судьбу каждой записи отдельно
function mergeList(b = [], l = [], r = []) {
    const index = (arr) => new Map(arr.map((x) => [x.id, x]));
    const B = index(b);
    const L = index(l);
    const R = index(r);
    const decide = (id) => {
        const bv = B.get(id);
        const lv = L.get(id);
        const rv = R.get(id);
        if (lv === undefined) return bv !== undefined && same(rv, bv) ? undefined : rv;   // удалено здесь
        if (rv === undefined) return bv !== undefined && same(lv, bv) ? undefined : lv;   // удалено там
        return mergeValue(bv, lv, rv);
    };
    const out = [];
    const seen = new Set();
    for (const x of [...l, ...r]) {
        if (seen.has(x.id)) continue;
        seen.add(x.id);
        const v = decide(x.id);
        if (v !== undefined) out.push(v);
    }
    return out;
}

const LIST_KEYS = new Set(['posts', 'goals', 'sprint', 'cards', 'rows', 'dump', 'failed']);

function mergeState(b, l, r) {
    b = b || {};
    const out = {};
    for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
        out[k] = LIST_KEYS.has(k) ? mergeList(b[k], l[k], r[k]) : mergeValue(b[k], l[k], r[k]);
        if (out[k] === undefined) delete out[k];
    }
    return out;
}

// doc = { state, archive }
export function mergeDoc(base, local, remote) {
    return {
        state: mergeState(base?.state, local.state, remote.state || {}),
        archive: mergeList(base?.archive, local.archive, remote.archive),
    };
}
