import { AppState } from './state.js';

const editSvgIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
const trashSvgIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;

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
        let notes = AppState.notes || [];

        // Демо-данные, если заметок пока нет
        if (notes.length === 0) {
            notes = [
                { id: 'demo1', title: 'Физическая форма', text: 'Турник: 4 подхода по 12 повторений. Держать осанку в течение дня.', tag: '#турник #осанка' },
                { id: 'demo2', title: 'Разработка интерфейса', text: 'Завершить стек веб-приложения на HTML/CSS и подготовить репозиторий на GitHub.', tag: '#фокус' }
            ];
        }

        notes.forEach(note => {
            const card = document.createElement('div');
            card.className = 'note-card';
            
            const isEdit = AppState.isEditMode;
            const borderStyle = isEdit ? 'border: 1px dashed rgba(52, 211, 153, 0.5); cursor: pointer;' : 'border: 1px solid rgba(255,255,255,0.1);';

            card.style.cssText = `background: rgba(255,255,255,0.05); ${borderStyle} border-radius: 16px; padding: 14px; margin-bottom: 12px; backdrop-filter: blur(12px); position: relative; transition: all 0.2s ease;`;

            const actionControls = isEdit ? `
                <div style="display: flex; gap: 8px; align-items: center;">
                    <span style="font-size: 11px; color: #34d399; opacity: 0.8;">Нажми для правки</span>
                    <button class="delete-btn" style="background: rgba(248,113,113,0.15); border: 1px solid rgba(248,113,113,0.3); border-radius: 6px; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center;" title="Удалить">${trashSvgIcon}</button>
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

            if (isEdit) {
                card.onclick = (e) => {
                    if (e.target.closest('.delete-btn')) return;
                    if (window.openEditModal) window.openEditModal(note);
                };

                const deleteBtn = card.querySelector('.delete-btn');
                if (deleteBtn) {
                    deleteBtn.onclick = async (e) => {
                        e.stopPropagation();
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
        const items = [
            { title: 'Высшая IT-школа', status: 'В процессе', desc: 'Освоение алгоритмов, C# и веб-технологий на первом курсе.' },
            { title: 'Пет-проект "Монитор Души"', status: 'Активен', desc: 'Создание персонального органайзера с стеклянным дизайном и PWA-версткой.' },
            { title: 'Спортивный сезон', status: 'Регулярно', desc: 'Работа с разборными гантелями и систематические занятия на турнике.' }
        ];

        items.forEach(item => {
            const card = document.createElement('div');
            card.style.cssText = 'background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 14px; margin-bottom: 12px; backdrop-filter: blur(12px);';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <h4 style="font-weight: 600; font-size: 15px; margin: 0; color: #34d399;">${item.title}</h4>
                    <span style="font-size: 10px; background: rgba(52, 211, 153, 0.15); color: #34d399; padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(52, 211, 153, 0.3);">${item.status}</span>
                </div>
                <p style="font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.4; margin: 0;">${item.desc}</p>
            `;
            container.appendChild(card);
        });
    },

    renderSprint(container) {
        const items = [
            { task: 'Оптимизация мобильного UI', priority: 'Высокий', time: 'Сегодня' },
            { task: 'Подготовка лабораторной C#', priority: 'Средний', time: 'Завтра' },
            { task: 'Тренировка: Плечи и турник', priority: 'Обязательно', time: '18:00' }
        ];

        items.forEach(item => {
            const card = document.createElement('div');
            card.style.cssText = 'background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 14px; margin-bottom: 12px; backdrop-filter: blur(12px);';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h4 style="font-weight: 600; font-size: 14px; margin: 0;">⚡ ${item.task}</h4>
                    <span style="font-size: 10px; color: #60a5fa; background: rgba(96, 165, 250, 0.15); padding: 2px 8px; border-radius: 6px;">${item.time}</span>
                </div>
            `;
            container.appendChild(card);
        });
    },

    renderBacklog(container) {
        const tasks = (AppState.notes || []).filter(n => n.type === 'task');

        const demoTasks = tasks.length > 0 ? tasks : [
            { title: 'Кастомные шейдеры для фона', text: 'Добавить адаптивный градиентный блюр.' },
            { title: 'Экспорт данных в JSON', text: 'Резервное копирование локальных заметок.' }
        ];

        demoTasks.forEach(task => {
            const card = document.createElement('div');
            card.style.cssText = 'background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 14px; margin-bottom: 12px; backdrop-filter: blur(12px);';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h4 style="font-weight: 600; font-size: 14px; margin: 0;">${task.title || 'Без названия'}</h4>
                    <span style="font-size: 10px; background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 6px;">Бэклог</span>
                </div>
                ${task.text ? `<p style="font-size: 12px; color: rgba(255,255,255,0.7); margin-top: 6px; margin-bottom: 0;">${task.text}</p>` : ''}
            `;
            container.appendChild(card);
        });
    },

    renderDump(container) {
        const thoughts = [
            'Разгрузка головы: сфокусироваться на чистом коде без перегруза деталями.',
            'Идея: сделать динамические карточки с фокусом на минимализм.'
        ];

        thoughts.forEach(text => {
            const card = document.createElement('div');
            card.style.cssText = 'background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 14px; margin-bottom: 12px; backdrop-filter: blur(12px);';
            card.innerHTML = `
                <p style="font-size: 13px; color: rgba(255,255,255,0.85); line-height: 1.5; margin: 0; font-style: italic;">🧠 "${text}"</p>
            `;
            container.appendChild(card);
        });
    }
};
