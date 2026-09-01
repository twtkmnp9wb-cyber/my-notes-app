import { AppState } from './state.js';

let isSearchOpen = false;
let backlogFilterVal = 'All';
let dumpSubTab = 'evening'; 
let isEditMode = false;

let localRoadmapGoals = JSON.parse(localStorage.getItem('app_roadmap_goals')) || [
    { id: 1, text: 'Закрыть семестр без хвостов', done: false },
    { id: 2, text: 'Прокачать физическую форму (турник х 15)', done: true },
    { id: 3, text: 'Запустить финальную версию Монитора Души', done: false }
];

let localSprintTasks = JSON.parse(localStorage.getItem('app_sprint_tasks')) || [
    { id: 101, title: 'Изучить главу 7', done: false },
    { id: 102, title: 'Собрать референсы', done: false },
    { id: 103, title: 'Запустить тест', done: false },
    { id: 104, title: 'Провести встречу', done: false }
];

let backlogCategories = JSON.parse(localStorage.getItem('app_backlog_categories')) || ['All', 'Study', 'Project', 'Music', 'Life'];

let backlogCustomItems = JSON.parse(localStorage.getItem('app_backlog_custom_items')) || [
    { id: 1, title: 'Подготовка к зиме', category: 'Study', deadline: 'Due today', progress: 66, urgent: true, flipped: false, subtasks: [{ id: 11, text: 'Купить пуховик', done: true }, { id: 12, text: 'Проверить резину', done: false }] },
    { id: 2, title: 'Идея для проекта - 2', category: 'Project', deadline: '2 days left', progress: 20, urgent: false, flipped: false, subtasks: [{ id: 21, text: 'Набросать архитектуру', done: true }, { id: 22, text: 'Написать доку', done: false }] },
    { id: 3, title: 'Идея для проекта', category: 'Project', deadline: '3 days left', progress: 95, urgent: false, flipped: false, subtasks: [{ id: 31, text: 'Дизайн в Figma', done: true }] },
    { id: 4, title: 'Сделать ремонт', category: 'Life', deadline: '3 days left', progress: 10, urgent: false, flipped: false, subtasks: [{ id: 41, text: 'Выбрать обои', done: false }] }
];

let backlogRows = JSON.parse(localStorage.getItem('app_backlog_rows')) || [
    { id: 201, title: 'Купить батарейки', category: 'Life', deadline: 'Due today', urgent: true, done: false },
    { id: 202, title: 'Послушать новый альбом', category: 'Music', deadline: 'Tomorrow', urgent: false, done: false }
];

let manifestWords = JSON.parse(localStorage.getItem('app_manifest_words')) || ['осанка', 'речь', 'турник', 'фокус'];

let localDumpDays = JSON.parse(localStorage.getItem('app_dump_days_v2')) || {
    day1: { title: 'День 1', date: 'Сегодня', notes: [{ title: 'Идея для нового трека', text: 'Записать плотный бас в стиле киберпанк.' }] },
    day2: { title: 'День 2', date: 'Вчера', notes: [{ title: 'Идея проекта фильм', text: 'Сценарий про программиста.' }] },
    day3: { title: 'День 3', date: 'Позавчера', notes: [{ title: 'Записать музыку', text: 'Эмбиент на 5 минут.' }] }
};

function getInitialDumpDay() {
    const dayNumber = (Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % 3) + 1;
    const key = `day${dayNumber}`;
    return localDumpDays[key] ? key : 'day1';
}

let activeDumpDay = getInitialDumpDay();
let expandedDumpNoteIndex = null;

function saveRoadmapData() { localStorage.setItem('app_roadmap_goals', JSON.stringify(localRoadmapGoals)); }
function saveSprintData() { localStorage.setItem('app_sprint_tasks', JSON.stringify(localSprintTasks)); }
function saveDumpData() { localStorage.setItem('app_dump_days_v2', JSON.stringify(localDumpDays)); }
function saveCategoriesData() { localStorage.setItem('app_backlog_categories', JSON.stringify(backlogCategories)); }
function saveBacklogItems() { localStorage.setItem('app_backlog_custom_items', JSON.stringify(backlogCustomItems)); }
function saveBacklogRows() { localStorage.setItem('app_backlog_rows', JSON.stringify(backlogRows)); }
function saveManifestData() { localStorage.setItem('app_manifest_words', JSON.stringify(manifestWords)); }

function showToast(message) {
    let existingToast = document.getElementById('appToastNotification');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.id = 'appToastNotification';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%);
        background: rgba(16, 185, 129, 0.9); backdrop-filter: blur(12px); color: #fff;
        padding: 8px 16px; border-radius: 9999px; font-size: 12px; font-weight: 500;
        box-shadow: 0 10px 25px rgba(0,0,0,0.4); z-index: 9999; animation: fadeInOut 2s ease forwards;
    `;

    if (!document.getElementById('toastKeyframes')) {
        const style = document.createElement('style');
        style.id = 'toastKeyframes';
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translate(-50%, 10px); }
                15% { opacity: 1; transform: translate(-50%, 0); }
                85% { opacity: 1; transform: translate(-50%, 0); }
                100% { opacity: 0; transform: translate(-50%, -10px); }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

function initTelegramSearchBar(handlers) {
    const searchBarContainer = document.getElementById('telegramSearchBarContainer');
    if (!searchBarContainer) return;

    if (AppState.currentTab === 'feed' && isSearchOpen) {
        if (!document.getElementById('liveSearchInput')) {
            searchBarContainer.innerHTML = `
                <div class="telegram-search-bar">
                    <span style="color: rgba(255,255,255,0.4); padding-left: 4px;">🔍</span>
                    <input type="text" id="liveSearchInput" class="telegram-search-input" placeholder="Поиск по заметкам..." value="${AppState.searchQuery || ''}" autofocus />
                    <span id="searchCounter" style="font-size: 11px; color: rgba(255,255,255,0.5); white-space: nowrap;"></span>
                    <button id="closeSearchPanel" style="background: transparent; border: none; color: rgba(255,255,255,0.6); cursor: pointer; font-size: 14px; padding: 0 4px;">✕</button>
                </div>
            `;

            const input = document.getElementById('liveSearchInput');
            input.oninput = (e) => {
                AppState.searchQuery = e.target.value;
                const container = document.querySelector('.main-container');
                if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), handlers);
                updateSearchCounter();
            };

            document.getElementById('closeSearchPanel').onclick = () => {
                isSearchOpen = false;
                AppState.searchQuery = '';
                searchBarContainer.innerHTML = '';
                const container = document.querySelector('.main-container');
                if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), handlers);
            };
        }
        updateSearchCounter();
    } else {
        searchBarContainer.innerHTML = '';
    }
}

function updateSearchCounter() {
    const counter = document.getElementById('searchCounter');
    if (counter) {
        const notesCount = AppState.getFilteredNotes().length;
        const totalFeedCount = AppState.notes.filter(n => n.type === 'feed').length;
        counter.textContent = `${notesCount} из ${totalFeedCount}`;
    }
}

function updateFooterButtonsVisibility() {
    const searchBtn = document.getElementById('searchToggleBtn');
    const addBtn = document.getElementById('addNoteBtn');
    if (!searchBtn || !addBtn) return;

    if (AppState.currentTab === 'feed') {
        searchBtn.style.display = 'flex';
    } else {
        searchBtn.style.display = 'none';
        isSearchOpen = false;
        const searchBarContainer = document.getElementById('telegramSearchBarContainer');
        if (searchBarContainer) searchBarContainer.innerHTML = '';
    }

    const tab = AppState.currentTab;
    if (tab === 'roadmap' || tab === 'dump' || tab === 'livedump') {
        addBtn.style.display = 'none';
    } else {
        addBtn.style.display = 'flex';
    }
}

window.toggleEditMode = function() {
    isEditMode = !isEditMode;
    showToast(isEditMode ? '✏️ Режим редактирования включен' : '🔒 Режим блокировки');
    const container = document.querySelector('.main-container');
    if (container && window.currentHandlers) {
        UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
    }
};

window.flipBacklogCard = function(id) {
    const item = backlogCustomItems.find(i => i.id === id);
    if (item) {
        item.flipped = !item.flipped;
        saveBacklogItems();
        const container = document.querySelector('.main-container');
        if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
    }
};

window.toggleSubtask = function(cardId, subId) {
    const card = backlogCustomItems.find(c => c.id === cardId);
    if (card) {
        const sub = card.subtasks.find(s => s.id === subId);
        if (sub) {
            sub.done = !sub.done;
            const completedCount = card.subtasks.filter(s => s.done).length;
            card.progress = card.subtasks.length > 0 ? Math.round((completedCount / card.subtasks.length) * 100) : 0;
            saveBacklogItems();
            const container = document.querySelector('.main-container');
            if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
        }
    }
};

window.addSubtaskToCard = function(cardId) {
    const card = backlogCustomItems.find(c => c.id === cardId);
    if (card) {
        const text = prompt('Текст нового подпункта:');
        if (text && text.trim()) {
            card.subtasks.push({ id: Date.now(), text: text.trim(), done: false });
            const completedCount = card.subtasks.filter(s => s.done).length;
            card.progress = Math.round((completedCount / card.subtasks.length) * 100);
            saveBacklogItems();
            showToast('Подпункт добавлен');
            const container = document.querySelector('.main-container');
            if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
        }
    }
};

window.editSubtask = function(cardId, subId) {
    const card = backlogCustomItems.find(c => c.id === cardId);
    if (card) {
        const sub = card.subtasks.find(s => s.id === subId);
        if (sub) {
            const newText = prompt('Редактировать подпункт:', sub.text);
            if (newText !== null && newText.trim()) {
                sub.text = newText.trim();
                saveBacklogItems();
                showToast('Подпункт обновлен');
                const container = document.querySelector('.main-container');
                if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
            }
        }
    }
};

window.deleteSubtask = function(cardId, subId) {
    const card = backlogCustomItems.find(c => c.id === cardId);
    if (card) {
        card.subtasks = card.subtasks.filter(s => s.id !== subId);
        const completedCount = card.subtasks.filter(s => s.done).length;
        card.progress = card.subtasks.length > 0 ? Math.round((completedCount / card.subtasks.length) * 100) : 0;
        saveBacklogItems();
        showToast('Подпункт удален');
        const container = document.querySelector('.main-container');
        if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
    }
};

// Изменение дедлайна карточки бэклога
window.editBacklogDeadline = function(id) {
    const item = backlogCustomItems.find(i => i.id === id);
    if (!item) return;
    const newDeadline = prompt('Введите новый дедлайн (например, "Due today", "Tomorrow", "3 days"):', item.deadline);
    if (newDeadline !== null && newDeadline.trim()) {
        item.deadline = newDeadline.trim();
        item.urgent = item.deadline.toLowerCase().includes('today') || item.deadline.toLowerCase().includes('сейчас');
        saveBacklogItems();
        showToast('Дедлайн обновлен');
        const container = document.querySelector('.main-container');
        if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
    }
};

// Изменение дедлайна строчки бэклога
window.editBacklogRowDeadline = function(id) {
    const row = backlogRows.find(r => r.id === id);
    if (!row) return;
    const newDeadline = prompt('Введите новый дедлайн:', row.deadline);
    if (newDeadline !== null && newDeadline.trim()) {
        row.deadline = newDeadline.trim();
        row.urgent = row.deadline.toLowerCase().includes('today') || row.deadline.toLowerCase().includes('сейчас');
        saveBacklogRows();
        showToast('Дедлайн обновлен');
        const container = document.querySelector('.main-container');
        if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
    }
};

window.addSubtaskToSprint = async function(subtext) {
    localSprintTasks.push({ id: Date.now(), title: subtext, done: false });
    saveSprintData();
    await AppState.addNote({
        type: 'task', folder: 'sprint', title: subtext, text: '', todos: [], completed: false
    });
    showToast('🚀 Подпункт добавлен в Спринт!');
    const container = document.querySelector('.main-container');
    if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
};

window.rowToSprint = async function(title) {
    localSprintTasks.push({ id: Date.now(), title: title, done: false });
    saveSprintData();
    await AppState.addNote({
        type: 'task', folder: 'sprint', title: title, text: '', todos: [], completed: false
    });
    showToast('🚀 Задача добавлена в Спринт!');
    const container = document.querySelector('.main-container');
    if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
};

window.editBacklogItem = function(id) {
    const item = backlogCustomItems.find(i => i.id === id);
    if (!item) return;
    const newTitle = prompt('Редактировать плитку:', item.title);
    if (newTitle !== null && newTitle.trim()) {
        item.title = newTitle.trim();
        saveBacklogItems();
        showToast('Плитка обновлена');
        const container = document.querySelector('.main-container');
        if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
    }
};

window.deleteBacklogItem = function(id) {
    backlogCustomItems = backlogCustomItems.filter(i => i.id !== id);
    saveBacklogItems();
    showToast('Плитка удалена');
    const container = document.querySelector('.main-container');
    if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
};

window.editBacklogRow = function(id) {
    const row = backlogRows.find(r => r.id === id);
    if (!row) return;
    const newTitle = prompt('Редактировать задачу:', row.title);
    if (newTitle !== null && newTitle.trim()) {
        row.title = newTitle.trim();
        saveBacklogRows();
        showToast('Задача обновлена');
        const container = document.querySelector('.main-container');
        if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
    }
};

window.deleteBacklogRow = function(id) {
    backlogRows = backlogRows.filter(r => r.id !== id);
    saveBacklogRows();
    showToast('Задача удалена');
    const container = document.querySelector('.main-container');
    if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
};

window.addNewBacklogRow = function() {
    const title = prompt('Название простой задачи:');
    if (title && title.trim()) {
        const deadlineInput = prompt('Дедлайн (например, "Due today" или "Tomorrow"):', '3 days left');
        const isUrgent = confirm('Задача срочная? (ОК — да, Отмена — нет)');
        backlogRows.push({
            id: Date.now(),
            title: title.trim(),
            category: backlogFilterVal === 'All' ? 'Study' : backlogFilterVal,
            deadline: deadlineInput ? deadlineInput.trim() : '3 days left',
            urgent: isUrgent,
            done: false
        });
        saveBacklogRows();
        showToast('Задача добавлена');
        const container = document.querySelector('.main-container');
        if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
    }
};

window.editManifest = function(index) {
    const currentWord = manifestWords[index] || '';
    const newWord = prompt('Изменить тег манифеста:', currentWord);
    if (newWord !== null && newWord.trim()) {
        manifestWords[index] = newWord.trim().replace(/^#/, '');
        saveManifestData();
        showToast('Манифест обновлен');
        const container = document.querySelector('.main-container');
        if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
    }
};

window.addNewBacklogItemModal = function() {
    const title = prompt('Название новой плитки в Бэклог:');
    if (title && title.trim()) {
        backlogCustomItems.push({
            id: Date.now(),
            title: title.trim(),
            category: backlogFilterVal === 'All' ? 'Study' : backlogFilterVal,
            deadline: '3 days left',
            progress: 0,
            urgent: false,
            flipped: false,
            subtasks: [{ id: Date.now() + 1, text: 'Первый подпункт', done: false }]
        });
        saveBacklogItems();
        showToast('Плитка добавлена');
        const container = document.querySelector('.main-container');
        if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
    }
};

window.toggleGoal = function(id) {
    const goal = localRoadmapGoals.find(g => g.id === id);
    if (goal) {
        goal.done = !goal.done;
        saveRoadmapData();
        const container = document.querySelector('.main-container');
        if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
    }
};

window.editGoal = function(id) {
    const goal = localRoadmapGoals.find(g => g.id === id);
    if (goal) {
        const newText = prompt('Редактировать цель:', goal.text);
        if (newText !== null && newText.trim()) {
            goal.text = newText.trim();
            saveRoadmapData();
            const container = document.querySelector('.main-container');
            if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
        }
    }
};

window.deleteGoal = function(id) {
    localRoadmapGoals = localRoadmapGoals.filter(g => g.id !== id);
    saveRoadmapData();
    const container = document.querySelector('.main-container');
    if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
    showToast('Цель удалена');
};

window.toggleSprintTask = function(id) {
    const task = localSprintTasks.find(t => t.id === id);
    if (task) {
        task.done = !task.done;
        saveSprintData();
        const container = document.querySelector('.main-container');
        if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
    }
};

window.deleteSprintTask = function(id) {
    localSprintTasks = localSprintTasks.filter(t => t.id !== id);
    saveSprintData();
    const container = document.querySelector('.main-container');
    if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
    showToast('Задача удалена из Спринта');
};

window.switchDumpSub = function(sub) {
    dumpSubTab = sub;
    const container = document.querySelector('.main-container');
    if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
};

window.switchDumpDay = function(day) {
    activeDumpDay = day;
    expandedDumpNoteIndex = null;
    const container = document.querySelector('.main-container');
    if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
};

window.toggleDumpNoteExpand = function(idx) {
    expandedDumpNoteIndex = expandedDumpNoteIndex === idx ? null : idx;
    const container = document.querySelector('.main-container');
    if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
};

window.rescueDumpNote = async function(day, idx) {
    const noteObj = localDumpDays[day].notes[idx];
    await AppState.addNote({ type: 'feed', title: noteObj.title, text: noteObj.text || '' });
    localDumpDays[day].notes.splice(idx, 1);
    saveDumpData();
    showToast('✨ Спасено в Ленту!');
    const container = document.querySelector('.main-container');
    if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
};

window.deleteDumpNote = function(day, idx) {
    localDumpDays[day].notes.splice(idx, 1);
    saveDumpData();
    showToast('Заметка удалена');
    const container = document.querySelector('.main-container');
    if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
};

window.addNewCategory = function() {
    const cat = prompt('Введите название новой категории:');
    if (cat && cat.trim()) {
        const cleanCat = cat.trim();
        if (!backlogCategories.includes(cleanCat)) {
            backlogCategories.push(cleanCat);
            saveCategoriesData();
            showToast('Категория добавлена');
            const container = document.querySelector('.main-container');
            if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
        }
    }
};

window.editCategory = function(cat) {
    if (cat === 'All') return;
    const newName = prompt(`Переименовать категорию "${cat}":`, cat);
    if (newName && newName.trim() && newName.trim() !== 'All') {
        const cleanName = newName.trim();
        const index = backlogCategories.indexOf(cat);
        if (index !== -1) {
            backlogCategories[index] = cleanName;
            if (backlogFilterVal === cat) backlogFilterVal = cleanName;
            saveCategoriesData();
            showToast('Категория обновлена');
            const container = document.querySelector('.main-container');
            if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
        }
    }
};

window.deleteCategory = function(cat) {
    if (cat === 'All') return;
    if (confirm(`Удалить категорию "${cat}"?`)) {
        backlogCategories = backlogCategories.filter(c => c !== cat);
        if (backlogFilterVal === cat) backlogFilterVal = 'All';
        saveCategoriesData();
        showToast('Категория удалена');
        const container = document.querySelector('.main-container');
        if (container) UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
    }
};

export const UIRenderer = {
    renderList(container, notes, handlers) {
        window.currentHandlers = handlers;
        container.innerHTML = '';
        initTelegramSearchBar(handlers);
        updateFooterButtonsVisibility();

        let editToggleFooter = document.getElementById('globalEditModeBtn');
        if (!editToggleFooter) {
            const footerContainer = document.querySelector('.footer-container');
            if (footerContainer) {
                editToggleFooter = document.createElement('button');
                editToggleFooter.id = 'globalEditModeBtn';
                editToggleFooter.className = 'action-btn';
                editToggleFooter.title = 'Режим редактирования';
                editToggleFooter.innerHTML = '⚙️';
                editToggleFooter.onclick = () => window.toggleEditMode();
                footerContainer.insertBefore(editToggleFooter, footerContainer.firstChild);
            }
        }
        if (editToggleFooter) {
            editToggleFooter.style.background = isEditMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.12)';
        }

        const manifestEl = document.getElementById('manifestSection');
        const bornToWinEl = document.getElementById('bornToWinTitle');
        if (manifestEl && bornToWinEl) {
            if (AppState.currentTab === 'feed') {
                manifestEl.style.display = 'block';
                bornToWinEl.style.display = 'block';
                manifestEl.innerHTML = `
                    <div style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 20px; padding: 10px; backdrop-filter: blur(16px); text-align: center;">
                        <span style="font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.5); display: block; margin-bottom: 2px;">Манифест сезона ${isEditMode ? '(кликните для изменения)' : ''}</span>
                        <div style="display: flex; justify-content: center; gap: 10px; font-size: 11px; font-weight: 500;">
                            ${manifestWords.map((word, i) => `
                                <span ${isEditMode ? `onclick="window.editManifest(${i})"` : ''} style="font-style: italic; color: #34d399; ${isEditMode ? 'cursor: pointer; text-decoration: underline;' : ''}" title="${isEditMode ? 'Изменить тег' : ''}">#${word}</span>
                            `).join('')}
                        </div>
                    </div>
                `;
            } else {
                manifestEl.style.display = 'none';
                bornToWinEl.style.display = 'none';
            }
        }

        const tab = AppState.currentTab;

        // 1. БЭКЛОГ
        if (tab === 'backlog') {
            const chipsContainer = document.createElement('div');
            chipsContainer.style.cssText = 'display: flex; gap: 6px; margin-bottom: 16px; width: 100%; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; -ms-overflow-style: none;';
            const styleId = 'hideScrollbarStyle';
            if (!document.getElementById(styleId)) {
                const s = document.createElement('style');
                s.id = styleId;
                s.textContent = '::-webkit-scrollbar { display: none; }';
                document.head.appendChild(s);
            }
            
            backlogCategories.forEach(cat => {
                const chipWrap = document.createElement('div');
                const isActive = backlogFilterVal === cat;
                
                let urgentCount = 0;
                if (cat === 'All') {
                    urgentCount = backlogCustomItems.filter(i => i.urgent).length + backlogRows.filter(r => r.urgent).length;
                } else {
                    urgentCount = backlogCustomItems.filter(i => i.category === cat && i.urgent).length + backlogRows.filter(r => r.category === cat && r.urgent).length;
                }

                chipWrap.style.cssText = 'flex: 1; display: flex; align-items: center; justify-content: center; background: ' + (isActive ? '#fff' : 'rgba(255, 255, 255, 0.08)') + '; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 9999px; padding: 6px 10px; cursor: pointer; transition: all 0.2s; white-space: nowrap;';
                
                chipWrap.innerHTML = `
                    <span style="font-size: 11px; font-weight: 500; color: ${isActive ? '#0a0a0a' : '#fff'};">${cat}</span>
                    ${urgentCount > 0 ? `<span style="background: #f43f5e; color: #fff; font-size: 9px; padding: 0 5px; border-radius: 9px; margin-left: 4px; font-weight: bold;">${urgentCount}</span>` : ''}
                    ${isEditMode && cat !== 'All' ? `
                        <div style="display: flex; gap: 4px; margin-left: 6px; align-items: center;">
                            <span onclick="window.editCategory('${cat}')" title="Изменить" style="font-size: 9px; cursor: pointer;">✏️</span>
                            <span onclick="window.deleteCategory('${cat}')" title="Удалить" style="font-size: 10px; color: #f43f5e; font-weight: bold; cursor: pointer;">✕</span>
                        </div>
                    ` : ''}
                `;
                chipWrap.onclick = (e) => {
                    if (e.target.tagName === 'SPAN' && (e.target.title === 'Изменить' || e.target.title === 'Удалить')) return;
                    backlogFilterVal = cat;
                    UIRenderer.renderList(container, notes, handlers);
                };
                chipsContainer.appendChild(chipWrap);
            });

            if (isEditMode) {
                const addChipBtn = document.createElement('button');
                addChipBtn.textContent = '+';
                addChipBtn.style.cssText = 'background: rgba(255,255,255,0.1); border: 1px dashed rgba(255,255,255,0.3); color: #fff; padding: 6px 12px; border-radius: 9999px; font-size: 12px; cursor: pointer;';
                addChipBtn.onclick = () => window.addNewCategory();
                chipsContainer.appendChild(addChipBtn);
            }

            container.appendChild(chipsContainer);

            const filteredBacklog = backlogFilterVal === 'All' ? backlogCustomItems : backlogCustomItems.filter(i => i.category === backlogFilterVal);
            const filteredRows = backlogFilterVal === 'All' ? backlogRows : backlogRows.filter(r => r.category === backlogFilterVal);

            const grid = document.createElement('div');
            grid.style.cssText = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; width: 100%; margin-bottom: 14px;';

            filteredBacklog.forEach(item => {
                const card = document.createElement('div');
                card.style.cssText = `
                    background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15);
                    border-radius: 20px; padding: 14px; backdrop-filter: blur(16px);
                    display: flex; flex-direction: column; justify-content: space-between; height: 130px; position: relative; cursor: pointer; overflow: hidden;
                `;
                
                card.onclick = (e) => {
                    if (e.target.closest('button') || e.target.closest('span') || e.target.tagName === 'INPUT') return;
                    window.flipBacklogCard(item.id);
                };

                if (!item.flipped) {
                    card.innerHTML = `
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <span style="font-size: 8px; text-transform: uppercase; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 99px; color: #ccc;">${item.category}</span>
                                <div style="display: flex; gap: 6px; align-items: center;">
                                    <span ${isEditMode ? `onclick="event.stopPropagation(); window.editBacklogDeadline(${item.id})"` : ''} style="font-size: 9px; color: ${item.urgent ? '#f43f5e; font-weight:700;' : '#ffb74d'}; ${isEditMode ? 'cursor: pointer; text-decoration: underline;' : ''}" title="${isEditMode ? 'Изменить дедлайн' : ''}">${item.deadline}</span>
                                    ${isEditMode ? `
                                        <span onclick="window.editBacklogItem(${item.id})" title="Редактировать" style="font-size: 9px; cursor: pointer;">✏️</span>
                                        <span onclick="window.deleteBacklogItem(${item.id})" title="Удалить" style="font-size: 11px; color: #f43f5e; cursor: pointer; font-weight: bold;">✕</span>
                                    ` : ''}
                                </div>
                            </div>
                            <h4 style="margin: 0; font-size: 13px; color: #fff; font-weight: 500; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${item.title}</h4>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <div style="width: 100%; background: rgba(255,255,255,0.1); height: 4px; border-radius: 99px; overflow: hidden;">
                                <div style="background: rgba(255,255,255,0.7); height: 100%; width: ${item.progress}%;"></div>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: rgba(255,255,255,0.5);">
                                <span>${item.progress}%</span>
                                <span style="color: rgba(255,255,255,0.3); font-size: 8px;">↺ перевернуть</span>
                            </div>
                        </div>
                    `;
                } else {
                    let subtasksHtml = (item.subtasks || []).map(sub => `
                        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; background: rgba(0,0,0,0.25); padding: 3px 6px; border-radius: 6px;">
                            <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; flex: 1; overflow: hidden;">
                                <input type="checkbox" ${sub.done ? 'checked' : ''} onchange="window.toggleSubtask(${item.id}, ${sub.id})" style="accent-color: #10b981;" />
                                <span style="${sub.done ? 'text-decoration: line-through; opacity: 0.5;' : ''} white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sub.text}</span>
                            </label>
                            <div style="display: flex; gap: 4px; align-items: center;">
                                ${isEditMode ? `
                                    <span onclick="window.editSubtask(${item.id}, ${sub.id})" title="Изменить" style="font-size: 9px; cursor: pointer;">✏️</span>
                                    <span onclick="window.deleteSubtask(${item.id}, ${sub.id})" title="Удалить" style="font-size: 10px; color: #f43f5e; font-weight: bold; cursor: pointer;">✕</span>
                                ` : ''}
                                <button onclick="window.addSubtaskToSprint('${sub.text}')" title="В Спринт" style="background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.4); color: #34d399; font-size: 8px; padding: 2px 4px; border-radius: 4px; cursor: pointer; white-space: nowrap;">↗</button>
                            </div>
                        </div>
                    `).join('');

                    card.innerHTML = `
                        <div style="display: flex; flex-direction: column; height: 100%; justify-content: space-between;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-size: 9px; color: #34d399; font-weight: 600;">Подпункты</span>
                                <div style="display: flex; gap: 6px; align-items: center;">
                                    ${isEditMode ? `<button onclick="window.addSubtaskToCard(${item.id})" style="background:none; border:none; color:#34d399; font-size:10px; cursor:pointer;" title="Добавить подпункт">+ пп</button>` : ''}
                                    <span onclick="window.flipBacklogCard(${item.id})" style="font-size: 11px; color: #f43f5e; cursor: pointer; font-weight: bold;" title="Закрыть">✕</span>
                                </div>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 4px; overflow-y: auto; max-height: 64px; padding-right: 2px;">
                                ${subtasksHtml || '<span style="font-size:10px; color:rgba(255,255,255,0.4);">Нет подпунктов</span>'}
                            </div>
                            <div style="font-size: 8px; text-align: right; color: rgba(255,255,255,0.3);">↺ лицей</div>
                        </div>
                    `;
                }

                grid.appendChild(card);
            });
            container.appendChild(grid);

            const rowsHeader = document.createElement('div');
            rowsHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin: 12px 0 6px 4px;';
            rowsHeader.innerHTML = `
                <span style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.5);">Простые задачи (строчки)</span>
                <button onclick="window.addNewBacklogRow()" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-size: 10px; padding: 2px 8px; border-radius: 8px; cursor: pointer;">+ Строчка</button>
            `;
            container.appendChild(rowsHeader);

            const rowsContainer = document.createElement('div');
            rowsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 6px; width: 100%; max-height: 180px; overflow-y: auto; padding-right: 2px;';

            filteredRows.forEach(row => {
                const rEl = document.createElement('div');
                rEl.style.cssText = 'background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;';
                rEl.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                        <span style="font-size: 12px; color: #fff; font-weight: 500;">${row.title}</span>
                        <span ${isEditMode ? `onclick="window.editBacklogRowDeadline(${row.id})"` : ''} style="font-size: 9px; color: ${row.urgent ? '#f43f5e; font-weight:700;' : '#ffb74d'}; ${isEditMode ? 'cursor: pointer; text-decoration: underline;' : ''}" title="${isEditMode ? 'Изменить дедлайн' : ''}">${row.deadline}</span>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button onclick="window.rowToSprint('${row.title}')" style="font-size: 10px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #34d399; padding: 4px 8px; border-radius: 8px; cursor: pointer;">В Спринт ↗</button>
                        ${isEditMode ? `
                            <button onclick="window.editBacklogRow(${row.id})" style="background:none; border:none; cursor:pointer; font-size:10px;">✏️</button>
                            <button onclick="window.deleteBacklogRow(${row.id})" style="background:none; border:none; color:#f43f5e; cursor:pointer; font-size:11px; font-weight:bold;">✕</button>
                        ` : ''}
                    </div>
                `;
                rowsContainer.appendChild(rEl);
            });
            container.appendChild(rowsContainer);

            return;
        }

        // 2. ROADMAP
        if (tab === 'roadmap') {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 24px; padding: 20px; backdrop-filter: blur(16px); width: 100%;';
            
            let goalsHtml = localRoadmapGoals.map(g => `
                <div style="background: rgba(255,255,255,0.05); padding: 12px 14px; border-radius: 14px; font-size: 13px; border: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
                    <span style="${g.done ? 'text-decoration: line-through; opacity: 0.5;' : ''}">${g.text}</span>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        ${isEditMode ? `
                            <button onclick="window.editGoal(${g.id})" title="Редактировать" style="background:none; border:none; color:rgba(255,255,255,0.5); cursor:pointer; font-size:11px;">✏️</button>
                            <button onclick="window.deleteGoal(${g.id})" title="Удалить цель" style="background:none; border:none; color:rgba(244,63,94,0.7); cursor:pointer; font-size:13px; font-weight:bold;">✕</button>
                        ` : ''}
                        <button onclick="window.toggleGoal(${g.id})" style="width: 16px; height: 16px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.3); background: ${g.done ? '#10b981' : 'transparent'}; cursor:pointer;"></button>
                    </div>
                </div>
            `).join('');

            wrap.innerHTML = `
                <span style="font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.5); display: block; text-align: center; margin-bottom: 4px;">Стратегия</span>
                <h3 style="margin: 0 0 16px 0; font-size: 15px; text-align: center; color: #fff; font-weight: 600;">Цели на сезон (Roadmap)</h3>
                <div style="display: flex; gap: 8px; margin-bottom: 14px;">
                    <input type="text" id="roadmapInputText" placeholder="Новая цель на сезон..." style="flex:1; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); padding:8px 12px; border-radius:12px; color:#fff; font-size:12px; outline:none;">
                    <button id="roadmapAddBtn" style="background:rgba(255,255,255,0.2); border:none; color:#fff; padding:0 14px; border-radius:12px; font-size:14px; cursor:pointer;">+</button>
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">${goalsHtml}</div>
            `;
            container.appendChild(wrap);

            setTimeout(() => {
                const addBtn = document.getElementById('roadmapAddBtn');
                if (addBtn) {
                    addBtn.onclick = () => {
                        const inp = document.getElementById('roadmapInputText');
                        if (inp && inp.value.trim()) {
                            localRoadmapGoals.push({ id: Date.now(), text: inp.value.trim(), done: false });
                            saveRoadmapData();
                            showToast('Цель добавлена в Roadmap');
                            UIRenderer.renderList(container, notes, handlers);
                        }
                    };
                }
            }, 50);
            return;
        }

        // 3. СПРИНТ
        if (tab === 'sprint') {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display: flex; flex-direction: column; gap: 12px; width: 100%;';

            const headerCard = document.createElement('div');
            headerCard.style.cssText = 'background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.2); border-radius: 24px; padding: 16px; text-align: center;';
            headerCard.innerHTML = `
                <span style="font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #fda4af; display: block; margin-bottom: 2px;">Зона экстрима на сегодня</span>
                <h3 style="margin: 0; font-size: 14px; color: #fff; font-weight: 600;">Спринт</h3>
            `;
            wrap.appendChild(headerCard);

            const tasksContainer = document.createElement('div');
            tasksContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

            localSprintTasks.forEach(task => {
                const tEl = document.createElement('div');
                tEl.style.cssText = 'background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 20px; padding: 14px; display: flex; justify-content: space-between; align-items: center;';
                tEl.innerHTML = `
                    <span style="font-size: 13px; color: #fff; ${task.done ? 'text-decoration: line-through; opacity: 0.5;' : ''}">${task.title}</span>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        ${isEditMode ? `<button onclick="window.deleteSprintTask(${task.id})" title="Удалить задачу" style="background:none; border:none; color:rgba(244,63,94,0.7); cursor:pointer; font-size:13px; font-weight:bold;">✕</button>` : ''}
                        <button onclick="window.toggleSprintTask(${task.id})" style="width: 16px; height: 16px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.3); background: ${task.done ? '#f43f5e' : 'transparent'}; cursor:pointer;"></button>
                    </div>
                `;
                tasksContainer.appendChild(tEl);
            });

            wrap.appendChild(tasksContainer);
            container.appendChild(wrap);
            return;
        }

        // 4. DUMP
        if (tab === 'dump' || tab === 'livedump') {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display: flex; flex-direction: column; gap: 12px; width: 100%;';

            let daysButtonsHtml = Object.keys(localDumpDays).map(dKey => {
                const isCurrent = activeDumpDay === dKey;
                const isAutoActive = getInitialDumpDay() === dKey;
                return `
                    <button onclick="window.switchDumpDay('${dKey}')" style="flex:1; padding: 8px 4px; border-radius: 12px; font-size: 11px; border: 1px solid rgba(255,255,255,0.15); background: ${isCurrent ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.05)'}; color: #fff; cursor: pointer; position: relative;">
                        ${localDumpDays[dKey].title}
                        ${isAutoActive ? '<span style="position: absolute; top: 2px; right: 4px; font-size: 8px; color: #34d399;" title="Актуальный день">●</span>' : ''}
                    </button>
                `;
            }).join('');

            let notesHtml = (localDumpDays[activeDumpDay]?.notes || []).map((noteObj, idx) => {
                const isExpanded = expandedDumpNoteIndex === idx;
                return `
                    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; overflow: hidden; transition: all 0.2s;">
                        <div onclick="window.toggleDumpNoteExpand(${idx})" style="padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; cursor: pointer;">
                            <span style="font-weight: 500; color: #fff;">${noteObj.title}</span>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <button onclick="event.stopPropagation(); window.rescueDumpNote('${activeDumpDay}', ${idx})" style="font-size: 10px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #34d399; padding: 4px 8px; border-radius: 8px; cursor: pointer;">В Ленту ↗</button>
                                ${isEditMode ? `<button onclick="event.stopPropagation(); window.deleteDumpNote('${activeDumpDay}', ${idx})" style="background:none; border:none; color:rgba(244,63,94,0.7); cursor:pointer; font-size:12px; padding: 0 4px;" title="Удалить">✕</button>` : ''}
                                <span style="font-size: 10px; color: rgba(255,255,255,0.5);">${isExpanded ? '▲' : '▼'}</span>
                            </div>
                        </div>
                        ${isExpanded ? `
                            <div style="padding: 0 14px 14px 14px; font-size: 12px; color: rgba(255,255,255,0.8); border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px; white-space: pre-wrap; line-height: 1.4;">
                                ${noteObj.text || 'Нет детального описания мысли.'}
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');

            wrap.innerHTML = `
                <div style="display: flex; gap: 6px;">
                    <button onclick="window.switchDumpSub('evening')" style="flex:1; padding: 8px; border-radius: 12px; font-size: 12px; border: 1px solid rgba(255,255,255,0.15); background: ${dumpSubTab === 'evening' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.05)'}; color: #fff; cursor: pointer;">Сброс (Dump)</button>
                    <button onclick="window.switchDumpSub('uncompleted')" style="flex:1; padding: 8px; border-radius: 12px; font-size: 12px; border: 1px solid rgba(255,255,255,0.15); background: ${dumpSubTab === 'uncompleted' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.05)'}; color: #fff; cursor: pointer;">Невыполненное</button>
                </div>

                ${dumpSubTab === 'evening' ? `
                    <div style="display: flex; gap: 6px;">${daysButtonsHtml}</div>
                    <div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; padding: 14px; backdrop-filter: blur(16px); display: flex; flex-direction: column; gap: 8px;">
                        <div style="display: flex; gap: 6px; flex-direction: column;">
                            <input type="text" id="dumpTitleInput" placeholder="Заголовок мысли..." style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); padding:8px 12px; border-radius:12px; color:#fff; font-size:12px; outline:none;">
                            <div style="display: flex; gap: 6px;">
                                <input type="text" id="dumpNoteInput" placeholder="Поток мыслей перед сном..." style="flex:1; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); padding:8px 12px; border-radius:12px; color:#fff; font-size:12px; outline:none;">
                                <button id="dumpAddBtn" style="background:rgba(255,255,255,0.2); border:none; color:#fff; padding:0 14px; border-radius:12px; font-size:14px; cursor:pointer;">+</button>
                            </div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">${notesHtml}</div>
                    </div>
                ` : `
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${(localAppData?.uncompletedSprint || []).map(item => `
                            <div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; padding: 14px; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-size: 13px; color: #fff; font-weight: 500;">${item.title}</div>
                                    <div style="font-size: 10px; color: #f43f5e;">${item.info}</div>
                                </div>
                                <button style="font-size: 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 6px 10px; border-radius: 10px; cursor: pointer;">В Бэклог</button>
                            </div>
                        `).join('')}
                    </div>
                `}
            `;
            container.appendChild(wrap);

            setTimeout(() => {
                const dumpAddBtn = document.getElementById('dumpAddBtn');
                if (dumpAddBtn) {
                    dumpAddBtn.onclick = () => {
                        const titleInp = document.getElementById('dumpTitleInput');
                        const textInp = document.getElementById('dumpNoteInput');
                        const titleVal = titleInp ? titleInp.value.trim() : '';
                        const textVal = textInp ? textInp.value.trim() : '';
                        
                        if (titleVal || textVal) {
                            localDumpDays[activeDumpDay].notes.push({
                                title: titleVal || textVal.slice(0, 25) + '...',
                                text: textVal
                            });
                            saveDumpData();
                            showToast('Заметка добавлена в Dump');
                            UIRenderer.renderList(container, notes, handlers);
                        }
                    };
                }
            }, 50);
            return;
        }

        // 5. ЛЕНТА
        if (!notes || notes.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.style.cssText = 'text-align: center; color: rgba(255,255,255,0.4); margin-top: 40px; font-size: 13px; width: 100%;';
            emptyEl.textContent = 'Ничего не найдено';
            container.appendChild(emptyEl);
            return;
        }

        notes.forEach(note => {
            const card = document.createElement('div');
            card.className = 'note-card';
            card.style.cssText = 'cursor: pointer; width: 100%; position: relative;';

            card.onclick = (e) => {
                if (e.target.closest('.delete-btn') || e.target.closest('.todo-checkbox') || e.target.closest('.note-media-img') || e.target.closest('.edit-post-btn')) return;
                if (handlers.onEditNote) handlers.onEditNote(note);
            };

            let mediaHtml = '';
            if (note.media && note.media.length > 0) {
                mediaHtml = '<div style="display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;">';
                note.media.forEach((url, imgIdx) => {
                    mediaHtml += `<img src="${url}" class="note-media-img" data-id="${note.id}" data-imgidx="${imgIdx}" style="width: 70px; height: 70px; object-fit: cover; border-radius: 10px; cursor: pointer; border: 1px solid rgba(255,255,255,0.15);">`;
                });
                mediaHtml += '</div>';
            }

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                    <h3 style="margin: 0; font-size: 15px; color: #fff; font-weight: 600;">${note.title || 'Без названия'}</h3>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        ${isEditMode ? `
                            <button class="edit-post-btn" data-id="${note.id}" style="background: none; border: none; color: rgba(255,255,255,0.6); cursor: pointer; font-size: 13px;" title="Редактировать пост">✏️</button>
                            <button class="delete-btn" data-id="${note.id}" style="background: none; border: none; color: rgba(244,63,94,0.8); cursor: pointer; font-size: 16px;">✕</button>
                        ` : ''}
                    </div>
                </div>
                <p>${note.text || ''}</p>
                ${note.hashtag ? `<span style="display: inline-block; background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 8px; font-size: 11px; color: #ddd; margin-bottom: 8px;">${note.hashtag}</span>` : ''}
                ${mediaHtml}
                <div style="font-size: 10px; color: rgba(255,255,255,0.4); text-align: right; margin-top: 6px;">${note.createdAt}</div>
            `;
            container.appendChild(card);
        });

        setTimeout(() => {
            const viewport = document.querySelector('.scroll-viewport');
            if (viewport) {
                viewport.scrollTop = viewport.scrollHeight;
            }
        }, 50);

        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const id = Number(datasetIdSafely(btn));
                if (handlers.onDelete) handlers.onDelete(id);
            };
        });

        container.querySelectorAll('.edit-post-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const id = Number(datasetIdSafely(btn));
                const note = notes.find(n => n.id === id);
                if (note && handlers.onEditNote) {
                    handlers.onEditNote(note);
                }
            };
        });
    }
};

function datasetIdSafely(el) {
    return el.dataset.id;
}

document.addEventListener('DOMContentLoaded', () => {
    const searchToggleBtn = document.getElementById('searchToggleBtn');
    searchToggleBtn?.addEventListener('click', () => {
        isSearchOpen = !isSearchOpen;
        initTelegramSearchBar(window.currentHandlers);
        const viewport = document.querySelector('.scroll-viewport');
        if (viewport) viewport.style.paddingTop = isSearchOpen ? '120px' : '65px';
    });

    setTimeout(() => {
        document.querySelectorAll('.menu-btn[data-tab]').forEach(btn => {
            const originalClick = btn.onclick;
            btn.onclick = (e) => {
                const tabName = btn.getAttribute('data-tab');
                if (tabName === 'roadmap' || tabName === 'dump' || tabName === 'livedump' || tabName === 'sprint' || tabName === 'backlog' || tabName === 'feed') {
                    e.stopImmediatePropagation();
                    AppState.currentTab = tabName;
                    
                    document.querySelectorAll('.menu-btn[data-tab]').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    const container = document.querySelector('.main-container');
                    if (container && window.currentHandlers) {
                        UIRenderer.renderList(container, AppState.getFilteredNotes(), window.currentHandlers);
                    }
                } else if (originalClick) {
                    originalClick(e);
                }
            };
        });
    }, 300);
});