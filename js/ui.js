export const UIRenderer = {
    renderList(container, items, callbacks) {
        if (!container) return;
        if (items.length === 0) {
            container.innerHTML = `<div style="text-align:center; color:rgba(255,255,255,0.4); padding:40px 0;">Здесь пока пусто</div>`;
            return;
        }

        container.innerHTML = items.map(item => {
            const isTask = item.type === 'task';
            const strikesBadge = isTask && !item.completed && item.strikes > 0 
                ? `<span class="task-deadline-badge">🔥 Вылетов: ${item.strikes}/3</span>` : '';

            // Отрисовка чек-листов для задач
            let todosHtml = '';
            if (isTask && item.todos && item.todos.length > 0) {
                todosHtml = `<div class="task-checklist">` + 
                    item.todos.map((todo, idx) => `
                        <label class="task-todo-item ${todo.done ? 'done' : ''}">
                            <input type="checkbox" ${todo.done ? 'checked' : ''} data-id="${item.id}" data-idx="${idx}" class="todo-checkbox">
                            <span>${this.escapeHtml(todo.text)}</span>
                        </label>
                    `).join('') + `</div>`;
            }

            // Отрисовка картинок (если они есть в заметке)
            let mediaHtml = '';
            if (item.media && item.media.length > 0) {
                mediaHtml = `<div class="note-media-grid">` +
                    item.media.map((url, imgIdx) => `
                        <img src="${url}" alt="media" class="note-media-img" data-id="${item.id}" data-img-idx="${imgIdx}">
                    `).join('') + `</div>`;
            }

            return `
                <div class="note-card ${item.completed ? 'completed-task' : ''}">
                    <button class="delete-note-btn" data-id="${item.id}">✕</button>
                    ${item.title ? `<div class="note-title">${this.escapeHtml(item.title)}</div>` : ''}
                    ${item.text ? `<div class="note-text">${this.escapeHtml(item.text)}</div>` : ''}
                    ${mediaHtml}
                    ${todosHtml}
                    <div class="note-footer">
                        <div>
                            ${item.hashtag ? `<span class="note-hashtag">${this.escapeHtml(item.hashtag)}</span>` : ''}
                            ${strikesBadge}
                        </div>
                        <span class="note-time">${item.createdAt || ''}</span>
                    </div>
                </div>
            `;
        }).join('');

        this.bindEvents(container, callbacks);
    },

    bindEvents(container, { onDelete, onToggleTodo, onOpenLightbox }) {
        container.querySelectorAll('.delete-note-btn').forEach(btn => {
            btn.onclick = () => onDelete(Number(btn.dataset.id));
        });
        container.querySelectorAll('.todo-checkbox').forEach(cb => {
            cb.onchange = () => onToggleTodo(Number(cb.dataset.id), Number(cb.dataset.idx));
        });
        // Клик по картинке для открытия в лайтбоксе
        container.querySelectorAll('.note-media-img').forEach(img => {
            img.onclick = () => {
                if (onOpenLightbox) onOpenLightbox(Number(img.dataset.id), Number(img.dataset.imgIdx));
            };
        });
    },

    escapeHtml(text) {
        return text ? text.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m])) : '';
    }
};
