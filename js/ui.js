import { AppState } from './state.js';

export const UIRenderer = {
    renderCurrentTab() {
        const container = document.querySelector('.main-container');
        if (!container) return;

        container.innerHTML = '';

        const manifestSection = document.getElementById('manifestSection');
        const bornToWinTitle = document.getElementById('bornToWinTitle');

        const isFeed = AppState.currentTab === 'feed';
        if (manifestSection) manifestSection.style.display = isFeed ? 'block' : 'none';
        if (bornToWinTitle) bornToWinTitle.style.display = isFeed ? 'block' : 'none';

        switch (AppState.currentTab) {
            case 'feed':
                this.renderFeed(container);
                break;
            case 'roadmap':
                this.renderRoadmap(container);
                break;
            case 'sprint':
                this.renderSprint(container);
                break;
            case 'backlog':
                this.renderBacklog(container);
                break;
            case 'dump':
                this.renderDump(container);
                break;
            default:
                this.renderFeed(container);
        }
    },

    renderFeed(container) {
        const notes = AppState.notes || [];

        if (notes.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: rgba(255,255,255,0.4); margin-top: 40px; font-size: 14px;">
                    Заметок пока нет.<br>Нажми <b style="color:#fff;">+</b> внизу, чтобы добавить первую!
                </div>
            `;
            return;
        }

        notes.forEach(note => {
            const card = document.createElement('div');
            card.className = 'note-card';
            card.style.cssText = 'background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 14px; margin-bottom: 12px; backdrop-filter: blur(12px); position: relative; transition: all 0.2s ease;';

            // Если режим редактирования активен — добавляем плашку управления
            const actionControls = AppState.isEditMode ? `
                <div style="display: flex; gap: 8px; background: rgba(0,0,0,0.4); padding: 4px 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);" class="card-actions">
                    <button class="edit-btn" style="background: none; border: none; color: #fff; cursor: pointer; font-size: 12px;" title="Редактировать">✏️ Редактировать</button>
                    <button class="delete-btn" style="background: none; border: none; color: #f87171; cursor: pointer; font-size: 12px;" title="Удалить">🗑️</button>
                </div>
            ` : '';

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 6px;">
                    <h4 style="font-weight: 600; font-size: 15px; margin: 0; flex: 1;">${note.title || ''}</h4>
                    ${actionControls}
                </div>
                <p style="font-size: 13px; color: rgba(255,255,255,0.8); line-height: 1.4; margin: 0;">${note.text || ''}</p>
                ${note.tag ? `<span style="font-size: 11px; color: #34d399; margin-top: 8px; display: inline-block;">${note.tag}</span>` : ''}
            `;

            if (AppState.isEditMode) {
                const editBtn = card.querySelector('.edit-btn');
                const deleteBtn = card.querySelector('.delete-btn');

                if (editBtn) {
                    editBtn.onclick = () => {
                        if (window.openEditModal) window.openEditModal(note);
                    };
                }

                if (deleteBtn) {
                    deleteBtn.onclick = async () => {
                        if (confirm('Удалить эту запись?')) {
                            await AppState.deleteNote(note.id);
                            this.renderCurrentTab();
                        }
                    };
                }
            }

            container.appendChild(card);
        });
    },

    renderRoadmap(container) {
        container.innerHTML = `
            <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 16px; backdrop-filter: blur(12px);">
                <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 8px; color: #34d399;">🗺️ Roadmap сезона</h3>
                <p style="font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.5; margin:0;">Стратегические цели и вектор движения.</p>
            </div>
        `;
    },

    renderSprint(container) {
        container.innerHTML = `
            <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 16px; backdrop-filter: blur(12px);">
                <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 8px; color: #60a5fa;">⚡ Текущий Спринт</h3>
                <p style="font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.5; margin:0;">Фокусные задачи на эту неделю.</p>
            </div>
        `;
    },

    renderBacklog(container) {
        const tasks = (AppState.notes || []).filter(n => n.type === 'task');

        if (tasks.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: rgba(255,255,255,0.4); margin-top: 40px; font-size: 14px;">
                    Бэклог пуст.<br>При создании записи выбери тип <b>⚡ Задача</b>.
                </div>
            `;
            return;
        }

        tasks.forEach(task => {
            const card = document.createElement('div');
            card.style.cssText = 'background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 14px; margin-bottom: 12px; backdrop-filter: blur(12px);';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h4 style="font-weight: 600; font-size: 14px; margin: 0;">${task.title || 'Без названия'}</h4>
                    <span style="font-size: 11px; background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 6px;">Задача</span>
                </div>
                ${task.text ? `<p style="font-size: 12px; color: rgba(255,255,255,0.7); margin-top: 6px; margin-bottom: 0;">${task.text}</p>` : ''}
            `;
            container.appendChild(card);
        });
    },

    renderDump(container) {
        container.innerHTML = `
            <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 16px; backdrop-filter: blur(12px);">
                <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 8px; color: #f472b6;">🧠 Core Dump</h3>
                <p style="font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.5; margin:0;">Сброс мыслей и расчистка головы.</p>
            </div>
        `;
    }
};
