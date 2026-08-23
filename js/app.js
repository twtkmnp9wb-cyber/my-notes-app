// ==========================================================
// МОДУЛЬ ПОЛНОЧНОЙ АВТО-ЧИСТКИ И ПРАВИЛА 3 ВЫЛЕТОВ
// ==========================================================

const TASKS_STORAGE_KEY = 'app_notes_and_tasks';
const RESET_DATE_KEY = 'last_midnight_reset_date';

/**
 * Основная функция проверки наступления полночи
 */
function runMidnightMaintenance() {
    const lastResetDate = localStorage.getItem(RESET_DATE_KEY);
    const currentDate = new Date().toDateString(); // Сравниваем по дате (без учета часов)

    // Если дата сменилась (наступил новый день)
    if (lastResetDate !== currentDate) {
        console.log("🌙 Наступили новые сутки! Запуск ночной ревизии...");
        
        processTaskStrikes();
        
        // Фиксируем текущую дату как последнюю пройденную проверку
        localStorage.setItem(RESET_DATE_KEY, currentDate);
    }
}

/**
 * Обработка задач: добавление "вылетов" и сжигание старых
 */
function processTaskStrikes() {
    const rawData = localStorage.getItem(TASKS_STORAGE_KEY);
    if (!rawData) return;

    let items = JSON.parse(rawData);
    let burnedCount = 0;

    // Фильтруем массив записей
    const updatedItems = items.filter(item => {
        // Обычные заметки не трогаем — они вечны
        if (item.type !== 'task') return true;

        // Если задача уже выполнена, она остается в ленте/памяти
        if (item.completed) return true;

        // Для невыполненных задач инкрементируем счетчик вылетов
        item.strikes = (item.strikes || 0) + 1;

        // Если набралось 3 вылета — задача сгорает (удаляется)
        if (item.strikes >= 3) {
            burnedCount++;
            console.warn(`🔥 Задача сгорела по правилу 3 вылетов: "${item.title || item.text}"`);
            return false; // Удаляем из массива
        }

        return true; // Оставляем задачу жить дальше
    });

    // Сохраняем обновленный список в localStorage
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(updatedItems));

    if (burnedCount > 0) {
        console.log(`🧹 Чистка завершена. Сгорело задач: ${burnedCount}`);
    }

    // Если в твоем приложении есть функция перерисовки списка — вызываем её
    if (typeof renderNotes === 'function') {
        renderNotes();
    } else if (typeof renderApp === 'function') {
        renderApp();
    }
}

/**
 * Вспомогательная функция для добавления задачи (используй её при создании!)
 */
function createNewTaskObject(title, text = '', hashtag = '') {
    return {
        id: Date.now(),
        type: 'task',           // Важно: тип именно 'task'
        title: title,
        text: text,
        hashtag: hashtag,
        completed: false,
        strikes: 0,            // Изначально 0 вылетов из 3
        createdAt: new Date().toISOString()
    };
}

// ----------------------------------------------------------
// АВТОЗАПУСК ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
// ----------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    runMidnightMaintenance();
});


// ==========================================================
// ИНСТРУМЕНТЫ ТЕСТИРОВАНИЯ (Вызывай в консоли браузера)
// ==========================================================

// Тест: Симуляция наступления следующего дня (добавляет 1 вылет)
window.testSimulateNextDay = function() {
    localStorage.setItem(RESET_DATE_KEY, 'Simulated_Past_Date');
    runMidnightMaintenance();
    console.log("⚡ Симуляция нового дня выполнена!");
};

// Тест: Принудительно сжечь все задачи с 3 вылетами прямо сейчас
window.testForceBurn = function() {
    processTaskStrikes();
};
