import { AppState } from './state.js';

export const UI = {
    init() {
        this.bindModalTypeSelector();
        this.bindQuickTags();
    },

    bindModalTypeSelector() {
        const typeFeedBtn = document.getElementById('typeFeedBtn');
        const typeTaskBtn = document.getElementById('typeTaskBtn');
        const feedFieldsBlock = document.getElementById('feedFieldsBlock');

        if (typeFeedBtn && typeTaskBtn) {
            typeFeedBtn.addEventListener('click', () => {
                typeFeedBtn.classList.add('active');
                typeTaskBtn.classList.remove('active');
                if (feedFieldsBlock) feedFieldsBlock.style.display = 'block';
            });

            typeTaskBtn.addEventListener('click', () => {
                typeTaskBtn.classList.add('active');
                typeFeedBtn.classList.remove('active');
                if (feedFieldsBlock) feedFieldsBlock.style.display = 'none';
            });
        }
    },

    bindQuickTags() {
        document.querySelectorAll('.tag-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const input = document.getElementById('noteHashtagInput');
                if (input) {
                    input.value = chip.textContent.trim();
                }
            });
        });
    },

    openModalForCreate() {
        const modal = document.getElementById('noteModal');
        const modalTitle = document.getElementById('modalTitle');
        const editingId = document.getElementById('editingNoteId');

        if (modalTitle) modalTitle.textContent = 'Создать запись';
        if (editingId) editingId.value = '';

        document.getElementById('noteTitleInput').value = '';
        document.getElementById('noteTextInput').value = '';
        document.getElementById('noteHashtagInput').value = '';

        document.getElementById('typeFeedBtn')?.click();

        if (modal) modal.style.display = 'flex';
    },

    openModalForEdit(note) {
        const modal = document.getElementById('noteModal');
        const modalTitle = document.getElementById('modalTitle');
        const editingId = document.getElementById('editingNoteId');

        if (modalTitle) modalTitle.textContent = 'Редактировать запись';
        if (editingId) editingId.value = note.id;

        document.getElementById('noteTitleInput').value = note.title || '';
        document.getElementById('noteTextInput').value = note.text || '';
        document.getElementById('noteHashtagInput').value = note.hashtag || '';

        if (note.type === 'task') {
            document.getElementById('typeTaskBtn')?.click();
        } else {
            document.getElementById('typeFeedBtn')?.click();
        }

        if (modal) modal.style.display = 'flex';
    },

    closeModal() {
        const modal = document.getElementById('noteModal');
        if (modal) modal.style.display = 'none';
        const editingId = document.getElementById('editingNoteId');
        if (editingId) editingId.value = '';
    },

    render() {
        const container = document.querySelector('.main-container');
        if (!container) return;

        // Показывать Манифест и Born To Win только на Ленте
        const manifest = document.getElementById('manifestSection');
        const bornTitle = document.getElementById('bornToWinTitle');
        if (manifest) manifest.style.display = AppState.activeTab === 'feed' ? 'block' : 'none';
        if (bornTitle) bornTitle.style.display = AppState.activeTab === 'feed' ? 'block' : 'none';

        const filtered = AppState.getFilteredNotes();

        if (filtered.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding: 40px; color: rgba(255,255,255,0.4);">Список пуст</div>`;
            return;
        }

        container.innerHTML = filtered.map(note => `
            <div class="note-card" data-id="${note.id}" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 14px; margin-bottom: 12px; backdrop-filter: blur(12px);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                    <h4 style="font-weight: 600; font-size: 15px; color: #fff;">${note.title || 'Без названия'}</h4>
                    <div style="display: flex; gap: 8px;">
                        <button class="edit-btn" data-id="${note.id}" style="background:none; border:none; cursor:pointer; font-size: 14px;" title="Редактировать">✏️</button>
                        <button class="delete-btn" data-id="${note.id}" style="background:none; border:none; cursor:pointer; font-size: 14px;" title="Удалить">🗑️</button>
                    </div>
                </div>
                ${note.text ? `<p style="font-size: 13px; color: rgba(255,255,255,0.8); white-space: pre-wrap; margin-bottom: 8px;">${note.text}</p>` : ''}
                ${note.hashtag ? `<span style="font-size: 11px; color: #34d399; font-style: italic;">${note.hashtag}</span>` : ''}
            </div>
        `).join('');

        // Привязываем события редактирования и удаления
        container.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const note = AppState.notes.find(n => String(n.id) === String(id));
                if (note) this.openModalForEdit(note);
            });
        });

        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                AppState.deleteNote(id);
                this.render();
            });
        });
    }
};
