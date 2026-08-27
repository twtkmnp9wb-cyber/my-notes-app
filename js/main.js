import { AppState } from './state.js';
import { StorageService } from './storage.js';
import { UIRenderer } from './ui.js';
import { CloudStorage } from './supabase.js';
import { WallpaperService } from './wallpaper.js';

let currentEditingId = null;

document.addEventListener('DOMContentLoaded', async () => {
    WallpaperService.init();

    let initialNotes = StorageService.load();
    initialNotes = StorageService.runMidnightCheck(initialNotes);
    AppState.init(initialNotes);

    const container = document.querySelector('.main-container');

    const refresh = () => {
        StorageService.save(AppState.notes);
        UIRenderer.renderList(container, AppState.getFilteredNotes(), {
            onDelete: async (id) => {
                AppState.deleteNote(id);
                refresh();
                try {
                    await CloudStorage.deleteNote(id);
                } catch (e) {
                    console.log('Удалено локально');
                }
            },
            onToggleTodo: async (id, idx) => {
                const entry = AppState.notes.find(n => n.id === id);
                if (entry && entry.todos[idx]) {
                    entry.todos[idx].done = !entry.todos[idx].done;
                    entry.completed = entry.todos.every(t => t.done);
                    refresh();
                    try {
                        await CloudStorage.saveNote(entry);
                    } catch (e) {
                        console.log('Изменения сохранены локально');
                    }
                }
            },
            onOpenLightbox: (id, imgIdx) => {
                const entry = AppState.notes.find(n => n.id === id);
                if (entry && entry.media && entry.media[imgIdx]) {
                    window.openLightbox(entry.media[imgIdx]);
                }
            },
            onEditNote: (note) => {
                openEditModal(note);
            }
        });
    };

    window.renderCurrentTab = refresh;
    refresh();

    try {
        const cloudNotes = await CloudStorage.fetchNotes();
        if (cloudNotes && cloudNotes.length > 0) {
            AppState.init(cloudNotes);
            StorageService.save(cloudNotes);
            refresh();
        }
    } catch (e) {
        console.log('Работаем в офлайн-режиме');
    }

    initModalsAndCreation(refresh);
    initLightbox();
    initEditModalLogic(refresh);
    initLiveDumpLogic();
});

function openEditModal(note) {
    currentEditingId = note.id;
    const titleInput = document.getElementById('editModalTitle');
    const textInput = document.getElementById('editModalText');
    const modal = document.getElementById('editModal');

    if (titleInput) titleInput.value = note.title || '';
    if (textInput) textInput.value = note.text || '';
    if (modal) modal.style.display = 'flex';
}

function initEditModalLogic(refreshCallback) {
    const modal = document.getElementById('editModal');
    const cancelBtn = document.getElementById('editModalCancel');
    const saveBtn = document.getElementById('editModalSave');

    if (cancelBtn) {
        cancelBtn.onclick = () => {
            if (modal) modal.style.display = 'none';
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
            if (modal) modal.style.display = 'none';
            currentEditingId = null;
        };
    }
}

function initModalsAndCreation(refreshCallback) {
    const noteModal = document.getElementById('noteModal');
    const settingsModal = document.getElementById('settingsModal');

    document.getElementById('addNoteBtn')?.addEventListener('click', () => noteModal.classList.add('active'));
    document.getElementById('closeModalBtn')?.addEventListener('click', () => noteModal.classList.remove('active'));

    let currentType = 'feed';
    document.getElementById('typeFeedBtn')?.addEventListener('click', (e) => {
        currentType = 'feed';
        e.target.classList.add('active');
        document.getElementById('typeTaskBtn').classList.remove('active');
        document.getElementById('feedFieldsBlock').style.display = 'block';
        document.getElementById('taskFieldsBlock').style.display = 'none';
    });

    document.getElementById('typeTaskBtn')?.addEventListener('click', (e) => {
        currentType = 'task';
        e.target.classList.add('active');
        document.getElementById('typeFeedBtn').classList.remove('active');
        document.getElementById('feedFieldsBlock').style.display = 'none';
        document.getElementById('taskFieldsBlock').style.display = 'block';
    });

    document.querySelectorAll('.tag-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const hashtagInput = document.getElementById('noteHashtagInput');
            if (hashtagInput) {
                hashtagInput.value = chip.textContent;
            }
        });
    });

    document.getElementById('saveNoteBtn')?.addEventListener('click', async () => {
        const title = document.getElementById('noteTitleInput').value.trim();
        const text = document.getElementById('noteTextInput').value.trim();

        if (!title && !text && currentType === 'feed') return;

        let newEntry = {
            id: Date.now(),
            type: currentType,
            title: title,
            text: text,
            createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        if (currentType === 'feed') {
            const tag = document.getElementById('noteHashtagInput').value.trim();
            newEntry.hashtag = tag ? (tag.startsWith('#') ? tag : `#${tag}`) : '';
            newEntry.media = [];
        } else {
            newEntry.folder = document.getElementById('taskTargetFolder').value;
            newEntry.deadline = document.getElementById('taskDeadlineInput')?.value || '';
            newEntry.todos = [];
            newEntry.completed = false;
            newEntry.media = [];
        }

        AppState.addNote(newEntry);
        refreshCallback();
        resetForm();
        noteModal.classList.remove('active');

        try {
            await CloudStorage.saveNote(newEntry);
        } catch (err) {
            console.log('Сохранено локально');
        }
    });

    // УНИВЕРСАЛЬНОЕ ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК (Roadmap, Sprint, Backlog, Dump, Feed работают одинаково)
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.target.dataset.tab;
            if (tab === 'settings') {
                settingsModal?.classList.add('active');
                return;
            }

            document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            // Устанавливаем вкладку в AppState, чтобы UIRenderer её отрисовал
            AppState.currentTab = tab; 
            refreshCallback();
        });
    });

    document.getElementById('closeSettingsBtn')?.addEventListener('click', () => settingsModal.classList.remove('active'));
}

function initLiveDumpLogic() {
    const dumpArea = document.getElementById('liveDumpArea');
    if (!dumpArea) return;
    const DUMP_KEY = 'app_live_dump_content';
    dumpArea.value = localStorage.getItem(DUMP_KEY) || '';
    dumpArea.addEventListener('input', (e) => {
        localStorage.setItem(DUMP_KEY, e.target.value);
    });
}

function resetForm() {
    document.getElementById('noteTitleInput').value = '';
    document.getElementById('noteTextInput').value = '';
    document.getElementById('noteHashtagInput').value = '';
    document.getElementById('noteMediaInput').value = '';
}

function initLightbox() {
    const lightbox = document.getElementById('lightboxModal');
    const img = document.getElementById('lightboxImg');
    const closeBtn = document.getElementById('lightboxCloseBtn');

    window.openLightbox = (url) => {
        if (lightbox && img) {
            img.src = url;
            lightbox.style.display = 'flex';
        }
    };

    closeBtn?.addEventListener('click', () => {
        if (lightbox) lightbox.style.display = 'none';
    });
}