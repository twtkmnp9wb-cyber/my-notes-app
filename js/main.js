import { AppState } from './state.js';
import { UI } from './ui.js';
import { Storage } from './storage.js';
import { WallpaperService } from './wallpaper.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Загрузка сохраненных заметок из localStorage
    AppState.notes = Storage.loadNotes() || [];

    // 2. Инициализация UI компонентов
    UI.init();
    UI.render();
    if (WallpaperService && typeof WallpaperService.init === 'function') {
        WallpaperService.init();
    }

    // 3. Переключение табов
    document.querySelectorAll('.menu-btn[data-tab]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.menu-btn[data-tab]').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            AppState.activeTab = e.target.dataset.tab;
            UI.render();
        });
    });

    // 4. Открытие модалки создания
    const addNoteBtn = document.getElementById('addNoteBtn');
    if (addNoteBtn) {
        addNoteBtn.addEventListener('click', () => {
            UI.openModalForCreate();
        });
    }

    // 5. Закрытие модалки
    const closeModalBtn = document.getElementById('closeModalBtn');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            UI.closeModal();
        });
    }

    // 6. Сохранение (Создание или Редактирование)
    const saveNoteBtn = document.getElementById('saveNoteBtn');
    if (saveNoteBtn) {
        saveNoteBtn.addEventListener('click', () => {
            const editId = document.getElementById('editingNoteId')?.value;
            const title = document.getElementById('noteTitleInput')?.value.trim() || '';
            const text = document.getElementById('noteTextInput')?.value.trim() || '';
            const hashtag = document.getElementById('noteHashtagInput')?.value.trim() || '';
            const isTask = document.getElementById('typeTaskBtn')?.classList.contains('active');
            const type = isTask ? 'task' : 'feed';

            if (!title && !text) return;

            if (editId) {
                // Обновляем существующую заметку
                AppState.updateNote(editId, { title, text, hashtag, type });
            } else {
                // Создаем новую заметку
                const newNote = {
                    id: Date.now().toString(),
                    title,
                    text,
                    hashtag,
                    type,
                    createdAt: new Date().toISOString()
                };
                AppState.addNote(newNote);
            }

            // Сохраняем в localStorage и перерисовываем
            Storage.saveNotes(AppState.notes);
            UI.render();
            UI.closeModal();
        });
    }
});
