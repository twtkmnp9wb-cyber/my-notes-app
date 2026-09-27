import { AppState } from './state.js';

export const UIRenderer = {
    renderCurrentTab() {
        const container = document.querySelector('.main-container');
        if (!container) return;

        container.innerHTML = '';

        const manifestSection = document.getElementById('manifestSection');
        const bornToWinTitle = document.getElementById('bornToWinTitle');

        if (AppState.currentTab === 'feed') {
            if (manifestSection) manifestSection.style.display = 'block';
            if (bornToWinTitle) bornToWinTitle.style.display = 'block';
            this.renderFeed(container);
        } else {
            if (manifestSection) manifestSection.style.display = 'none';
            if (bornToWinTitle) bornToWinTitle.style.display = 'none';
            this.renderOtherTabs(container);
        }
    },

    renderFeed(container) {
        const notes = AppState.notes || [];

        if (notes.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.4); margin-top: 40px; font-size: 14px;">Заметок пока нет</div>';
            return;
        }

        notes.forEach(note => {
            const card = document.createElement('div');
            card.className = 'note-card';
            card.style.cssText = 'background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 14px; margin-bottom: 12px; backdrop-filter: blur(12px); position: relative;';

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 6px;">
                    <h4 style="font-weight: 600; font-size: 15px; margin: 0; flex: 1;">${note.title || ''}</h4>
                    <div style="display: flex; gap: 8px; opacity: 0.6;" class="card-actions">
                        <button class="edit-btn" style="background: none; border: none; color: #fff; cursor: pointer; padding: 2px 4px; font-size: 13px;" title="Редактировать">✏️</button>
                        <button class="delete-btn" style="background: none; border: none; color: #f87171; cursor: pointer; padding: 2px 4px; font-size: 13px;" title="Удалить">🗑️</button>
                    </div>
                </div>
                <p style="font-size: 13px; color: rgba(255,255,255,0.8); line-height: 1.4; margin: 0;">${note.text || ''}</p>
                ${note.tag ? `<span style="font-size: 11px; color: #34d399; margin-top: 8px; display: inline-block;">${note.tag}</span>` : ''}
            `;

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

            container.appendChild(card);
        });
    },

    renderOtherTabs(container) {
        container.innerHTML = `<div style="text-align: center; color: rgba(255,255,255,0.4); margin-top: 40px; font-size: 14px;">Раздел "${AppState.currentTab}" в разработке</div>`;
    }
};
