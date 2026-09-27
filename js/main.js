import { AppState } from './state.js';
import { UIRenderer } from './ui.js';
import { StorageService } from './storage.js';
import { WallpaperService } from './wallpaper.js';

let currentEditingId = null;

async function initApp() {
    try {
        if (StorageService?.init) await StorageService.init();
        if (WallpaperService?.init) WallpaperService.init();

        // Глобальная функция открытия модалки редактирования
        window.openEditModal = (note) => {
            currentEditingId = note.id;
            const titleInput = document.getElementById('editModalTitle');
            const textInput = document.getElementById('editModalText');
            const modal = document.getElementById('editModal');

            if (titleInput) titleInput.value = note.title || '';
            if (textInput) textInput.value = note.text || '';
            if (modal) modal.classList.add('active');
        };

        const refreshUI = () => {
            UIRenderer.renderCurrentTab();
        };

        initNavigation(refreshUI);
        initModalsAndCreation(refreshUI);
        initEditModalLogic(refreshUI);

        // Первый рендер интерфейса
        refreshUI();
    } catch (err) {
        console.error("Ошибка при инициализации приложения:", err);
    }
}

// Проверка состояния загрузки DOM (гарантирует запуск, даже если DOM уже загружен)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

function initNavigation(refreshCallback) {
    const menuBtns = document.querySelectorAll('.menu-btn[data-tab]');
    menuBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            menuBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');

            const tab = e.currentTarget.getAttribute('data-tab');
            if (tab === 'settings') {
                document.getElementById('settingsModal')?.classList.add('active');
            } else {
                AppState.currentTab = tab;
                refreshCallback();
            }
        });
    });
}

function initModalsAndCreation(refreshCallback) {
    const noteModal = document.getElementById('noteModal');
    const settingsModal = document.getElementById('settingsModal');
    const addNoteBtn = document.getElementById('addNoteBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const settingsCloseBtn = document.getElementById('settingsCloseBtn');
    const saveNoteBtn = document.getElementById('saveNoteBtn');

    if (addNoteBtn) {
        addNoteBtn.onclick = () => noteModal?.classList.add('active');
    }

    if (closeModalBtn) {
        closeModalBtn.onclick = () => noteModal?.classList.remove('active');
    }

    if (settingsCloseBtn) {
        settingsCloseBtn.onclick = () => settingsModal?.classList.remove('active');
    }

    if (saveNoteBtn) {
        saveNoteBtn.onclick = async () => {
            const title = document.getElementById('noteTitleInput')?.value || '';
            const text = document.getElementById('noteTextInput')?.value || '';
            const tag = document.getElementById('noteHashtagInput')?.value || '';

            if (!title && !text) return;

            const newNote = {
                id: Date.now().toString(),
                title,
                text,
                tag,
                type: AppState.currentTab === 'backlog' ? 'task' : 'feed',
                date: new Date().toLocaleDateString('ru-RU')
            };

            await AppState.addNote(newNote);
            
            const titleIn = document.getElementById('noteTitleInput');
            const textIn = document.getElementById('noteTextInput');
            const tagIn = document.getElementById('noteHashtagInput');
            if (titleIn) titleIn.value = '';
            if (textIn) textIn.value = '';
            if (tagIn) tagIn.value = '';
            
            noteModal?.classList.remove('active');
            refreshCallback();
        };
    }
}

function initEditModalLogic(refreshCallback) {
    const modal = document.getElementById('editModal');
    const cancelBtn = document.getElementById('editModalCancel');
    const saveBtn = document.getElementById('editModalSave');

    if (cancelBtn) {
        cancelBtn.onclick = () => {
            modal?.classList.remove('active');
            currentEditingId = null;
        };
    }

    if (saveBtn) {
        saveBtn.onclick = async () => {
            if (!currentEditingId) return;
            
            const note = AppState.notes.find(n => n.id === currentEditingId);
            if (note) {
                const titleInput = document.getElementById('editModalTitle');
                const textInput = document.getElementById('editModalText');

                if (titleInput) note.title = titleInput.value;
                if (textInput) note.text = textInput.value;

                await AppState.updateNote(note);
                refreshCallback();
            }
            
            modal?.classList.remove('active');
            currentEditingId = null;
        };
    }
}
