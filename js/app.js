// ==========================================
// СОСТОЯНИЕ И КОНСТАНТЫ
// ==========================================
const STORAGE_KEY = 'app_notes_and_tasks';
const RESET_DATE_KEY = 'last_midnight_reset_date';

let currentType = 'feed'; // 'feed' или 'task'
let currentTab = 'feed';  // 'feed', 'sprint', 'backlog', 'dump', 'settings'

// ==========================================
// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    runMidnightMaintenance();
    initNavigation();
    initModals();
    initTypeSelector();
    initTodoBuilder();
    initQuickTags();
    
    // Рендерим стартовый экран
    renderNotes();
});

// ==========================================
// ВЕРСТКА И ЛОГИКА МОДАЛОК
// ==========================================
function initModals() {
    const noteModal = document.getElementById('noteModal');
    const dumpModal = document.getElementById('dumpModal');
    const settingsModal = document.getElementById('settingsModal');

    // Открытие модалки создания
    document.getElementById('addNoteBtn')?.addEventListener('click', () => {
        noteModal.classList.add('active');
    });

    // Закрытие модалки создания
    document.getElementById('closeModalBtn')?.addEventListener('click', () => {
        noteModal.classList.remove('active');
    });

    // Сохранение записи
    document.getElementById('saveNoteBtn')?.addEventListener('click', saveEntry);

    // Закрытие при клике на оверлей
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal') || e.target.classList.contains('modal-overlay')) {
            e.target.classList.remove('active');
        }
    });
}

// Переключение табов "Лента" / "Задача" в модалке
function initTypeSelector() {
    const feedBtn = document.getElementById('typeFeedBtn');
    const taskBtn = document.getElementById('typeTaskBtn');
    const feedBlock = document.getElementById('feedFieldsBlock');
    const taskBlock = document.getElementById('taskFieldsBlock');

    feedBtn?.addEventListener('click', () => {
        currentType = 'feed';
        feedBtn.classList.add('active');
        taskBtn.classList.remove('active');
        feedBlock.style.display = 'block';
        taskBlock.style.display = 'none';
    });

    taskBtn?.addEventListener('click', () => {
        currentType = 'task';
        taskBtn.classList.add('active');
        feedBtn.classList.remove('active');
        feedBlock.style.display = 'none';
        taskBlock.style.display = 'block';
    });
}

// Динамическое добавление пунктов чек-листа для Задач
function initTodoBuilder() {
    const addTodoBtn = document.getElementById('addTodoItemBtn');
    const container = document.getElementById('todoItemsContainer');

    addTodoBtn?.addEventListener('click', () => {
        const row = document.createElement('div');
        row.className = 'todo-input-row';
        row.innerHTML = `
            <input type="text" placeholder="Пункт подзадачи..." class="modal-input todo-item-input">
            <button type="button" class="remove-todo-btn" onclick="this.parentElement.remove()">✕</button>
        `;
        container.appendChild(row);
    });
}

// Быстрый клик по хэштегам
function initQuickTags() {
    document.querySelectorAll('.tag-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const input = document.getElementById('noteHashtagInput');
            if (input) {
                const tagText = chip.innerText;
                if (!input.value.includes(tagText)) {
                    input.value = input.value ? `${input.value} ${tagText}` : tagText;
                }
            }
        });
    });
}

// Навигация по верхнему меню
function initNavigation() {
    const menuBtns = document.querySelectorAll('.menu-btn');
    const dumpModal = document.getElementById('dumpModal');
    const settingsModal = document.getElementById('settingsModal');

    menuBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            menuBtns.forEach(b => b.classList.remove('active'));
            const tab = e.target.dataset.tab;
            
            if (tab === 'dump') {
                dumpModal?.classList.add('active');
                return;
            }
            if (tab === 'settings') {
                settingsModal?.classList.add('active');
                return;
            }

            e.target.classList.add('active');
            currentTab = tab;
            renderNotes();
        });
    });

    document.getElementById('closeDumpBtn')?.addEventListener('click', () => dumpModal.classList.remove('active'));
    document.getElementById('closeSettingsBtn')?.addEventListener('click', () => settingsModal.classList.remove('active'));
}

// ==========================================
// СОХРАНЕНИЕ ДАННЫХ
// ==========================================
function saveEntry() {
    const title = document.getElementById('noteTitleInput').value.trim();
    const text = document.getElementById('noteTextInput').value.trim();

    if (!title && !text) return;

    const rawData = localStorage.getItem(STORAGE_KEY);
    const items = rawData ? JSON.parse(rawData) : [];

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
    } else {
        const folder = document.getElementById('taskTargetFolder').value; // 'sprint' или 'backlog'
        const deadline = document.getElementById('taskDeadlineInput').value;
        
        // Собираем чек-лист
        const todoInputs = document.querySelectorAll('.todo-item-input');
        const todos = [];
        todoInputs.forEach(input => {
            if (input.value.trim()) {
                todos.push({ text: input.value.trim(), done: false });
            }
        });

        newEntry.folder = folder;
        newEntry.deadline = deadline;
        newEntry.todos = todos;
        newEntry.completed = false;
        newEntry.strikes = 0; // Изначально 0 вылетов
    }

    items.unshift(newEntry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));

    // Сброс формы и закрытие
    resetForm();
    document.getElementById('noteModal').classList.remove('active');
    renderNotes();
}

function resetForm() {
    document.getElementById('noteTitleInput').value = '';
    document.getElementById('noteTextInput').value = '';
    document.getElementById('noteHashtagInput').value = '';
    document.getElementById('todoItemsContainer').innerHTML = '';
}

// ==========================================
// РЕНДЕР КАРТОЧЕК
// ==========================================
function renderNotes() {
    const container = document.querySelector('.main-container');
    if (!container) return;

    const rawData = localStorage.getItem(STORAGE_KEY);
    let items = rawData ? JSON.parse(rawData) : [];

    // Фильтрация по табам верхнего меню
    if (currentTab === 'sprint') {
        items = items.filter(i => i.type === 'task' && i.folder === 'sprint');
    } else if (currentTab === 'backlog') {
        items = items.filter(i => i.type === 'task' && i.folder === 'backlog');
    } else if (currentTab === 'feed') {
        items = items.filter(i => i.type === 'feed');
    }

    if (items.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:rgba(255,255,255,0.4); padding:40px 0;">Здесь пока пусто</div>`;
        return;
    }

    container.innerHTML = items.map(item => {
        const isTask = item.type === 'task';
        const strikesBadge = isTask && !item.completed && item.strikes > 0 
            ? `<span class="task-deadline-badge">🔥 Вылетов: ${item.strikes}/3</span>` 
            : '';

        let todosHtml = '';
        if (isTask && item.todos && item.todos.length > 0) {
            todosHtml = `<div class="task-checklist">` + 
                item.todos.map((todo, idx) => `
                    <label class="task-todo-item ${todo.done ? 'done' : ''}">
                        <input type="checkbox" ${todo.done ? 'checked' : ''} onchange="toggleTodo(${item.id}, ${idx})">
                        <span>${escapeHtml(todo.text)}</span>
                    </label>
                `).join('') + `</div>`;
        }

        return `
            <div class="note-card ${item.completed ? 'completed-task' : ''}">
                <button class="delete-note-btn" onclick="deleteEntry(${item.id})">✕</button>
                
                ${item.title ? `<div class="note-title">${escapeHtml(item.title)}</div>` : ''}
                ${item.text ? `<div class="note-text">${escapeHtml(item.text)}</div>` : ''}
                
                ${todosHtml}

                <div class="note-footer">
                    <div>
                        ${item.hashtag ? `<span class="note-hashtag">${escapeHtml(item.hashtag)}</span>` : ''}
                        ${strikesBadge}
                    </div>
                    <span class="note-time">${item.createdAt || ''}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Переключение галочки чек-листа
function toggleTodo(entryId, todoIdx) {
    const items = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    const entry = items.find(i => i.id === entryId);
    
    if (entry && entry.todos && entry.todos[todoIdx]) {
        entry.todos[todoIdx].done = !entry.todos[todoIdx].done;
        
        // Если все чекбоксы отмечены — задача считается полностью выполненной
        entry.completed = entry.todos.every(t => t.done);
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        renderNotes();
    }
}

// Удаление
function deleteEntry(id) {
    let items = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    items = items.filter(i => i.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    renderNotes();
}

// ==========================================
// НОЧНАЯ ЧИСТКА И ПРАВИЛО 3 ВЫЛЕТОВ
// ==========================================
function runMidnightMaintenance() {
    const lastReset = localStorage.getItem(RESET_DATE_KEY);
    const today = new Date().toDateString();

    if (lastReset !== today) {
        const rawData = localStorage.getItem(STORAGE_KEY);
        if (rawData) {
            let items = JSON.parse(rawData);
            items = items.filter(item => {
                if (item.type !== 'task' || item.completed) return true;
                
                item.strikes = (item.strikes || 0) + 1;
                return item.strikes < 3; // Удаляем, если вылетов >= 3
            });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        }
        localStorage.setItem(RESET_DATE_KEY, today);
    }
}

function escapeHtml(text) {
    return text ? text.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m])) : '';
}
// ==========================================
// ЛОГИКА LIVE DUMP (СБРОС ТРЕВОГИ ПЕРЕД СНОМ)
// ==========================================

const DUMP_STORAGE_KEY = 'app_live_dump_content';

function initLiveDump() {
    const dumpArea = document.getElementById('liveDumpArea');
    if (!dumpArea) return;

    // 1. Подтягиваем ранее сохраненный текст при открытии
    const savedText = localStorage.getItem(DUMP_STORAGE_KEY) || '';
    dumpArea.value = savedText;

    // 2. Автосохранение при каждом введенном символе
    dumpArea.addEventListener('input', (e) => {
        localStorage.setItem(DUMP_STORAGE_KEY, e.target.value);
    });
}

// Запускаем инициализацию при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    initLiveDump();
});
