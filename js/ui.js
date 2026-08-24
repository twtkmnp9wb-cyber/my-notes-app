import { AppState } from './state.js';

let isSearchOpen = false;

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
        searchInput.placeholder = 'Поиск по хэштегу или заметкам...';
        searchInput.value = AppState.searchQuery || '';
        
        searchInput.oninput = (e) => {
            AppState.searchQuery = e.target.value;
            const container = document.querySelector('.main-container');
            if (container) {
                UIRenderer.renderList(container, AppState.getFilteredNotes(), handlers);
            }
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
            if (container) {
                UIRenderer.renderList(container, AppState.getFilteredNotes(), handlers);
            }
        };

        searchBar.appendChild(searchInput);
        searchBar.appendChild(countSpan);
        searchBar.appendChild(closeSearchBtn);
        searchBarContainer.appendChild(searchBar);
    }
}

export const UIRenderer = {
    renderList(container, notes, handlers) {
        window.currentHandlers = handlers;
        container.innerHTML = '';

        updateTelegramSearchBar(handlers);

        // 1. РЕНДЕР ВКЛАДКИ: BACKLOG (Чипсы + Сетка плиток 2 колонки)
        if (AppState.currentTab === 'backlog') {
            const categories = ['Все', 'Study', 'Project', 'Life'];
            const chipsContainer = document.createElement('div');
            chipsContainer.style.cssText = 'display: flex; gap: 8px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none;';
            
            categories.forEach(cat => {
                const chip = document.createElement('button');
                const isActive = (AppState.currentFilter === cat || (cat === 'Все' && AppState.currentFilter === 'Все'));
                chip.textContent = cat;
                chip.style.cssText = `
                    background: ${isActive ? '#fff' : 'rgba(255, 255, 255, 0.08)'};
                    color: ${isActive ? '#0a0a0a' : '#fff'};
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    padding: 6px 14px;
                    border-radius: 9999px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 500;
                    white-space: nowrap;
                    backdrop-filter: blur(10px);
                    transition: all 0.2s;
                `;
                chip.onclick = () => {
                    AppState.currentFilter = cat;
                    UIRenderer.renderList(container, AppState.getFilteredNotes(), handlers);
                };
                chipsContainer.appendChild(chip);
            });
            container.appendChild(chipsContainer);

            // Фильтрация плиток бэклога
            const backlogItems = notes.filter(n => n.type === 'task' && n.folder === 'backlog');
            const filteredBacklog = AppState.currentFilter === 'Все' 
                ? backlogItems 
                : backlogItems.filter(i => i.category === AppState.currentFilter);

            const grid = document.createElement('div');
            grid.style.cssText = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;';

            if (filteredBacklog.length === 0) {
                grid.innerHTML = `<div style="grid-column: span 2; text-align: center; color: rgba(255,255,255,0.4); font-size: 12px; padding: 30px;">Пусто в бэклоге</div>`;
            } else {
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
                    card.onclick = () => { if (handlers.onEditNote) handlers.onEditNote(item); };

                    card.innerHTML = `
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <span style="font-size: 8px; text-transform: uppercase; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 99px; color: #ccc;">${item.category || 'Study'}</span>
                                <span style="font-size: 9px; color: #ffb74d;">${item.deadline || '3 days left'}</span>
                            </div>
                            <h4 style="margin: 0; font-size: 13px; color: #fff; font-weight: 500; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${item.title || 'Задача'}</h4>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <div style="width: 100%; background: rgba(255,255,255,0.1); height: 4px; border-radius: 99px; overflow: hidden;">
                                <div style="background: rgba(255,255,255,0.7); height: 100%; width: 50%;"></div>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: rgba(255,255,255,0.5);">
                                <span>50%</span>
                                <span style="color: #6ee7b7; font-weight: 500;">В Спринт ↗</span>
                            </div>
                        </div>
                    `;
                    grid.appendChild(card);
                });
            }
            container.appendChild(grid);
            return;
        }

        // 2. РЕНДЕР ВКЛАДКИ: ROADMAP
        if (AppState.currentTab === 'roadmap') {
            container.innerHTML = `
                <div style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 24px; padding: 20px; backdrop-filter: blur(16px);">
                    <span style="font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.5); display: block; text-align: center; margin-bottom: 4px;">Стратегия</span>
                    <h3 style="margin: 0 0 16px 0; font-size: 15px; text-align: center; color: #fff; font-weight: 600;">Цели на сезон (Roadmap)</h3>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <div style="background: rgba(255,255,255,0.05); padding: 12px 14px; border-radius: 14px; font-size: 13px; border: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
                            <span>🎯 Закрыть семестр без хвостов</span>
                            <div style="width: 16px; height: 16px; border: 1px solid rgba(255,255,255,0.3); border-radius: 50%;"></div>
                        </div>
                        <div style="background: rgba(255,255,255,0.05); padding: 12px 14px; border-radius: 14px; font-size: 13px; border: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
                            <span>🎯 Прокачать осанку и турник</span>
                            <div style="width: 16px; height: 16px; background: #10b981; border-radius: 50%;"></div>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        // 3. РЕНДЕР ВКЛАДКИ: DUMP (Core Dump)
        if (AppState.currentTab === 'dump') {
            container.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <div style="display: flex; gap: 6px;">
                        <button class="menu-btn active" style="flex:1; text-align:center; padding: 8px;">Сброс (Dump)</button>
                        <button class="menu-btn" style="flex:1; text-align:center; opacity:0.6; padding: 8px;">Невыполненное</button>
                    </div>
                    <textarea id="liveDumpAreaMain" placeholder="Поток мыслей перед сном..." class="modal-textarea" style="height: 220px; width:100%;">${localStorage.getItem('app_live_dump_content') || ''}</textarea>
                </div>
            `;
            const area = document.getElementById('liveDumpAreaMain');
            area?.addEventListener('input', (e) => {
                localStorage.setItem('app_live_dump_content', e.target.value);
            });
            return;
        }

        // 4. ОСТАЛЬНЫЕ ВКЛАДКИ (Лента и Спринт)
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
        if (viewport) {
            viewport.style.paddingTop = isSearchOpen ? '120px' : '75px';
        }
    });
});
