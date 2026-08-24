import { AppState } from './state.js';

let isSearchOpen = false;
let backlogFilterVal = 'All';
let dumpSubTab = 'evening'; 
let activeDumpDay = 'day1'; 

const localAppData = {
    roadmap: [
        { id: 1, text: 'Закрыть семестр без хвостов', done: false },
        { id: 2, text: 'Прокачать физическую форму (турник х 15)', done: true },
        { id: 3, text: 'Запустить финальную версию Монитора Души', done: false }
    ],
    dumpDays: {
        day1: { title: 'День 1', notes: ['Идея для нового трека', 'Проблема с рендерингом', 'Позвонить маме'] },
        day2: { title: 'День 2', notes: ['Идея проекта фильм', 'Позвонить маме', 'Купить подарок'] },
        day3: { title: 'День 3', notes: ['Записать музыку к видео', 'Идея для стрима', 'Опубликовать в ленту'] }
    },
    uncompletedSprint: [
        { id: 301, title: 'Изучить главу 7', info: 'Просрочено' },
        { id: 302, title: 'Собрать референсы', info: '3 дня назад' },
        { id: 303, title: 'Провести встречу', info: 'Вчера' }
    ]
};

function updateTelegramSearchBar(handlers) {
    const searchBarContainer = document.getElementById('telegramSearchBarContainer');
    if (!searchBarContainer) return;
    searchBarContainer.innerHTML = '';

    if (AppState.currentTab === 'feed' && isSearchOpen) {
        const searchBar = document.createElement('div');
        searchBar.className = 'telegram-search-bar';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'telegram-search-input';
        searchInput.placeholder = 'Поиск по заметкам...';
        searchInput.value = AppState.searchQuery || '';
        
        searchInput.oninput = (e) => {
            AppState.searchQuery = e.target.value;
            const container = document.querySelector('.main-container');
            if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), handlers);
            updateTelegramSearchBar(handlers);
        };

        const notesCount = AppState.getFilteredNotes().length;
        const totalFeedCount = AppState.notes.filter(n => n.type === 'feed').length;

        const countSpan = document.createElement('span');
        countSpan.textContent = `${notesCount} из ${totalFeedCount}`;
        countSpan.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.5); white-space: nowrap;';

        const closeSearchBtn = document.createElement('button');
        closeSearchBtn.textContent = '✕';
        closeSearchBtn.style.cssText = 'background: transparent; border: none; color: rgba(255,255,255,0.6); cursor: pointer; font-size: 14px; padding: 0 4px;';
        closeSearchBtn.onclick = () => {
            isSearchOpen = false;
            AppState.searchQuery = '';
            updateTelegramSearchBar(handlers);
            const container = document.querySelector('.main-container');
            if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), handlers);
        };

        searchBar.appendChild(searchInput);
        searchBar.appendChild(countSpan);
        searchBar.appendChild(closeSearchBtn);
        searchBarContainer.appendChild(searchBar);
    }
}

function updateFooterButtonsVisibility() {
    const searchBtn = document.getElementById('searchToggleBtn');
    const addBtn = document.getElementById('addNoteBtn');
    
    if (!searchBtn || !addBtn) return;

    if (AppState.currentTab === 'feed') {
        searchBtn.style.display = 'flex';
    } else {
        searchBtn.style.display = 'none';
        isSearchOpen = false;
        const searchBarContainer = document.getElementById('telegramSearchBarContainer');
        if (searchBarContainer) searchBarContainer.innerHTML = '';
    }
    
    if (AppState.currentTab === 'roadmap' || AppState.currentTab === 'dump') {
        addBtn.style.display = 'none';
    } else {
        addBtn.style.display = 'flex';
    }
}

// Глобальные методы для безопасного доступа из DOM
window.toggleGoal = function(id) {
    const goal = localAppData.roadmap.find(g => g.id === id);
    if (goal) {
        goal.done = !goal.done;
        const container = document.querySelector('.main-container');
        if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
    }
};

window.editGoal = function(id) {
    const goal = localAppData.roadmap.find(g => g.id === id);
    if (goal) {
        const newText = prompt('Редактировать цель:', goal.text);
        if (newText !== null && newText.trim()) {
            goal.text = newText.trim();
            const container = document.querySelector('.main-container');
            if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
        }
    }
};

window.switchDumpSub = function(sub) {
    dumpSubTab = sub;
    const container = document.querySelector('.main-container');
    if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
};

window.switchDumpDay = function(day) {
    activeDumpDay = day;
    const container = document.querySelector('.main-container');
    if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
};

window.rescueDumpNote = async function(day, idx) {
    const text = localAppData.dumpDays[day].notes[idx];
    await AppState.addNote({ type: 'feed', title: 'Спасено из Dump', text: text });
    localAppData.dumpDays[day].notes.splice(idx, 1);
    const container = document.querySelector('.main-container');
    if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
};

export const UIRenderer = {
    renderList(container, notes, handlers) {
        window.currentHandlers = handlers;
        container.innerHTML = '';
        updateTelegramSearchBar(handlers);
        updateFooterButtonsVisibility();

        const manifestEl = document.getElementById('manifestSection');
        const bornToWinEl = document.getElementById('bornToWinTitle');
        if (manifestEl && bornToWinEl) {
            if (AppState.currentTab === 'feed') {
                manifestEl.style.display = 'block';
                bornToWinEl.style.display = 'block';
            } else {
                manifestEl.style.display = 'none';
                bornToWinEl.style.display = 'none';
            }
        }

        // БЭКЛОГ
        if (AppState.currentTab === 'backlog') {
            const categories = ['All', 'Study', 'Project', 'Music', 'Life'];
            const chipsContainer = document.createElement('div');
            chipsContainer.style.cssText = 'display: flex; gap: 6px; margin-bottom: 16px; width: 100%;';
            
            categories.forEach(cat => {
                const chip = document.createElement('button');
                const isActive = backlogFilterVal === cat;
                chip.textContent = cat;
                chip.style.cssText = `
                    flex: 1;
                    background: ${isActive ? '#fff' : 'rgba(255, 255, 255, 0.08)'};
                    color: ${isActive ? '#0a0a0a' : '#fff'};
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    padding: 6px 0;
                    border-radius: 9999px;
                    cursor: pointer;
                    font-size: 11px;
                    font-weight: 500;
                    text-align: center;
                    transition: all 0.2s;
                `;
                chip.onclick = () => {
                    backlogFilterVal = cat;
                    UIRenderer.renderList(container, notes, handlers);
                };
                chipsContainer.appendChild(chip);
            });
            container.appendChild(chipsContainer);

            const backlogItems = [
                { id: 1, title: 'Подготовка к зиме', category: 'Study', deadline: 'Due today', progress: 66, urgent: true },
                { id: 2, title: 'Идея для проекта - 2', category: 'Project', deadline: '2 days left', progress: 20, urgent: false },
                { id: 3, title: 'Идея для проекта', category: 'Project', deadline: '3 days left', progress: 95, urgent: false },
                { id: 4, title: 'Сделать ремонт', category: 'Life', deadline: '3 days left', progress: 10, urgent: false }
            ];
            const filteredBacklog = backlogFilterVal === 'All' ? backlogItems : backlogItems.filter(i => i.category === backlogFilterVal);

            const grid = document.createElement('div');
            grid.style.cssText = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; width: 100%;';

            filteredBacklog.forEach(item => {
                const card = document.createElement('div');
                card.style.cssText = `
                    background: rgba(255, 255, 255, 0.08);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    border-radius: 20px;
                    padding: 14px;
                    backdrop-filter: blur(16px);
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    height: 130px;
                    cursor: pointer;
                `;
                card.innerHTML = `
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <span style="font-size: 8px; text-transform: uppercase; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 99px; color: #ccc;">${item.category}</span>
                            <span style="font-size: 9px; color: ${item.urgent ? '#f43f5e; font-weight:700;' : '#ffb74d'};">${item.deadline}</span>
                        </div>
                        <h4 style="margin: 0; font-size: 13px; color: #fff; font-weight: 500; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${item.title}</h4>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <div style="width: 100%; background: rgba(255,255,255,0.1); height: 4px; border-radius: 99px; overflow: hidden;">
                            <div style="background: rgba(255,255,255,0.7); height: 100%; width: ${item.progress}%;"></div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: rgba(255,255,255,0.5);">
                            <span>${item.progress}%</span>
                            <span style="color: #6ee7b7; font-weight: 500;">В Спринт ↗</span>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });
            container.appendChild(grid);
            return;
        }

        // ROADMAP
        if (AppState.currentTab === 'roadmap') {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 24px; padding: 20px; backdrop-filter: blur(16px);';
            
            let goalsHtml = localAppData.roadmap.map(g => `
                <div style="background: rgba(255,255,255,0.05); padding: 12px 14px; border-radius: 14px; font-size: 13px; border: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
                    <span style="${g.done ? 'text-decoration: line-through; opacity: 0.5;' : ''}">${g.text}</span>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button onclick="window.editGoal(${g.id})" style="background:none; border:none; color:rgba(255,255,255,0.5); cursor:pointer; font-size:11px;">✏️</button>
                        <button onclick="window.toggleGoal(${g.id})" style="width: 16px; height: 16px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.3); background: ${g.done ? '#10b981' : 'transparent'}; cursor:pointer;"></button>
                    </div>
                </div>
            `).join('');

            wrap.innerHTML = `
                <span style="font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.5); display: block; text-align: center; margin-bottom: 4px;">Стратегия</span>
                <h3 style="margin: 0 0 16px 0; font-size: 15px; text-align: center; color: #fff; font-weight: 600;">Цели на сезон (Roadmap)</h3>
                <div style="display: flex; gap: 8px; margin-bottom: 14px;">
                    <input type="text" id="roadmapInputText" placeholder="Новая цель на сезон..." style="flex:1; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); padding:8px 12px; border-radius:12px; color:#fff; font-size:12px; outline:none;">
                    <button id="roadmapAddBtn" style="background:rgba(255,255,255,0.2); border:none; color:#fff; padding:0 14px; border-radius:12px; font-size:14px; cursor:pointer;">+</button>
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">${goalsHtml}</div>
            `;
            container.appendChild(wrap);

            setTimeout(() => {
                const addBtn = document.getElementById('roadmapAddBtn');
                if (addBtn) {
                    addBtn.onclick = () => {
                        const inp = document.getElementById('roadmapInputText');
                        if (inp && inp.value.trim()) {
                            localAppData.roadmap.push({ id: Date.now(), text: inp.value.trim(), done: false });
                            UIRenderer.renderList(container, notes, handlers);
                        }
                    };
                }
            }, 50);
            return;
        }

        // DUMP
        if (AppState.currentTab === 'dump') {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

            let daysButtonsHtml = Object.keys(localAppData.dumpDays).map(dKey => `
                <button onclick="window.switchDumpDay('${dKey}')" style="flex:1; padding: 8px; border-radius: 12px; font-size: 11px; border: 1px solid rgba(255,255,255,0.15); background: ${activeDumpDay === dKey ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)'}; color: #fff; cursor: pointer;">${localAppData.dumpDays[dKey].title}</button>
            `).join('');

            let notesHtml = (localAppData.dumpDays[activeDumpDay]?.notes || []).map((note, idx) => `
                <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 10px 14px; border-radius: 14px; display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
                    <span>${note}</span>
                    <button onclick="window.rescueDumpNote('${activeDumpDay}', ${idx})" style="font-size: 10px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #34d399; padding: 4px 8px; border-radius: 8px; cursor: pointer;">В Ленту ↗</button>
                </div>
            `).join('');

            wrap.innerHTML = `
                <div style="display: flex; gap: 6px;">
                    <button onclick="window.switchDumpSub('evening')" style="flex:1; padding: 8px; border-radius: 12px; font-size: 12px; border: 1px solid rgba(255,255,255,0.15); background: ${dumpSubTab === 'evening' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.05)'}; color: #fff; cursor: pointer;">Сброс (Dump)</button>
                    <button onclick="window.switchDumpSub('uncompleted')" style="flex:1; padding: 8px; border-radius: 12px; font-size: 12px; border: 1px solid rgba(255,255,255,0.15); background: ${dumpSubTab === 'uncompleted' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.05)'}; color: #fff; cursor: pointer;">Невыполненное</button>
                </div>

                ${dumpSubTab === 'evening' ? `
                    <div style="display: flex; gap: 6px;">${daysButtonsHtml}</div>
                    <div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; padding: 14px; backdrop-filter: blur(16px); display: flex; flex-direction: column; gap: 8px;">
                        <div style="display: flex; gap: 6px;">
                            <input type="text" id="dumpNoteInput" placeholder="Поток мыслей перед сном..." style="flex:1; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); padding:8px 12px; border-radius:12px; color:#fff; font-size:12px; outline:none;">
                            <button id="dumpAddBtn" style="background:rgba(255,255,255,0.2); border:none; color:#fff; padding:0 14px; border-radius:12px; font-size:14px; cursor:pointer;">+</button>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">${notesHtml}</div>
                    </div>
                ` : `
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${localAppData.uncompletedSprint.map(item => `
                            <div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; padding: 14px; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-size: 13px; color: #fff; font-weight: 500;">${item.title}</div>
                                    <div style="font-size: 10px; color: #f43f5e;">${item.info}</div>
                                </div>
                                <button style="font-size: 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 6px 10px; border-radius: 10px; cursor: pointer;">В Бэклог</button>
                            </div>
                        `).join('')}
                    </div>
                `}
            `;
            container.appendChild(wrap);

            setTimeout(() => {
                const dumpAddBtn = document.getElementById('dumpAddBtn');
                if (dumpAddBtn) {
                    dumpAddBtn.onclick = () => {
                        const inp = document.getElementById('dumpNoteInput');
                        if (inp && inp.value.trim()) {
                            localAppData.dumpDays[activeDumpDay].notes.push(inp.value.trim());
                            UIRenderer.renderList(container, notes, handlers);
                        }
                    };
                }
            }, 50);
            return;
        }

        // ЛЕНТА И СПРИНТ
        if (!notes || notes.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.style.cssText = 'text-align: center; color: rgba(255,255,255,0.4); margin-top: 40px; font-size: 13px;';
            emptyEl.textContent = 'Ничего не найдено';
            container.appendChild(emptyEl);
            return;
        }

        notes.forEach(note => {
            const card = document.createElement('div');
            card.className = 'note-card';
            card.style.cssText = 'cursor: pointer;';

            card.onclick = (e) => {
                if (e.target.closest('.delete-btn') || e.target.closest('.todo-checkbox') || e.target.closest('.note-media-img')) return;
                if (handlers.onEditNote) handlers.onEditNote(note);
            };

            if (note.type === 'feed') {
                let mediaHtml = '';
                if (note.media && note.media.length > 0) {
                    mediaHtml = '<div style="display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;">';
                    note.media.forEach((url, imgIdx) => {
                        mediaHtml += `<img src="${url}" class="note-media-img" data-id="${note.id}" data-imgidx="${imgIdx}" style="width: 70px; height: 70px; object-fit: cover; border-radius: 10px; cursor: pointer; border: 1px solid rgba(255,255,255,0.15);">`;
                    });
                    mediaHtml += '</div>';
                }

                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                        <h3 style="margin: 0; font-size: 15px; color: #fff; font-weight: 600;">${note.title || 'Без названия'}</h3>
                        <button class="delete-btn" data-id="${note.id}" style="background: none; border: none; color: rgba(255,255,255,0.4); cursor: pointer; font-size: 16px;">✕</button>
                    </div>
                    <p>${note.text || ''}</p>
                    ${note.hashtag ? `<span style="display: inline-block; background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 8px; font-size: 11px; color: #ddd; margin-bottom: 8px;">${note.hashtag}</span>` : ''}
                    ${mediaHtml}
                    <div style="font-size: 10px; color: rgba(255,255,255,0.4); text-align: right; margin-top: 6px;">${note.createdAt}</div>
                `;
            } else {
                let todosHtml = '';
                if (note.todos && note.todos.length > 0) {
                    todosHtml = '<div style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px;">';
                    note.todos.forEach((todo, tIdx) => {
                        todosHtml += `
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: rgba(255,255,255,0.9); cursor: pointer;">
                                <input type="checkbox" class="todo-checkbox" data-noteid="${note.id}" data-todoidx="${tIdx}" ${todo.done ? 'checked' : ''} style="cursor: pointer; accent-color: #f43f5e;">
                                <span style="${todo.done ? 'text-decoration: line-through; opacity: 0.4;' : ''}">${todo.text}</span>
                            </label>
                        `;
                    });
                    todosHtml += '</div>';
                }

                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                        <h3 style="margin: 0; font-size: 15px; color: #fff; font-weight: 600;">${note.title || 'Задача'}</h3>
                        <button class="delete-btn" data-id="${note.id}" style="background: none; border: none; color: rgba(255,255,255,0.4); cursor: pointer; font-size: 16px;">✕</button>
                    </div>
                    <p>${note.text || ''}</p>
                    ${todosHtml}
                    <div style="font-size: 10px; color: rgba(255,255,255,0.4); text-align: right; margin-top: 10px;">${note.createdAt}</div>
                `;
            }

            container.appendChild(card);
        });

        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const id = Number(btn.dataset.id);
                if (handlers.onDelete) handlers.onDelete(id);
            };
        });

        container.querySelectorAll('.todo-checkbox').forEach(chk => {
            chk.onchange = () => {
                const noteId = Number(chk.dataset.noteid);
                const todoIdx = Number(chk.dataset.todoidx);
                if (handlers.onToggleTodo) handlers.onToggleTodo(noteId, todoIdx);
            };
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const searchToggleBtn = document.getElementById('searchToggleBtn');
    searchToggleBtn?.addEventListener('click', () => {
        isSearchOpen = !isSearchOpen;
        updateTelegramSearchBar(window.currentHandlers);
        const viewport = document.querySelector('.scroll-viewport');
        if (viewport) viewport.style.paddingTop = isSearchOpen ? '120px' : '75px';
    });
});