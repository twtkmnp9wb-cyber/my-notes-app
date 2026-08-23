document.addEventListener('DOMContentLoaded', () => {
    console.log('App loaded successfully.');

    // --- 1. ОБОИ И ТЕМЫ ---
    const bgLayer = document.getElementById('bgLayer');
    const bgGallery = document.getElementById('bgGallery');
    const bgScaleRange = document.getElementById('bgScaleRange');
    const scaleValueText = document.getElementById('scaleValueText');
    const bgFileInput = document.getElementById('bgFileInput');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');

    let customWallpapers = JSON.parse(localStorage.getItem('my_custom_wallpapers')) || [];
    let currentBg = localStorage.getItem('app_background') || '#09090b';
    let currentScale = localStorage.getItem('app_background_scale') || '100';

    const defaultWallpapers = [
        { id: 'dark-default', title: 'OLED Black', value: '#09090b' },
        { id: 'theme-nebula', title: 'Cyber Purple', value: 'radial-gradient(circle at 80% 20%, rgba(130, 50, 220, 0.35) 0%, rgba(15, 10, 25, 0.85) 50%, rgba(8, 8, 12, 1) 90%)' },
        { id: 'theme-deepblue', title: 'Midnight macOS', value: 'radial-gradient(circle at 85% 15%, rgba(0, 110, 255, 0.3) 0%, rgba(10, 20, 45, 0.85) 50%, rgba(5, 8, 14, 1) 90%)' },
        { id: 'theme-aurora', title: 'Emerald Glow', value: 'radial-gradient(circle at 80% 20%, rgba(0, 180, 100, 0.3) 0%, rgba(10, 30, 20, 0.85) 50%, rgba(6, 12, 10, 1) 90%)' }
    ];

    function applyBackground(bgValue, scale = currentScale) {
        currentBg = bgValue;
        currentScale = scale;
        localStorage.setItem('app_background', bgValue);
        localStorage.setItem('app_background_scale', scale);

        const targetBgLayer = document.getElementById('bgLayer');
        if (!targetBgLayer) return;

        const scaleFactor = scale / 100;
        targetBgLayer.style.transform = `scale(${scaleFactor})`;
        targetBgLayer.style.transformOrigin = 'center center';
        
        targetBgLayer.style.background = '';
        targetBgLayer.style.backgroundColor = '';
        targetBgLayer.style.backgroundImage = '';

        if (bgValue.startsWith('data:') || bgValue.startsWith('http') || bgValue.startsWith('blob:')) {
            targetBgLayer.style.setProperty('background-image', `url("${bgValue}")`, 'important');
            targetBgLayer.style.setProperty('background-size', 'cover', 'important');
            targetBgLayer.style.setProperty('background-position', 'center', 'important');
            targetBgLayer.style.setProperty('background-repeat', 'no-repeat', 'important');
        } else if (bgValue.includes('gradient')) {
            targetBgLayer.style.setProperty('background', bgValue, 'important');
        } else {
            targetBgLayer.style.setProperty('background-color', bgValue, 'important');
        }

        if (scaleValueText) scaleValueText.textContent = `${scale}%`;
        if (bgScaleRange && bgScaleRange.value !== String(scale)) bgScaleRange.value = scale;
        
        renderWallpapers();
    }

    function renderWallpapers() {
        if (!bgGallery) return;
        bgGallery.innerHTML = '';
        
        defaultWallpapers.forEach(item => {
            const card = document.createElement('div');
            card.classList.add('wallpaper-card');
            card.style.background = item.value;
            if (item.value === currentBg) card.classList.add('active');
            card.innerHTML = `<span class="wallpaper-card-title">${item.title}</span>`;
            card.addEventListener('click', () => applyBackground(item.value));
            bgGallery.appendChild(card);
        });

        customWallpapers.forEach((item, index) => {
            const card = document.createElement('div');
            card.classList.add('wallpaper-card');
            card.style.backgroundImage = `url("${item.value}")`;
            card.style.backgroundSize = 'cover';
            card.style.backgroundPosition = 'center';
            if (item.value === currentBg) card.classList.add('active');
            
            card.innerHTML = `
                <span class="wallpaper-card-title">${item.title || 'Свои обои'}</span>
                <button type="button" class="delete-bg-btn" title="Удалить обои">×</button>
            `;

            card.addEventListener('click', (e) => {
                if (e.target.closest('.delete-bg-btn')) return;
                applyBackground(item.value);
            });

            const delBtn = card.querySelector('.delete-bg-btn');
            if (delBtn) {
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    customWallpapers.splice(index, 1);
                    localStorage.setItem('my_custom_wallpapers', JSON.stringify(customWallpapers));
                    if (currentBg === item.value) applyBackground('#09090b');
                    else renderWallpapers();
                });
            }
            bgGallery.appendChild(card);
        });
    }

    if (bgScaleRange) {
        bgScaleRange.addEventListener('input', (e) => applyBackground(currentBg, e.target.value));
    }

    if (bgFileInput) {
        bgFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target.result;
                const titleInput = document.getElementById('customBgTitleInput');
                const customTitle = titleInput ? titleInput.value.trim() : 'Свои обои';
                
                customWallpapers.push({ 
                    id: 'custom-' + Date.now(), 
                    title: customTitle || 'Свои обои', 
                    value: base64 
                });
                
                localStorage.setItem('my_custom_wallpapers', JSON.stringify(customWallpapers));
                if (titleInput) titleInput.value = '';
                applyBackground(base64);
            };
            reader.readAsDataURL(file);
        });
    }

    applyBackground(currentBg, currentScale);

    // Быстрые теги
    document.querySelectorAll('.tag-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const input = document.getElementById('noteHashtagInput');
            if (input) input.value = chip.textContent.trim();
        });
    });

    // --- 2. МЕНЮ, ВКЛАДКИ И ЗАМЕТКИ/ЗАДАЧИ ---
    const menuButtons = document.querySelectorAll('.menu-btn');
    const searchBtn = document.getElementById('searchBtn');
    const addNoteBtn = document.getElementById('addNoteBtn');
    
    const noteModal = document.getElementById('noteModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const saveNoteBtn = document.getElementById('saveNoteBtn');
    
    const noteTitleInput = document.getElementById('noteTitleInput');
    const noteTextInput = document.getElementById('noteTextInput');
    const noteHashtagInput = document.getElementById('noteHashtagInput');
    const notesContainer = document.querySelector('.main-container');

    // Новые элементы управления типом (Лента vs Задача)
    const typeFeedBtn = document.getElementById('typeFeedBtn');
    const typeTaskBtn = document.getElementById('typeTaskBtn');
    const feedFieldsBlock = document.getElementById('feedFieldsBlock');
    const taskFieldsBlock = document.getElementById('taskFieldsBlock');
    const taskTargetFolder = document.getElementById('taskTargetFolder');
    const taskDeadlineInput = document.getElementById('taskDeadlineInput');
    const todoItemsContainer = document.getElementById('todoItemsContainer');
    const addTodoItemBtn = document.getElementById('addTodoItemBtn');

    let currentEntryType = 'feed'; // 'feed' или 'task'
    let activeTab = localStorage.getItem('app_active_tab') || 'feed';
    let notes = JSON.parse(localStorage.getItem('app_notes')) || [];

    let searchResults = [];
    let currentSearchIndex = 0;
    let isSearchActive = false;

    const searchBarContainer = document.getElementById('telegramSearchBar');
    const tgSearchInput = document.getElementById('tgSearchInput');
    const tgSearchCounter = document.getElementById('tgSearchCounter');
    const tgPrevBtn = document.getElementById('tgPrevBtn');
    const tgNextBtn = document.getElementById('tgNextBtn');
    const tgCloseBtn = document.getElementById('tgCloseBtn');

    function formatCleanDate(dateInput) {
        if (!dateInput) return '';
        let d = new Date(dateInput);
        if (isNaN(d)) return dateInput.replace(/[,;]/g, '').replace(/\bв\b/gi, '').trim();
        const dayMonth = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
        const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${dayMonth} ${time}`;
    }

    // РЕНДЕР КАРТОЧЕК
    window.renderNotes = function(filterTag = '', highlightIndex = -1) {
        if (!notesContainer) return;
        notesContainer.innerHTML = '';

        const isFeed = activeTab === 'feed';
        const folderNotes = notes.filter(note => (note.folder || 'feed') === activeTab);

        const filteredNotes = folderNotes.filter(note => {
            if (!filterTag || !isFeed) return true;
            const tag = note.hashtag ? note.hashtag.toLowerCase() : '';
            return tag.includes(filterTag.toLowerCase());
        });

        searchResults = filteredNotes;

        if (isSearchActive && filterTag && isFeed) {
            tgSearchCounter.textContent = searchResults.length > 0 
                ? `${currentSearchIndex + 1} из ${searchResults.length}` 
                : '0 из 0';
        }

        filteredNotes.forEach((note, fIndex) => {
            const realIndex = notes.indexOf(note);
            const card = document.createElement('div');
            card.classList.add('note-card');
            card.setAttribute('data-search-id', fIndex);

            if (isSearchActive && filterTag && fIndex === highlightIndex && isFeed) {
                card.style.borderColor = '#ffffff';
                card.style.boxShadow = '0 0 15px rgba(255, 255, 255, 0.4)';
            }

            const cleanTime = formatCleanDate(note.time);

            // Если карточка — Задача с чек-листом (Спринт или Бэклог)
            if (note.type === 'task') {
                let checklistHtml = '';
                if (note.todos && note.todos.length > 0) {
                    checklistHtml = '<div class="task-checklist">' + note.todos.map((todo, tIdx) => `
                        <label class="task-todo-item ${todo.done ? 'done' : ''}">
                            <input type="checkbox" data-note-idx="${realIndex}" data-todo-idx="${tIdx}" ${todo.done ? 'checked' : ''} class="todo-checkbox">
                            <span>${escapeHtml(todo.text)}</span>
                        </label>
                    `).join('') + '</div>';
                }

                let deadlineHtml = note.deadline ? `<span class="task-deadline-badge">⏳ До: ${note.deadline}</span>` : '<span></span>';

                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <h3 class="note-title">${escapeHtml(note.title)}</h3>
                        ${deadlineHtml}
                    </div>
                    ${note.text ? `<p class="note-text">${escapeHtml(note.text)}</p>` : ''}
                    ${checklistHtml}
                    <div class="note-footer" style="margin-top: 12px;">
                        <span style="font-size: 0.75rem; color: rgba(255,255,255,0.4);">Создано: ${cleanTime}</span>
                        <button type="button" class="delete-note-btn" data-index="${realIndex}">×</button>
                    </div>
                `;
            } else {
                // Карточка Ленты
                const hashtagHtml = (isFeed && note.hashtag) 
                    ? `<span class="note-hashtag">${escapeHtml(note.hashtag)}</span>` 
                    : '<span></span>';

                let imagesHtml = '';
                if (note.images && note.images.length > 0) {
                    const imgsJson = JSON.stringify(note.images).replace(/"/g, '&quot;');
                    const imgsGrid = note.images.map((img, imgIdx) => `
                        <img src="${img}" onclick="openLightbox(${imgsJson}, ${imgIdx})" alt="Attached media" />
                    `).join('');
                    imagesHtml = `<div class="note-images-grid">${imgsGrid}</div>`;
                }

                card.innerHTML = `
                    <h3 class="note-title">${escapeHtml(note.title)}</h3>
                    <p class="note-text">${escapeHtml(note.text)}</p>
                    ${imagesHtml}
                    <div class="note-footer">
                        ${hashtagHtml}
                        <span class="note-time">${cleanTime}</span>
                    </div>
                    <button type="button" class="delete-note-btn" data-index="${realIndex}">×</button>
                `;
            }

            notesContainer.appendChild(card);
        });

        // Слушатели галочек подзадач
        document.querySelectorAll('.todo-checkbox').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const noteIdx = parseInt(e.target.getAttribute('data-note-idx'));
                const todoIdx = parseInt(e.target.getAttribute('data-todo-idx'));
                notes[noteIdx].todos[todoIdx].done = e.target.checked;
                localStorage.setItem('app_notes', JSON.stringify(notes));
                renderNotes(isSearchActive ? tgSearchInput.value.trim() : '');
            });
        });

        // Удаление
        document.querySelectorAll('.delete-note-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-index');
                notes.splice(idx, 1);
                localStorage.setItem('app_notes', JSON.stringify(notes));
                renderNotes(isSearchActive ? tgSearchInput.value.trim() : '');
            });
        });
    }

    function escapeHtml(str) {
        return (str || '').replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    function updateTabUI() {
        const isFeed = activeTab === 'feed';
        if (searchBtn) searchBtn.style.display = isFeed ? 'flex' : 'none';
    }

    function switchTab(tabName, btnElement) {
        activeTab = tabName.toLowerCase();
        localStorage.setItem('app_active_tab', activeTab);

        menuButtons.forEach(b => b.classList.remove('active'));
        if (btnElement) btnElement.classList.add('active');

        updateTabUI();

        if (isSearchActive && activeTab !== 'feed') closeSearch();
        else renderNotes();
    }

    menuButtons.forEach(btn => {
        const tab = btn.getAttribute('data-tab') || btn.textContent.trim().toLowerCase();

        if (tab === 'settings') {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (settingsModal) settingsModal.classList.add('active');
                renderWallpapers();
            });
            return;
        }

        if (tab === activeTab) switchTab(tab, btn);

        btn.addEventListener('click', () => switchTab(tab, btn));
    });

    updateTabUI();

    // --- 3. ПЕРЕКЛЮЧЕНИЕ ТИПА ЗАПИСИ (Лента / Задача) ---
    function setEntryType(type) {
        currentEntryType = type;
        if (type === 'feed') {
            typeFeedBtn.classList.add('active');
            typeTaskBtn.classList.remove('active');
            feedFieldsBlock.style.display = 'block';
            taskFieldsBlock.style.display = 'none';
        } else {
            typeTaskBtn.classList.add('active');
            typeFeedBtn.classList.remove('active');
            feedFieldsBlock.style.display = 'none';
            taskFieldsBlock.style.display = 'block';
            if (activeTab === 'sprint' || activeTab === 'backlog') {
                taskTargetFolder.value = activeTab;
            }
        }
    }

    if (typeFeedBtn) typeFeedBtn.addEventListener('click', () => setEntryType('feed'));
    if (typeTaskBtn) typeTaskBtn.addEventListener('click', () => setEntryType('task'));

    // ЧЕК-ЛИСТ ДИНАМИКА
    if (addTodoItemBtn) {
        addTodoItemBtn.addEventListener('click', () => {
            const row = document.createElement('div');
            row.classList.add('todo-input-row');
            row.innerHTML = `
                <input type="text" placeholder="Подзадача..." class="modal-input todo-text-input">
                <button type="button" class="remove-todo-btn">×</button>
            `;
            row.querySelector('.remove-todo-btn').addEventListener('click', () => row.remove());
            todoItemsContainer.appendChild(row);
        });
    }

    // МОДАЛКА И СОХРАНЕНИЕ
    if (addNoteBtn) {
        addNoteBtn.addEventListener('click', () => {
            if (noteTitleInput) noteTitleInput.value = '';
            if (noteTextInput) noteTextInput.value = '';
            if (noteHashtagInput) noteHashtagInput.value = '';
            if (taskDeadlineInput) taskDeadlineInput.value = '';
            if (todoItemsContainer) todoItemsContainer.innerHTML = '';
            attachedImages = [];
            renderMediaPreviews();

            // Если открыто на вкладке sprint или backlog - ставим тип "Задача" автоматом
            if (activeTab === 'sprint' || activeTab === 'backlog') {
                setEntryType('task');
            } else {
                setEntryType('feed');
            }

            if (noteModal) noteModal.classList.add('active');
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            if (noteModal) noteModal.classList.remove('active');
        });
    }

    // LIVE DUMP
    const liveDumpBtn = document.getElementById('liveDumpBtn');
    const dumpModal = document.getElementById('dumpModal');
    const closeDumpBtn = document.getElementById('closeDumpBtn');
    const liveDumpArea = document.getElementById('liveDumpArea');

    if (liveDumpArea) {
        liveDumpArea.value = localStorage.getItem('app_live_dump') || '';
        liveDumpArea.addEventListener('input', (e) => {
            localStorage.setItem('app_live_dump', e.target.value);
        });
    }

    if (liveDumpBtn) {
        liveDumpBtn.addEventListener('click', () => {
            if (dumpModal) dumpModal.classList.add('active');
        });
    }

    if (closeDumpBtn) {
        closeDumpBtn.addEventListener('click', () => {
            if (dumpModal) dumpModal.classList.remove('active');
        });
    }

    // МЕДИА ПРИКРЕПЛЕНИЕ
    const noteMediaInput = document.getElementById('noteMediaInput');
    const mediaPreviewContainer = document.getElementById('mediaPreviewContainer');
    let attachedImages = [];

    if (noteMediaInput) {
        noteMediaInput.addEventListener('change', function(event) {
            const files = event.target.files;
            if (!files.length) return;

            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onload = function(e) {
                    attachedImages.push(e.target.result);
                    renderMediaPreviews();
                };
                reader.readAsDataURL(file);
            });

            noteMediaInput.value = '';
        });
    }

    function renderMediaPreviews() {
        if (!mediaPreviewContainer) return;
        mediaPreviewContainer.innerHTML = '';

        if (attachedImages.length === 0) {
            mediaPreviewContainer.style.display = 'none';
            return;
        }

        mediaPreviewContainer.style.cssText = 'display: flex !important; gap: 10px !important; overflow-x: auto !important; flex-wrap: nowrap !important; margin-top: 10px !important; padding-top: 10px !important; padding-bottom: 6px !important; width: 100% !important;';

        attachedImages.forEach((imgBase64, index) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'position: relative !important; flex: 0 0 70px !important; width: 70px !important; height: 70px !important; margin-top: 4px !important;';
            const imgsJson = JSON.stringify(attachedImages).replace(/"/g, '&quot;');
            wrap.innerHTML = `
                <img src="${imgBase64}" onclick="openLightbox(${imgsJson}, ${index})" alt="Preview" style="width: 70px !important; height: 70px !important; object-fit: cover !important; border-radius: 8px !important; border: 1px solid rgba(255,255,255,0.2) !important; cursor: pointer !important; display: block !important;" />
                <button type="button" class="remove-preview-btn" data-index="${index}" style="position: absolute !important; top: -8px !important; right: -8px !important; background: rgba(0,0,0,0.85) !important; color: #fff !important; border: 1px solid rgba(255,255,255,0.3) !important; border-radius: 50% !important; width: 22px !important; height: 22px !important; font-size: 11px !important; cursor: pointer !important; display: flex !important; align-items: center !important; justify-content: center !important; z-index: 10 !important;">✕</button>
            `;
            mediaPreviewContainer.appendChild(wrap);
        });

        mediaPreviewContainer.querySelectorAll('.remove-preview-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'));
                attachedImages.splice(idx, 1);
                renderMediaPreviews();
            });
        });
    }

    // КНОПКА СОХРАНИТЬ
    if (saveNoteBtn) {
        saveNoteBtn.addEventListener('click', () => {
            const title = noteTitleInput ? noteTitleInput.value.trim() : '';
            const text = noteTextInput ? noteTextInput.value.trim() : '';

            if (currentEntryType === 'feed') {
                const hashtag = noteHashtagInput ? noteHashtagInput.value.trim() : '';
                if (!title && !text && attachedImages.length === 0) {
                    alert('Заполните заголовок, текст или прикрепите фото!');
                    return;
                }

                notes.push({
                    type: 'feed',
                    folder: 'feed',
                    title: title || 'Без названия',
                    text: text,
                    hashtag: hashtag ? (hashtag.startsWith('#') ? hashtag : '#' + hashtag) : '',
                    time: new Date().toISOString(),
                    images: [...attachedImages]
                });
            } else {
                // Задача
                if (!title) {
                    alert('Введите название задачи!');
                    return;
                }

                const todos = [];
                document.querySelectorAll('.todo-text-input').forEach(inp => {
                    const val = inp.value.trim();
                    if (val) todos.push({ text: val, done: false });
                });

                notes.push({
                    type: 'task',
                    folder: taskTargetFolder.value,
                    title: title,
                    text: text,
                    deadline: taskDeadlineInput.value || null,
                    todos: todos,
                    carryCount: 0, // Счетчик переносов для 3 правил Заповеди
                    time: new Date().toISOString()
                });
            }

            localStorage.setItem('app_notes', JSON.stringify(notes));

            if (noteModal) noteModal.classList.remove('active');
            renderNotes(isSearchActive ? tgSearchInput.value.trim() : '');
        });
    }

    // ПОИСК
    function openSearch() {
        if (activeTab !== 'feed') return;
        isSearchActive = true;
        if (searchBarContainer) searchBarContainer.style.display = 'flex';
        if (tgSearchInput) {
            tgSearchInput.value = '';
            tgSearchInput.focus();
        }
        currentSearchIndex = 0;
        renderNotes('');
    }

    function closeSearch() {
        isSearchActive = false;
        if (searchBarContainer) searchBarContainer.style.display = 'none';
        renderNotes('');
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (isSearchActive) closeSearch();
            else openSearch();
        });
    }

    if (tgCloseBtn) tgCloseBtn.addEventListener('click', closeSearch);

    if (tgSearchInput) {
        tgSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            currentSearchIndex = 0;
            renderNotes(query, query ? 0 : -1);
            if (query && searchResults.length > 0) jumpToSearchIndex();
        });
    }

    function jumpToSearchIndex() {
        if (searchResults.length === 0) return;
        renderNotes(tgSearchInput.value.trim(), currentSearchIndex);
        const targetCard = document.querySelector(`[data-search-id="${currentSearchIndex}"]`);
        const scrollContainer = document.querySelector('.scrollable-content');
        
        if (targetCard && scrollContainer) {
            const cardTop = targetCard.offsetTop;
            scrollContainer.scrollTo({ top: cardTop - 140, behavior: 'smooth' });
        }
    }

    if (tgPrevBtn) {
        tgPrevBtn.addEventListener('click', () => {
            if (searchResults.length === 0) return;
            currentSearchIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
            jumpToSearchIndex();
        });
    }

    if (tgNextBtn) {
        tgNextBtn.addEventListener('click', () => {
            if (searchResults.length === 0) return;
            currentSearchIndex = (currentSearchIndex + 1 + searchResults.length) % searchResults.length;
            jumpToSearchIndex();
        });
    }

    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', () => {
            if (settingsModal) settingsModal.classList.remove('active');
        });
    }

    renderNotes();
});

// ЛАЙТБОКС
let currentLightboxImages = [];
let currentLightboxIndex = 0;

function openLightbox(images, index = 0) {
    currentLightboxImages = Array.isArray(images) ? images : [images];
    currentLightboxIndex = index;

    const modal = document.getElementById('lightboxModal');
    const img = document.getElementById('lightboxImg');

    if (modal && img) {
        img.src = currentLightboxImages[currentLightboxIndex];
        modal.style.display = 'flex';
    }
}

function closeLightbox() {
    const modal = document.getElementById('lightboxModal');
    if (modal) modal.style.display = 'none';
}

function changeLightboxImage(direction) {
    if (currentLightboxImages.length <= 1) return;
    currentLightboxIndex = (currentLightboxIndex + direction + currentLightboxImages.length) % currentLightboxImages.length;
    const img = document.getElementById('lightboxImg');
    if (img) img.src = currentLightboxImages[currentLightboxIndex];
}

document.addEventListener('DOMContentLoaded', () => {
    const lightboxModal = document.getElementById('lightboxModal');
    const closeBtn = document.getElementById('lightboxCloseBtn');
    const prevBtn = document.getElementById('lightboxPrevBtn');
    const nextBtn = document.getElementById('lightboxNextBtn');

    if (lightboxModal) {
        lightboxModal.addEventListener('click', (e) => {
            if (e.target === lightboxModal) closeLightbox();
        });
    }

    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    if (prevBtn) prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        changeLightboxImage(-1);
    });
    if (nextBtn) nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        changeLightboxImage(1);
    });
});
