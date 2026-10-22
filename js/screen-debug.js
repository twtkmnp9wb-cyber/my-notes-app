// Диагностика экрана: линейка поверх приложения + размеры, которые сообщает браузер.
// Нужна, чтобы по одному скрину понять, где iOS размывает край экрана и куда уходит место снизу.
// Открывается из настроек — работает и в приложении с экрана «Домой», где нет адресной строки.
export function openScreenDebug() {
    document.getElementById('screenDebug')?.remove();

    const probe = (css) => {
        const el = document.createElement('div');
        el.style.cssText = `position:fixed;left:0;top:0;width:1px;visibility:hidden;${css}`;
        document.body.appendChild(el);
        return el;
    };
    const insets = probe('padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)');
    const units = Object.fromEntries(['dvh', 'svh', 'lvh', 'vh'].map((u) => {
        const el = probe(`height:100${u}`);
        const h = Math.round(el.getBoundingClientRect().height);
        el.remove();
        return [u, h];
    }));
    const cs = getComputedStyle(insets);
    const box = (sel) => {
        const r = document.querySelector(sel)?.getBoundingClientRect();
        return r ? `${Math.round(r.top)}…${Math.round(r.bottom)}` : '—';
    };
    const rows = [
        ['Режим', document.documentElement.classList.contains('is-standalone') ? 'с экрана «Домой»' : 'вкладка браузера'],
        ['safe-area сверху / снизу', `${cs.paddingTop} / ${cs.paddingBottom}`],
        ['innerHeight', `${innerHeight}`],
        ['100dvh / svh / lvh / vh', `${units.dvh} / ${units.svh} / ${units.lvh} / ${units.vh}`],
        ['screen', `${screen.width}×${screen.height}`],
        ['body', box('body')],
        ['меню (сверху…снизу)', box('.menu-list')],
        ['обои', box('#bgLayer')],
    ];
    insets.remove();

    const overlay = document.createElement('div');
    overlay.id = 'screenDebug';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:5000;background:rgba(10,10,10,0.92);color:#fff;font:13px/1.3 -apple-system,system-ui,sans-serif;overflow:hidden;';
    const height = Math.max(innerHeight, units.lvh, screen.height) + 20;
    let ticks = '';
    for (let y = 0; y <= height; y += 10) {
        const major = y % 50 === 0;
        ticks += `<div style="position:absolute;left:0;right:0;top:${y}px;border-top:1px solid ${major ? '#34d399' : 'rgba(255,255,255,0.22)'}">
            ${y % 20 === 0 ? `<span style="position:absolute;left:6px;top:-9px;font-weight:600;font-size:12px;background:#0a0a0a;padding:0 3px;color:${major ? '#34d399' : '#fff'}">${y}</span>` : ''}
        </div>`;
    }
    overlay.innerHTML = `
        ${ticks}
        <div style="position:absolute;left:0;right:0;top:${units.dvh - 4}px;height:4px;background:#fbbf24"></div>
        <div style="position:absolute;left:60px;right:10px;top:150px;background:#1d1d1d;border:1px solid #333;border-radius:14px;padding:12px;font-size:13px">
            ${rows.map(([k, v]) => `${k}: <b style="color:#34d399">${v}</b>`).join('<br>')}
            <br><br><span style="color:#aaa">Жёлтая линия — низ 100dvh. Сделай скрин целиком и пришли.</span>
            <button id="screenDebugClose" style="display:block;width:100%;margin-top:12px;padding:10px;border-radius:10px;border:none;background:#fff;color:#000;font-weight:600">Закрыть</button>
        </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#screenDebugClose').onclick = () => overlay.remove();
}
