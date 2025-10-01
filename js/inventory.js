/**
 * JavaScript для плагина Inventory
 */

document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.getElementById('inventory-search-form');
    const searchInput = document.getElementById('inventory-search-input');
    const searchBtn = document.getElementById('inventory-search-btn');
    const resultsContainer = document.getElementById('inventory-results');
    
    if (!searchForm || !searchInput || !searchBtn || !resultsContainer) {
        return;
    }
    
    // Буфер для накопления позиций
    let itemsBuffer = [];


// ============================================
// СИСТЕМА УПРАВЛЕНИЯ СТОЛБЦАМИ
// ============================================

// Глобальная конфигурация столбцов
let columnsConfig = {
    'search_term': { name: 'Поиск', visible: true, order: 0, key: 'search_term' },
    'type': { name: 'Тип', visible: true, order: 1, key: 'type' },
    'name': { name: 'Наименование', visible: true, order: 2, key: 'name' },
    'otherserial': { name: 'Инв. номер', visible: true, order: 3, key: 'otherserial' },
    'serial': { name: 'Серийный номер', visible: true, order: 4, key: 'serial' },
    'group_name': { name: 'Департамент', visible: true, order: 5, key: 'group_name' },
    'state_name': { name: 'Статус', visible: true, order: 6, key: 'state_name' },
    'contact': { name: 'Стеллаж', visible: true, order: 7, key: 'contact' },
    'location_name': { name: 'Местоположение', visible: true, order: 8, key: 'location_name' },
    'user_name': { name: 'Пользователь', visible: true, order: 9, key: 'user_name' },
    'comment': { name: 'Комментарий', visible: false, order: 10, key: 'comment' },
    'actions': { name: 'Действия', visible: true, order: 11, key: 'actions' }
};

// Загрузить настройки столбцов из localStorage
function loadColumnsConfig() {
    const saved = localStorage.getItem('inventory_columns_config');
    if (saved) {
        try {
            const savedConfig = JSON.parse(saved);
            // Обновляем только существующие столбцы
            Object.keys(savedConfig).forEach(key => {
                if (columnsConfig[key]) {
                    columnsConfig[key] = savedConfig[key];
                }
            });
        } catch (e) {
            console.error('Ошибка загрузки настроек столбцов:', e);
        }
    }
}

// Сохранить настройки столбцов в localStorage
function saveColumnsConfig() {
    localStorage.setItem('inventory_columns_config', JSON.stringify(columnsConfig));
}

// Получить отсортированный список видимых столбцов
function getVisibleColumns() {
    return Object.entries(columnsConfig)
        .filter(([key, config]) => config.visible)
        .sort((a, b) => a[1].order - b[1].order)
        .map(([key, config]) => ({ key, ...config }));
}

// Получить отсортированный список всех столбцов
function getAllColumns() {
    return Object.entries(columnsConfig)
        .sort((a, b) => a[1].order - b[1].order)
        .map(([key, config]) => ({ key, ...config }));
}

// Получить значение ячейки по ключу столбца
function getCellValue(item, columnKey) {
    switch(columnKey) {
        case 'search_term':
            return escapeHtml(item.search_term);
        case 'type':
            if (item.isNotFound) {
                return '<span class="inventory-type-badge inventory-type-not-found">Не найдено</span>';
            }
            return `<span class="inventory-type-badge inventory-type-${item.type_class}">
                ${escapeHtml(item.type)}${item.isDuplicate ? ' <small>(Дубликат)</small>' : ''}
            </span>`;
        case 'name':
            return escapeHtml(truncateText(item.name || '-', 30));
        case 'otherserial':
            return escapeHtml(item.otherserial || '-');
        case 'serial':
            return escapeHtml(item.serial || '-');
        case 'group_name':
            return escapeHtml(item.group_name || '-');
        case 'state_name':
            return escapeHtml(item.state_name || '-');
        case 'contact':
            return escapeHtml(item.contact || '-');
        case 'location_name':
            return escapeHtml(truncateText(item.location_name || '-', 20));
        case 'user_name':
            return escapeHtml(truncateText(item.user_name || '-', 20));
        case 'comment':
            return escapeHtml(truncateText(item.comment || '-', 30));
        case 'actions':
            if (item.isNotFound) {
                return `<button class="inventory-delete-btn" onclick="removeFromBuffer(${item.index})">
                    <i class="fas fa-trash"></i> Удалить
                </button>`;
            }
            return `<a href="${item.url}" target="_blank" class="inventory-open-link">
                <i class="fas fa-external-link-alt"></i>
            </a>
            <button class="inventory-delete-btn" onclick="removeFromBuffer(${item.index})">
                <i class="fas fa-trash"></i>
            </button>`;
        default:
            return '-';
    }
}

// Загружаем настройки при загрузке страницы
loadColumnsConfig();


    let searchHistory = [];
    
    // Обработчик отправки формы
    searchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        performSearch();
    });
    
    // Поиск по Enter
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            performSearch();
        }
    });
    
    // Функция поиска
    function performSearch() {
        let searchTerm = searchInput.value.trim();
        
        if (!searchTerm) {
            showNotification('Введите инвентарный номер для поиска', 'error');
            return;
        }
        
        // Убираем ведущие нули, но сохраняем хотя бы одну цифру
        const originalTerm = searchTerm;
        searchTerm = searchTerm.replace(/^0+/, '') || '0';
        
        // Проверяем, не остался ли только "0" после удаления ведущих нулей
        if (searchTerm === '0') {
            showNotification('Некорректный номер', 'error');
            return;
        }
        
        // Если убрали ведущие нули, показываем уведомление
        if (originalTerm !== searchTerm && originalTerm.startsWith('0')) {
            showNotification(`Поиск по номеру: ${searchTerm} (убраны ведущие нули)`, 'info');
        }
        
        // Показываем индикатор загрузки
        showLoading();
        
        // Отключаем кнопку поиска
        searchBtn.disabled = true;
        
        // Выполняем AJAX запрос
        const formData = new FormData();
        formData.append('search_serial', searchTerm);
        
        // Готовим заголовки с CSRF токеном
        const headers = {};
        if (typeof GLPI_CSRF_TOKEN !== 'undefined') {
            headers['X-Glpi-Csrf-Token'] = GLPI_CSRF_TOKEN;
        } else {
            console.error('CSRF токен не найден!');
        }
        
        // Определяем URL для AJAX
        const ajaxUrl = '/plugins/inventory/ajax/search.php';
        
        fetch(ajaxUrl, {
            method: 'POST',
            headers: headers,
            body: formData,
            credentials: 'same-origin'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                showNotification(data.error, 'error');
            } else if (data.success) {
                addToBuffer(data, searchTerm);
            } else {
                showNotification('Неизвестная ошибка при поиске', 'error');
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            // Показываем уведомление об ошибке соединения
            showNotification('Ошибка соединения с сервером', 'error');
        })
        .finally(() => {
            // Включаем кнопку поиска
            searchBtn.disabled = false;
            // Очищаем поле ввода после поиска
            searchInput.value = '';
        });
    }
    
    // Добавление результатов в буфер
    function addToBuffer(data, searchTerm) {
        // Записываем поиск в историю
        searchHistory.unshift({
            term: searchTerm,
            timestamp: new Date(),
            found: data.items.length > 0
        });
        
        if (data.items.length === 0) {
            // Не найдено
            addNotFoundToBuffer(searchTerm);
            renderBuffer();
        } else if (data.items.length === 1) {
            // Найден один элемент - добавляем сразу
            addItemToBuffer(data.items[0], searchTerm);
            renderBuffer();
        } else {
            // Найдено несколько элементов - показываем окно выбора
            showSelectionModal(data.items, searchTerm);
        }
    }
    
    // Добавление "не найдено" в буфер
    function addNotFoundToBuffer(searchTerm) {
        const notFoundItem = {
            id: 'not-found-' + Date.now(),
            search_term: searchTerm,
            type: 'Не найдено',
            name: `Позиция "${searchTerm}" не найдена`,
            otherserial: searchTerm,
            serial: '-',
            group_name: '-',
            state_name: '-',
            location_name: '-',
            user_name: '-',
            url: '#',
            isNotFound: true,
            timestamp: new Date()
        };
        
        itemsBuffer.unshift(notFoundItem);
        renderBuffer();
    }
    
    // Добавление элемента в буфер
    function addItemToBuffer(item, searchTerm) {
        // Проверяем на дублирование
        const existingIndex = itemsBuffer.findIndex(bufferItem => 
            !bufferItem.isNotFound && 
            bufferItem.id === item.id && 
            bufferItem.type_class === item.type_class
        );
        
        const bufferItem = {
            ...item,
            search_term: searchTerm,
            timestamp: new Date(),
            isDuplicate: existingIndex !== -1
        };
        
        // Добавляем в начало буфера (новые сверху)
        itemsBuffer.unshift(bufferItem);
    }
    
    // Показать модальное окно выбора из множественных результатов
    function showSelectionModal(items, searchTerm) {
        const modalHtml = `
            <div class="inventory-modal-overlay selection-modal-overlay" onclick="closeSelectionModal()">
                <div class="inventory-modal selection-modal" onclick="event.stopPropagation()">
                    <div class="inventory-modal-header">
                        <h3>Найдено несколько позиций для "${searchTerm}" (${items.length})</h3>
                        <button class="inventory-modal-close" onclick="closeSelectionModal()">&times;</button>
                    </div>
                    <div class="inventory-modal-body">
                        <p>Выберите нужную позицию для добавления в буфер:</p>
                        <div class="selection-items-list">
                            ${items.map((item, index) => `
                                <div class="selection-item" onclick="selectItem(${index})">
                                    <div class="selection-item-content">
                                        <span class="inventory-type-badge inventory-type-${item.type_class}">
                                            ${escapeHtml(item.type)}
                                        </span>
                                        <div class="selection-item-info">
                                            <strong class="item-name">${escapeHtml(item.name)}</strong>
                                            <span class="item-department">${escapeHtml(item.group_name || 'Не указан')}</span>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="inventory-modal-footer">
                        <button class="inventory-action-btn inventory-btn-secondary" onclick="closeSelectionModal()">
                            Отмена
                        </button>
                        <button class="inventory-action-btn inventory-btn-success" onclick="addAllItems()">
                            <i class="fas fa-plus-circle"></i> Добавить все
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Сохраняем данные для использования в функциях выбора
        window.selectionModalData = {
            items: items,
            searchTerm: searchTerm
        };
    }
    
    // Закрыть модальное окно выбора
    window.closeSelectionModal = function() {
        const modal = document.querySelector('.selection-modal-overlay');
        if (modal) {
            modal.remove();
        }
        window.selectionModalData = null;
    }
    
    // Выбрать конкретный элемент
    window.selectItem = function(index) {
        if (window.selectionModalData) {
            const item = window.selectionModalData.items[index];
            const searchTerm = window.selectionModalData.searchTerm;
            
            addItemToBuffer(item, searchTerm);
            renderBuffer();
            closeSelectionModal();
            
            showNotification(`Добавлена позиция: ${item.name}`, 'success');
        }
    }
    
    // Добавить все элементы
    window.addAllItems = function() {
        if (window.selectionModalData) {
            const items = window.selectionModalData.items;
            const searchTerm = window.selectionModalData.searchTerm;
            
            items.forEach(item => {
                addItemToBuffer(item, searchTerm);
            });
            
            renderBuffer();
            closeSelectionModal();
            
            showNotification(`Добавлено ${items.length} позиций в буфер`, 'success');
        }
    }
    
    // Показать индикатор загрузки
    function showLoading() {
        resultsContainer.innerHTML = `
            <div class="inventory-loading">
                <div class="inventory-spinner"></div>
                Поиск оборудования...
            </div>
        `;
    }
    
    
    // Рендеринг буфера
    function renderBuffer() {
        if (itemsBuffer.length === 0) {
            resultsContainer.innerHTML = `
                <div class="inventory-no-buffer">
                    <p>Буфер пуст. Введите инвентарный номер для поиска.</p>
                </div>
            `;
            return;
        }
        
        // Подсчитываем актуальные позиции
        const actualCount = itemsBuffer.filter(item => !item.isNotFound).length;
        const uniqueActual = new Set();
        itemsBuffer.forEach(item => {
            if (!item.isNotFound && !item.isDuplicate) {
                uniqueActual.add(`${item.type_class}-${item.id}`);
            }
        });
        const uniqueActualCount = uniqueActual.size;
        
        // Получаем видимые столбцы
        const visibleColumns = getVisibleColumns();
        
        // Генерируем заголовки таблицы
        let headersHtml = '';
        visibleColumns.forEach(col => {
            headersHtml += `<th>${col.name}</th>`;
        });
        
        let html = `
            <div class="inventory-buffer-container">
                <div class="inventory-buffer-header">
                    <h3>В буфере: <span class="buffer-count">${itemsBuffer.length}</span>; Актуальных: <span class="actual-count">${uniqueActualCount}</span></h3>
                    <div class="inventory-buffer-actions">
                        <button class="inventory-action-btn inventory-btn-primary" onclick="keepActualItems()">
                            <i class="fas fa-filter"></i> Оставить актуальные
                        </button>
                        <button class="inventory-action-btn inventory-btn-warning" onclick="showBulkEditModal()">
                            <i class="fas fa-edit"></i> Изменить
                        </button>
                        <button class="inventory-action-btn inventory-btn-info" onclick="showColumnsModal()">
                            <i class="fas fa-columns"></i> Столбцы
                        </button>
                        <button class="inventory-action-btn inventory-btn-danger" onclick="clearBuffer()">
                            <i class="fas fa-trash"></i> Очистить буфер
                        </button>
                    </div>
                </div>
                <table class="inventory-results-table">
                    <thead>
                        <tr>
                            ${headersHtml}
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Генерируем строки таблицы
        itemsBuffer.forEach((item, index) => {
            const rowClass = item.isNotFound ? 'inventory-not-found-row' : 
                           item.isDuplicate ? 'inventory-duplicate-row' : '';
            
            item.index = index; // Добавляем индекс для функции удаления
            
            let rowHtml = '';
            visibleColumns.forEach(col => {
                const cellValue = getCellValue(item, col.key);
                const titleAttr = ['name', 'location_name', 'user_name', 'contact', 'comment'].includes(col.key) 
                    ? `title="${escapeHtml(item[col.key] || '-')}"` : '';
                rowHtml += `<td ${titleAttr}>${cellValue}</td>`;
            });
            
            html += `<tr class="${rowClass}">${rowHtml}</tr>`;
        });
        
        html += `
                </tbody>
            </table>
            </div>
        `;
        
        resultsContainer.innerHTML = html;
    }

    
    // Экранирование HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Обрезка текста
    function truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }
    
    // Глобальная функция очистки буфера (вызывается из HTML)
    window.clearBuffer = function() {
        itemsBuffer = [];
        searchHistory = [];
        renderBuffer();
    }
    
    // Функция удаления элемента из буфера
    window.removeFromBuffer = function(index) {
        if (index >= 0 && index < itemsBuffer.length) {
            itemsBuffer.splice(index, 1);
            renderBuffer();
        }
    }
    
    // Оставить только актуальные (убрать не найденные и дубликаты)
    window.keepActualItems = function() {
        const actualItems = [];
        const seenItems = new Set();
        
        itemsBuffer.forEach(item => {
            if (!item.isNotFound && !item.isDuplicate) {
                const itemKey = `${item.type_class}-${item.id}`;
                if (!seenItems.has(itemKey)) {
                    seenItems.add(itemKey);
                    actualItems.push(item);
                }
            }
        });
        
        if (actualItems.length !== itemsBuffer.length) {
            const removedCount = itemsBuffer.length - actualItems.length;
            itemsBuffer = actualItems;
            renderBuffer();
            showNotification(`Удалено ${removedCount} позиций (не найденные и дубликаты)`, 'success');
        } else {
            showNotification('В буфере только актуальные позиции', 'info');
        }
    }
    
    // Показать модальное окно массового редактирования
    window.showBulkEditModal = function() {
        const actualItems = itemsBuffer.filter(item => !item.isNotFound);
        if (actualItems.length === 0) {
            showNotification('В буфере нет позиций для редактирования', 'warning');
            return;
        }
        
        // Создаем модальное окно
        const modalHtml = `
            <div class="inventory-modal-overlay" onclick="closeBulkEditModal()">
                <div class="inventory-modal bulk-edit-modal" onclick="event.stopPropagation()">
                    <div class="inventory-modal-header">
                        <h3>Массовое изменение (${actualItems.length} позиций)</h3>
                        <button class="inventory-modal-close" onclick="closeBulkEditModal()">&times;</button>
                    </div>
                    <div class="inventory-modal-body">
                        <div id="bulk-edit-rules">
                            <!-- Правила изменения будут добавляться сюда -->
                        </div>
                        <button class="inventory-add-rule-btn" onclick="addBulkEditRule()">
                            <i class="fas fa-plus"></i> Добавить правило
                        </button>
                    </div>
                    <div class="inventory-modal-footer">
                        <button class="inventory-action-btn inventory-btn-secondary" onclick="closeBulkEditModal()">
                            Отмена
                        </button>
                        <button class="inventory-action-btn inventory-btn-primary" onclick="applyBulkEdit()">
                            Применить изменения
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Добавляем первое правило по умолчанию
        addBulkEditRule();
    }
    
    // Закрыть модальное окно редактирования
    window.closeBulkEditModal = function() {
        const modal = document.querySelector('.inventory-modal-overlay');
        if (modal) {
            modal.remove();
        }
    }
    
    // Добавить правило изменения
    window.addBulkEditRule = function() {
        const rulesContainer = document.getElementById('bulk-edit-rules');
        const ruleIndex = rulesContainer.children.length;
        
        const ruleHtml = `
            <div class="bulk-edit-rule" data-rule-index="${ruleIndex}">
                <div class="rule-header">
                    <select class="rule-field-select" onchange="updateRuleValues(${ruleIndex})">
                        <option value="">Выберите поле для изменения</option>
                        <option value="group_name">Департамент</option>
                        <option value="state_name">Статус</option>
                        <option value="contact">Стеллаж</option>
                        <option value="location_name">Местоположение</option>
                        <option value="user_name">Пользователь</option>
                    </select>
                    ${ruleIndex > 0 ? `<button class="rule-remove-btn" onclick="removeRule(${ruleIndex})" title="Удалить правило">
                        <i class="fas fa-times"></i>
                    </button>` : ''}
                </div>
                <div class="rule-value-container" id="rule-value-${ruleIndex}">
                    <!-- Значения будут добавлены при выборе поля -->
                </div>
            </div>
        `;
        
        rulesContainer.insertAdjacentHTML('beforeend', ruleHtml);
    }
    
    // Обновить варианты значений для правила
    window.updateRuleValues = function(ruleIndex) {
        const fieldSelect = document.querySelector(`.bulk-edit-rule[data-rule-index="${ruleIndex}"] .rule-field-select`);
        const valueContainer = document.getElementById(`rule-value-${ruleIndex}`);
        const fieldType = fieldSelect.value;
        
        if (!fieldType) {
            valueContainer.innerHTML = '';
            return;
        }
        
        // Для стеллажа - просто текстовое поле
        if (fieldType === 'contact') {
            valueContainer.innerHTML = `
                <input type="text" class="rule-value-input" placeholder="Введите номер стеллажа">
            `;
            return;
        }
        
        // Определяем тип данных для загрузки
        let dataType = '';
        switch(fieldType) {
            case 'group_name':
                dataType = 'groups';
                break;
            case 'state_name':
                dataType = 'states';
                break;
            case 'location_name':
                dataType = 'locations';
                break;
            case 'user_name':
                dataType = 'users';
                break;
        }
        
        if (!dataType) {
            valueContainer.innerHTML = '';
            return;
        }
        
        // Показываем загрузку
        valueContainer.innerHTML = '<select class="rule-value-select"><option>Загрузка...</option></select>';
        
        // Загружаем данные через AJAX
        const headers = {};
        if (typeof GLPI_CSRF_TOKEN !== 'undefined') {
            headers['X-Glpi-Csrf-Token'] = GLPI_CSRF_TOKEN;
        }
        
        fetch(`/plugins/inventory/ajax/get_values.php?type=${dataType}`, {
            method: 'GET',
            headers: headers,
            credentials: 'same-origin'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.data) {
                let options = '<option value="">Выберите значение</option>';
                data.data.forEach(item => {
                    options += `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`;
                });
                valueContainer.innerHTML = `<select class="rule-value-select">${options}</select>`;
            } else {
                valueContainer.innerHTML = '<select class="rule-value-select"><option>Ошибка загрузки</option></select>';
            }
        })
        .catch(error => {
            console.error('Ошибка загрузки значений:', error);
            valueContainer.innerHTML = '<select class="rule-value-select"><option>Ошибка загрузки</option></select>';
        });
    }

    
    // Удалить правило
    window.removeRule = function(ruleIndex) {
        const rule = document.querySelector(`.bulk-edit-rule[data-rule-index="${ruleIndex}"]`);
        if (rule) {
            rule.remove();
        }
    }
    
    // Применить массовые изменения
    window.applyBulkEdit = function() {
        const rules = document.querySelectorAll('.bulk-edit-rule');
        const changes = [];
        
        rules.forEach(rule => {
            const fieldSelect = rule.querySelector('.rule-field-select');
            const valueElement = rule.querySelector('.rule-value-select, .rule-value-input');
            
            if (fieldSelect.value && valueElement && valueElement.value) {
                changes.push({
                    field: fieldSelect.value,
                    value: valueElement.value
                });
            }
        });
        
        if (changes.length === 0) {
            showNotification('Не выбраны поля для изменения', 'warning');
            return;
        }
        
        const actualItems = itemsBuffer.filter(item => !item.isNotFound);
        
        if (actualItems.length === 0) {
            showNotification('Нет позиций для изменения', 'warning');
            return;
        }
        
        showNotification('Применяю изменения...', 'info');
        
        const requestData = {
            items: actualItems,
            changes: changes
        };
        
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (typeof GLPI_CSRF_TOKEN !== 'undefined') {
            headers['X-Glpi-Csrf-Token'] = GLPI_CSRF_TOKEN;
        }
        
        fetch('/plugins/inventory/ajax/update.php', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestData),
            credentials: 'same-origin'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.results) {
                const res = data.results;
                
                itemsBuffer.forEach(item => {
                    if (!item.isNotFound && !item.isDuplicate) {
                        changes.forEach(change => {
                            item[change.field] = change.value;
                        });
                    }
                });
                
                closeBulkEditModal();
                renderBuffer();
                
                let message = `Успешно обновлено: ${res.success} позиций`;
                if (res.failed > 0) {
                    message += `. Ошибок: ${res.failed}`;
                }
                
                showNotification(message, res.failed > 0 ? 'warning' : 'success');
                
                if (res.errors && res.errors.length > 0) {
                    console.error('Ошибки обновления:', res.errors);
                }
            } else {
                showNotification('Ошибка при обновлении: ' + (data.error || 'Неизвестная ошибка'), 'error');
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            showNotification('Ошибка соединения с сервером: ' + error.message, 'error');
        });
    }
    
    // Показать модальное окно настройки столбцов
    // Показать модальное окно настройки столбцов
    window.showColumnsModal = function() {
        const sortedColumns = getAllColumns();
        
        let columnsHtml = '';
        sortedColumns.forEach((col, index) => {
            columnsHtml += `
                <div class="column-item" draggable="true" data-column-key="${col.key}" data-index="${index}">
                    <div class="column-drag-handle">
                        <i class="fas fa-grip-vertical"></i>
                    </div>
                    <label class="column-label">
                        <input type="checkbox" class="column-checkbox" data-column-key="${col.key}" ${col.visible ? 'checked' : ''}>
                        <span>${col.name}</span>
                    </label>
                </div>
            `;
        });
        
        const modalHtml = `
            <div class="inventory-modal-overlay" onclick="closeColumnsModal()">
                <div class="inventory-modal columns-modal" onclick="event.stopPropagation()">
                    <div class="inventory-modal-header">
                        <h3><i class="fas fa-columns"></i> Настройка столбцов</h3>
                        <button class="inventory-modal-close" onclick="closeColumnsModal()">&times;</button>
                    </div>
                    <div class="inventory-modal-body">
                        <p><i class="fas fa-info-circle"></i> Перетащите столбцы для изменения порядка, используйте чекбоксы для включения/выключения</p>
                        <div class="columns-list" id="columns-list">
                            ${columnsHtml}
                        </div>
                    </div>
                    <div class="inventory-modal-footer">
                        <button class="inventory-action-btn inventory-btn-secondary" onclick="resetColumnsSettings()">
                            <i class="fas fa-undo"></i> Сбросить
                        </button>
                        <button class="inventory-action-btn inventory-btn-secondary" onclick="closeColumnsModal()">
                            Отмена
                        </button>
                        <button class="inventory-action-btn inventory-btn-primary" onclick="applyColumnsSettings()">
                            <i class="fas fa-check"></i> Применить
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        initColumnsDragAndDrop();
    }
    
    // Инициализация drag-and-drop
    function initColumnsDragAndDrop() {
        const columnsList = document.getElementById('columns-list');
        if (!columnsList) return;
        
        const columnItems = columnsList.querySelectorAll('.column-item');
        let draggedItem = null;
        
        columnItems.forEach(item => {
            item.addEventListener('dragstart', function(e) {
                draggedItem = this;
                this.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            
            item.addEventListener('dragend', function() {
                this.classList.remove('dragging');
                draggedItem = null;
            });
            
            item.addEventListener('dragover', function(e) {
                e.preventDefault();
                if (draggedItem && draggedItem !== this) {
                    const afterElement = getDragAfterElement(columnsList, e.clientY);
                    if (afterElement == null) {
                        columnsList.appendChild(draggedItem);
                    } else {
                        columnsList.insertBefore(draggedItem, afterElement);
                    }
                }
            });
        });
    }
    
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.column-item:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
    
    // Применить настройки столбцов
    window.applyColumnsSettings = function() {
        const columnsList = document.getElementById('columns-list');
        if (!columnsList) return;
        
        const columnItems = columnsList.querySelectorAll('.column-item');
        
        // Обновляем порядок и видимость
        columnItems.forEach((item, index) => {
            const key = item.dataset.columnKey;
            const checkbox = item.querySelector('.column-checkbox');
            if (columnsConfig[key]) {
                columnsConfig[key].order = index;
                columnsConfig[key].visible = checkbox.checked;
            }
        });
        
        saveColumnsConfig();
        closeColumnsModal();
        renderBuffer();
        showNotification('Настройки столбцов применены', 'success');
    }
    
    // Сбросить настройки столбцов
    window.resetColumnsSettings = function() {
        if (confirm('Вы уверены, что хотите сбросить настройки столбцов?')) {
            localStorage.removeItem('inventory_columns_config');
            columnsConfig = {
                'search_term': { name: 'Поиск', visible: true, order: 0, key: 'search_term' },
                'type': { name: 'Тип', visible: true, order: 1, key: 'type' },
                'name': { name: 'Наименование', visible: true, order: 2, key: 'name' },
                'otherserial': { name: 'Инв. номер', visible: true, order: 3, key: 'otherserial' },
                'serial': { name: 'Серийный номер', visible: true, order: 4, key: 'serial' },
                'group_name': { name: 'Департамент', visible: true, order: 5, key: 'group_name' },
                'state_name': { name: 'Статус', visible: true, order: 6, key: 'state_name' },
                'contact': { name: 'Стеллаж', visible: true, order: 7, key: 'contact' },
                'location_name': { name: 'Местоположение', visible: true, order: 8, key: 'location_name' },
                'user_name': { name: 'Пользователь', visible: true, order: 9, key: 'user_name' },
                'comment': { name: 'Комментарий', visible: false, order: 10, key: 'comment' },
                'actions': { name: 'Действия', visible: true, order: 11, key: 'actions' }
            };
            closeColumnsModal();
            renderBuffer();
            showNotification('Настройки столбцов сброшены', 'info');
        }
    }
    
    // Закрыть модальное окно настройки столбцов
    window.closeColumnsModal = function() {
        const modal = document.querySelector('.inventory-modal-overlay');
        if (modal) {
            modal.remove();
        }
    }

        // Показать уведомление
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `inventory-notification inventory-notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;
        
        document.body.appendChild(notification);
        
        // Автоматически скрываем через 5 секунд
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
    
    // Загружаем настройки столбцов
    loadColumnsConfig();

    // Инициализация: показываем пустой буфер
    renderBuffer();
    
    // Фокус на поле ввода при загрузке страницы
    searchInput.focus();
});
