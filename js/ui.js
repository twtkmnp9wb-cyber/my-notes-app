import { AppState } from './state.js';

// Вспомогательная функция для проверки дедлайна
function getDeadlineStatus(deadlineStr) {
    if (!deadlineStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const deadlineDate = new Date(deadlineStr);
    deadlineDate.setHours(0, 0, 0, 0);

    const diffTime = deadlineDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: `Просрочено на ${Math.abs(diffDays)} дн.`, color: '#ff5252', urgent: true };
    if (diffDays === 0) return { text: 'Дедлайн сегодня!', color: '#ff9800', urgent: true };
    if (diffDays <= 2) return { text: `Осталось дней: ${diffDays}`, color: '#ffb74d', urgent: false };
    return { text: `Дедлайн: ${deadlineStr}`, color: 'rgba(255,255,255,0.6)', urgent: false };
}

export const UIRenderer = {
    renderList(container, notes, handlers) {
        container.innerHTML = '';

        // Если мы на вкладке Спринт или Бэклог, рисуем панель чипсов-фильтров
        if (AppState.currentTab === 'sprint' || AppState.currentTab === 'backlog') {
            const chipsContainer = document.createElement('div');
            chipsContainer.className = 'filter-chips-container';
            chipsContainer.style.cssText = 'display: flex; gap: 8px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 4px; width: 100%;';
            
            const categories = ['Все', 'Учеба', 'Проект', 'Личное'];
            categories.forEach(cat => {
                const chip = document.createElement('button');
                const isActive = AppState.currentFilter === cat;
                chip.textContent = cat;
                chip.className = `filter-chip ${isActive ? 'active' : ''}`;
                chip.style.cssText = `
                    background: ${isActive ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)'};
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    color: white;
                    padding: 6px 14px;
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 13px;
                    white-space: nowrap;
                    transition: all 0.2s ease;
                `;
                
                chip.onclick = () => {
                    AppState.currentFilter = cat;
                    UIRenderer.renderList(container, AppState.getFilteredNotes(), handlers);
                };
                chipsContainer.appendChild(chip);
            });
            container.appendChild(chipsContainer);
        }

        if (!notes || notes.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.style.cssText = 'text-align: center; color: rgba(255,255,255,0.5); margin-top: 40px; font-size: 14px;';
            emptyEl.textContent = 'Здесь пока пусто';
            container.appendChild(emptyEl);
            return;
        }

        // Рендерим каждую карточку
        notes.forEach(note => {
            const card = document.createElement('div');
            card.className = 'note-card';

            if (note.type === 'feed') {
                let mediaHtml = '';
                if (note.media && note.media.length > 0) {
                    mediaHtml = '<div class="note-media-grid" style="display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;">';
                    note.media.forEach((url, imgIdx) => {
                        mediaHtml += `<img src="${url}" class="note-media-img" data-id="${note.id}" data-imgidx="${imgIdx}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; cursor: pointer; border: 1px solid rgba(255,255,255,0.1);">`;
                    });
                    mediaHtml += '</div>';
                }

                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                        <h3 style="margin: 0; font-size: 16px; color: #fff;">${note.title || ''}</h3>
                        <button class="delete-btn" data-id="${note.id}" style="background: none; border: none; color: rgba(255,255,255,0.4); cursor: pointer; font-size: 16px;">✕</button>
                    </div>
                    <p style="margin: 0 0 8px 0; color: rgba(255,255,255,0.8); font-size: 14px; white-space: pre-wrap;">${note.text || ''}</p>
                    ${note.hashtag ? `<span style="display: inline-block; background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 6px; font-size: 12px; color: #ddd; margin-bottom: 8px;">${note.hashtag}</span>` : ''}
                    ${mediaHtml}
                    <div style="font-size: 11px; color: rgba(255,255,255,0.4); text-align: right; margin-top: 6px;">${note.createdAt}</div>
                `;
            } else {
                // Рендеринг задачи (спринт / бэклог) с подсветкой дедлайна
                let todosHtml = '';
                if (note.todos && note.todos.length > 0) {
                    todosHtml = '<div style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px;">';
                    note.todos.forEach((todo, tIdx) => {
                        todosHtml += `
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: rgba(255,255,255,0.9); cursor: pointer;">
                                <input type="checkbox" class="todo-checkbox" data-noteid="${note.id}" data-todoidx="${tIdx}" ${todo.done ? 'checked' : ''} style="cursor: pointer;">
                                <span style="${todo.done ? 'text-decoration: line-through; opacity: 0.5;' : ''}">${todo.text}</span>
                            </label>
                        `;
                    });
                    todosHtml += '</div>';
                }

                let deadlineHtml = '';
                if (note.deadline) {
                    const dStatus = getDeadlineStatus(note.deadline);
                    const borderStyle = dStatus.urgent ? `border-left: 3px solid ${dStatus.color}; padding-left: 8px;` : '';
                    deadlineHtml = `<div style="font-size: 12px; color: ${dStatus.color}; margin-bottom: 6px; ${borderStyle} font-weight: ${dStatus.urgent ? 'bold' : 'normal'};">⏳ ${dStatus.text}</div>`;
                }

                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                        <h3 style="margin: 0; font-size: 16px; color: #fff;">${note.title || 'Задача'}</h3>
                        <button class="delete-btn" data-id="${note.id}" style="background: none; border: none; color: rgba(255,255,255,0.4); cursor: pointer; font-size: 16px;">✕</button>
                    </div>
                    <p style="margin: 0 0 8px 0; color: rgba(255,255,255,0.8); font-size: 14px;">${note.text || ''}</p>
                    ${deadlineHtml}
                    ${todosHtml}
                    <div style="font-size: 11px; color: rgba(255,255,255,0.4); text-align: right; margin-top: 10px;">${note.createdAt}</div>
                `;
            }

            container.appendChild(card);
        });

        // Обработчики событий
        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.onclick = () => {
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

        container.querySelectorAll('.note-media-img').forEach(img => {
            img.onclick = () => {
                const id = Number(img.dataset.id);
                const imgIdx = Number(img.dataset.imgidx);
                if (handlers.onOpenLightbox) handlers.onOpenLightbox(id, imgIdx);
            };
        });
    }
};
