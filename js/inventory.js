/**
 * JavaScript для плагина Inventory
 */

// Глобальные переменные
let itemsBuffer = [];

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

document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.getElementById('inventory-search-form');
    const searchInput = document.getElementById('inventory-search-input');
    const searchBtn = document.getElementById('inventory-search-btn');
    const resultsContainer = document.getElementById('inventory-results');
    
    if (!searchForm || !searchInput || !searchBtn || !resultsContainer) {
        return;
    }

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
window.getVisibleColumns = function() {
    return Object.entries(columnsConfig)
        .filter(([key, config]) => config.visible)
        .sort((a, b) => a[1].order - b[1].order)
        .map(([key, config]) => ({ key, ...config }));
}

// Получить отсортированный список всех столбцов
window.getAllColumns = function() {
    return Object.entries(columnsConfig)
        .sort((a, b) => a[1].order - b[1].order)
        .map(([key, config]) => ({ key, ...config }));
}

// Получить значение ячейки по ключу столбца
window.getCellValue = function(item, columnKey) {
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
                        <!-- removed old Export button -->
                        <!-- removed old Import button -->
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
        
        // Обновляем состояние кнопок экспорта
        updateExportButtonsState();
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
                    options += `<option value="${item.id}">${escapeHtml(item.name)}</option>`;
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
                let change = { field: fieldSelect.value };
                if (valueElement.classList.contains('rule-value-select')) {
                    const selectedOption = valueElement.options[valueElement.selectedIndex];
                    change.value = selectedOption ? selectedOption.textContent : '';
                    const idVal = selectedOption ? selectedOption.value : '';
                    if (idVal && !isNaN(parseInt(idVal, 10))) {
                        change.id = parseInt(idVal, 10);
                    }
                } else {
                    change.value = valueElement.value;
                }
                changes.push(change);
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

// ============================================
// ГЛАВНОЕ МОДАЛЬНОЕ ОКНО ИМПОРТА/ЭКСПОРТА
// ============================================

// Показать главное модальное окно импорта/экспорта
window.showImportExportModal = function() {
    const hasData = itemsBuffer.length > 0;
    
    const modal = document.createElement('div');
    modal.className = 'inventory-modal-overlay';
    modal.innerHTML = `
        <div class="inventory-modal import-export-modal">
            <div class="inventory-modal-header">
                <h3>Импорт и экспорт данных</h3>
                <button class="inventory-modal-close" onclick="closeImportExportModal()">&times;</button>
            </div>
            <div class="inventory-modal-body">
                <div class="import-export-tabs">
                    <button class="import-export-tab active" onclick="switchImportExportTab('import')">
                        <i class="fas fa-download"></i> Импорт
                    </button>
                    <button class="import-export-tab" onclick="switchImportExportTab('export')">
                        <i class="fas fa-upload"></i> Экспорт
                    </button>
                </div>
                
                <!-- Вкладка импорта -->
                <div id="import-content" class="import-export-content active">
                    <div class="import-export-section">
                        <h4>Импорт инвентарных номеров</h4>
                        <div class="import-export-buttons">
                            <div class="import-export-action-btn" onclick="showImportModal(); closeImportExportModal();">
                                <i class="fas fa-file-upload"></i>
                                <div>Из файла</div>
                                <small>TXT, CSV, Excel</small>
                            </div>
                            <div class="import-export-action-btn" onclick="showClipboardImportModal(); closeImportExportModal();">
                                <i class="fas fa-clipboard"></i>
                                <div>Из буфера обмена</div>
                                <small>Вставить список номеров</small>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Вкладка экспорта -->
                <div id="export-content" class="import-export-content">
                    <div class="import-export-section">
                        <h4>Экспорт найденных позиций</h4>
                        <div class="import-export-buttons">
                            <div class="import-export-action-btn ${!hasData ? 'disabled' : ''}" onclick="${hasData ? 'exportToCSV(); closeImportExportModal();' : ''}">
                                <i class="fas fa-file-csv"></i>
                                <div>CSV файл</div>
                                <small>Для Excel и других программ</small>
                            </div>
                            <div class="import-export-action-btn ${!hasData ? 'disabled' : ''}" onclick="${hasData ? 'exportToExcel(); closeImportExportModal();' : ''}">
                                <i class="fas fa-file-excel"></i>
                                <div>Excel файл</div>
                                <small>Готовый для Excel</small>
                            </div>
                            <div class="import-export-action-btn ${!hasData ? 'disabled' : ''}" onclick="${hasData ? 'generateReport(); closeImportExportModal();' : ''}">
                                <i class="fas fa-print"></i>
                                <div>Отчет для печати</div>
                                <small>HTML с возможностью печати</small>
                            </div>
                        </div>
                        ${!hasData ? '<p style="text-align: center; color: #6c757d; margin-top: 15px;"><i class="fas fa-info-circle"></i> Сначала найдите позиции для экспорта</p>' : ''}
                    </div>
                </div>
            </div>
            <div class="inventory-modal-footer">
                <button class="inventory-action-btn inventory-btn-secondary" onclick="closeImportExportModal()">
                    Закрыть
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    window.currentImportExportModal = modal;
}

// Закрыть главное модальное окно


// Переключение вкладок


// ============================================
// СИСТЕМА ЭКСПОРТА ДАННЫХ
// ============================================

// Обновление состояния кнопок экспорта (больше не нужна, но оставим для совместимости)
function updateExportButtonsState() {
    // Функция больше не используется, так как кнопки теперь в модальном окне
    // Оставлена для совместимости с существующим кодом
}

// Экспорт в CSV
window.exportToCSV = function() {
    if (itemsBuffer.length === 0) {
        showNotification('Буфер пуст. Нечего экспортировать.', 'warning');
        return;
    }
    
    showExportModal('csv');
}

// Экспорт в Excel
window.exportToExcel = function() {
    if (itemsBuffer.length === 0) {
        showNotification('Буфер пуст. Нечего экспортировать.', 'warning');
        return;
    }
    
    showExportModal('excel');
}

// Генерация отчета для печати
function generateReport() {
    if (itemsBuffer.length === 0) {
        showNotification('Буфер пуст. Нечего экспортировать.', 'warning');
        return;
    }
    
    showExportModal('report');
}

// Показать модальное окно экспорта
window.showExportModal = function(type) {
    const typeNames = {
        'csv': 'CSV файл',
        'excel': 'Excel файл',
        'report': 'отчет для печати'
    };
    
    const visibleColumns = getVisibleColumns();
    
    const modal = document.createElement('div');
    modal.className = 'inventory-modal-overlay';
    modal.innerHTML = `
        <div class="inventory-modal export-modal">
            <div class="inventory-modal-header">
                <h3>Экспорт в ${typeNames[type]}</h3>
                <button class="inventory-modal-close" onclick="closeExportModal()">&times;</button>
            </div>
            <div class="inventory-modal-body">
                <div class="export-settings">
                    <h4>Выберите столбцы для экспорта:</h4>
                    <div class="export-columns-list">
                        ${visibleColumns.map(col => `
                            <div class="export-column-item">
                                <input type="checkbox" id="export-col-${col.key}" class="export-column-checkbox" checked>
                                <label for="export-col-${col.key}">${col.name}</label>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <label>
                            <input type="checkbox" id="export-include-notfound" checked>
                            Включать позиции "Не найдено"
                        </label>
                    </div>
                    
                    <div style="margin-top: 10px;">
                        <label>
                            <input type="checkbox" id="export-include-duplicates" checked>
                            Включать дубликаты
                        </label>
                    </div>
                </div>
            </div>
            <div class="inventory-modal-footer">
                <button class="inventory-action-btn inventory-btn-secondary" onclick="closeExportModal()">
                    Отмена
                </button>
                <button class="inventory-action-btn inventory-btn-primary" onclick="performExport('${type}')">
                    <i class="fas fa-download"></i> Экспортировать
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    window.currentExportModal = modal;
}

// Закрыть модальное окно экспорта
window.closeExportModal = function() {
    if (window.currentExportModal) {
        window.currentExportModal.remove();
        window.currentExportModal = null;
    }
}

// Выполнить экспорт
window.performExport = function(type) {
    const selectedColumns = [];
    const checkboxes = document.querySelectorAll('.export-column-checkbox:checked');
    checkboxes.forEach(cb => {
        const key = cb.id.replace('export-col-', '');
        const column = Object.values(columnsConfig).find(col => col.key === key);
        if (column) {
            selectedColumns.push(column);
        }
    });
    
    const includeNotFound = document.getElementById('export-include-notfound').checked;
    const includeDuplicates = document.getElementById('export-include-duplicates').checked;
    
    // Фильтруем данные
    let dataToExport = itemsBuffer.filter(item => {
        if (!includeNotFound && item.isNotFound) return false;
        if (!includeDuplicates && item.isDuplicate) return false;
        return true;
    });
    
    if (dataToExport.length === 0) {
        showNotification('Нет данных для экспорта с выбранными настройками', 'warning');
        return;
    }
    
    // Сортируем столбцы по порядку
    selectedColumns.sort((a, b) => a.order - b.order);
    
    switch (type) {
        case 'csv':
            exportToCSVFile(dataToExport, selectedColumns);
            break;
        case 'excel':
            exportToExcelFile(dataToExport, selectedColumns);
            break;
        case 'report':
            generatePrintReport(dataToExport, selectedColumns);
            break;
    }
    
    closeExportModal();
}

// Получить значение ячейки для экспорта (без HTML)
window.getCellValueForExport = function(item, columnKey) {
    switch(columnKey) {
        case 'search_term':
            return item.search_term || '';
        case 'type':
            if (item.isNotFound) {
                return 'Не найдено';
            }
            return (item.type || '') + (item.isDuplicate ? ' (Дубликат)' : '');
        case 'name':
            return item.name || '-';
        case 'otherserial':
            return item.otherserial || '-';
        case 'serial':
            return item.serial || '-';
        case 'group_name':
            return item.group_name || '-';
        case 'state_name':
            return item.state_name || '-';
        case 'contact':
            return item.contact || '-';
        case 'location_name':
            return item.location_name || '-';
        case 'user_name':
            return item.user_name || '-';
        case 'comment':
            return item.comment || '-';
        case 'actions':
            return ''; // Действия не экспортируем
        default:
            return item[columnKey] || '';
    }
}

// Экспорт в CSV файл
window.exportToCSVFile = function(data, columns) {
    const headers = columns.map(col => col.name);
    const csvContent = [
        headers.join(','),
        ...data.map(item => 
            columns.map(col => {
                let value = getCellValueForExport(item, col.key);
                // Экранируем кавычки и переносы строк
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    value = '"' + value.replace(/"/g, '""') + '"';
                }
                return value;
            }).join(',')
        )
    ].join('\n');
    
    downloadFile(csvContent, 'inventory_export.csv', 'text/csv;charset=utf-8;');
    showNotification(`Экспортировано ${data.length} позиций в CSV файл`, 'success');
}

// Экспорт в Excel файл (используем CSV с BOM для корректного отображения в Excel)
window.exportToExcelFile = function(data, columns) {
    const headers = columns.map(col => col.name);
    const csvContent = [
        headers.join('\t'),
        ...data.map(item => 
            columns.map(col => {
                let value = getCellValueForExport(item, col.key);
                // Для Excel используем табуляцию как разделитель
                return value.replace(/\t/g, ' ').replace(/\n/g, ' ');
            }).join('\t')
        )
    ].join('\n');
    
    // Добавляем BOM для корректного отображения кириллицы в Excel
    const bom = '\uFEFF';
    downloadFile(bom + csvContent, 'inventory_export.xls', 'application/vnd.ms-excel;charset=utf-8;');
    showNotification(`Экспортировано ${data.length} позиций в Excel файл`, 'success');
}

// Генерация отчета для печати
function generatePrintReport(data, columns) {
    const reportWindow = window.open('', '_blank');
    const currentDate = new Date().toLocaleDateString('ru-RU');
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Отчет по инвентаризации</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .header h1 { margin: 0; color: #333; }
                .header p { margin: 5px 0; color: #666; }
                .stats { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px; }
                .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
                .stat-item { text-align: center; }
                .stat-value { font-size: 24px; font-weight: bold; color: #0d6efd; }
                .stat-label { font-size: 14px; color: #666; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f8f9fa; font-weight: bold; }
                .not-found { background-color: #f8f9fa; color: #6c757d; }
                .duplicate { background-color: #fff3cd; }
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Отчет по инвентаризации</h1>
                <p>Дата формирования: ${currentDate}</p>
                <p>Всего позиций: ${data.length}</p>
            </div>
            
            <div class="stats">
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-value">${data.filter(item => !item.isNotFound).length}</div>
                        <div class="stat-label">Найдено</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${data.filter(item => item.isNotFound).length}</div>
                        <div class="stat-label">Не найдено</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${data.filter(item => item.isDuplicate).length}</div>
                        <div class="stat-label">Дубликаты</div>
                    </div>
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        ${columns.map(col => `<th>${col.name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${data.map(item => `
                        <tr class="${item.isNotFound ? 'not-found' : ''} ${item.isDuplicate ? 'duplicate' : ''}">
                            ${columns.map(col => `<td>${getCellValueForExport(item, col.key) || ''}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div class="no-print" style="margin-top: 30px; text-align: center;">
                <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; background: #0d6efd; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Печать
                </button>
                <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px;">
                    Закрыть
                </button>
            </div>
        </body>
        </html>
    `;
    
    reportWindow.document.write(html);
    reportWindow.document.close();
    
    showNotification(`Сформирован отчет для печати с ${data.length} позициями`, 'success');
}

// Вспомогательная функция для скачивания файла
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ============================================
// СИСТЕМА ИМПОРТА ДАННЫХ
// ============================================

// Показать модальное окно импорта из файла
window.showImportModal = function() {
    const modal = document.createElement('div');
    modal.className = 'inventory-modal-overlay';
    modal.innerHTML = `
        <div class="inventory-modal import-modal">
            <div class="inventory-modal-header">
                <h3>Импорт инвентарных номеров из файла</h3>
                <button class="inventory-modal-close" onclick="closeImportModal()">&times;</button>
            </div>
            <div class="inventory-modal-body">
                <div class="import-file-area" id="import-file-area">
                    <div>
                        <i class="fas fa-cloud-upload-alt" style="font-size: 48px; color: #6c757d; margin-bottom: 15px;"></i>
                        <p style="margin: 0 0 15px 0; font-size: 16px; color: #495057;">
                            Перетащите файл сюда или нажмите для выбора
                        </p>
                        <label for="import-file-input" class="import-file-label">
                            <i class="fas fa-folder-open"></i> Выбрать файл
                        </label>
                        <input type="file" id="import-file-input" class="import-file-input" accept=".txt,.csv,.xlsx,.xls">
                        <div class="import-file-info">
                            Поддерживаемые форматы: TXT, CSV, Excel (.xlsx, .xls)<br>
                            Каждый номер должен быть на отдельной строке
                        </div>
                    </div>
                </div>
                
                <div class="import-progress" id="import-progress">
                    <div class="import-progress-bar">
                        <div class="import-progress-fill" id="import-progress-fill"></div>
                    </div>
                    <div class="import-progress-text" id="import-progress-text">Подготовка...</div>
                </div>
                
                <div class="import-queue-info" id="import-queue-info">
                    <h4>Очередь импорта:</h4>
                    <div class="import-queue-list" id="import-queue-list"></div>
                </div>
            </div>
            <div class="inventory-modal-footer">
                <button class="inventory-action-btn inventory-btn-secondary" onclick="closeImportModal()">
                    Отмена
                </button>
                <button class="inventory-action-btn inventory-btn-primary" onclick="startImport()" disabled id="start-import-btn">
                    <i class="fas fa-play"></i> Начать импорт
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    window.currentImportModal = modal;
    
    // Настраиваем drag & drop
    setupFileDragDrop();
    
    // Настраиваем выбор файла
    document.getElementById('import-file-input').addEventListener('change', handleFileSelect);
}

// Показать модальное окно импорта из буфера обмена
window.showClipboardImportModal = function() {
    const modal = document.createElement('div');
    modal.className = 'inventory-modal-overlay';
    modal.innerHTML = `
        <div class="inventory-modal import-modal">
            <div class="inventory-modal-header">
                <h3>Импорт из буфера обмена</h3>
                <button class="inventory-modal-close" onclick="closeImportModal()">&times;</button>
            </div>
            <div class="inventory-modal-body">
                <div class="clipboard-import-area">
                    <p style="margin-bottom: 15px; color: #495057;">
                        Вставьте инвентарные номера (каждый на отдельной строке):
                    </p>
                    <textarea 
                        id="clipboard-import-textarea" 
                        class="clipboard-import-textarea"
                        placeholder="Пример:&#10;123456&#10;789012&#10;345678"
                    ></textarea>
                    <div style="margin-top: 10px; font-size: 14px; color: #6c757d;">
                        Поддерживаются различные разделители: новая строка, запятая, точка с запятой, пробел
                    </div>
                </div>
                
                <div class="import-progress" id="clipboard-import-progress">
                    <div class="import-progress-bar">
                        <div class="import-progress-fill" id="clipboard-import-progress-fill"></div>
                    </div>
                    <div class="import-progress-text" id="clipboard-import-progress-text">Подготовка...</div>
                </div>
                
                <div class="import-queue-info" id="clipboard-import-queue-info">
                    <h4>Очередь импорта:</h4>
                    <div class="import-queue-list" id="clipboard-import-queue-list"></div>
                </div>
            </div>
            <div class="inventory-modal-footer">
                <button class="inventory-action-btn inventory-btn-secondary" onclick="closeImportModal()">
                    Отмена
                </button>
                <button class="inventory-action-btn inventory-btn-primary" onclick="startClipboardImport()">
                    <i class="fas fa-play"></i> Начать импорт
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    window.currentImportModal = modal;
    
    // Фокус на textarea
    setTimeout(() => {
        document.getElementById('clipboard-import-textarea').focus();
    }, 100);
}

// Закрыть модальное окно импорта
window.closeImportModal = function() {
    if (window.currentImportModal) {
        window.currentImportModal.remove();
        window.currentImportModal = null;
    }
    
    // Останавливаем импорт если он идет
    if (window.importQueue) {
        window.importQueue.stopped = true;
    }
}

// Настройка drag & drop для файлов
function setupFileDragDrop() {
    const dropArea = document.getElementById('import-file-area');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.add('dragover'), false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.remove('dragover'), false);
    });
    
    dropArea.addEventListener('drop', handleDrop, false);
}

// Обработка drop файла
function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
        processImportFile(files[0]);
    }
}

// Обработка выбора файла
function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        processImportFile(files[0]);
    }
}

// Обработка файла импорта
window.processImportFile = function(file) {
    const allowedTypes = [
        'text/plain',
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(txt|csv|xlsx|xls)$/i)) {
        showNotification('Неподдерживаемый формат файла. Используйте TXT, CSV или Excel файлы.', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        const numbers = parseImportContent(content, file.name);
        
        if (numbers.length === 0) {
            showNotification('В файле не найдено инвентарных номеров', 'warning');
            return;
        }
        
        setupImportQueue(numbers);
        showNotification(`Загружено ${numbers.length} номеров из файла`, 'success');
    };
    
    reader.onerror = function() {
        showNotification('Ошибка чтения файла', 'error');
    };
    
    reader.readAsText(file);
}

// Парсинг содержимого файла
function parseImportContent(content, filename) {
    let numbers = [];
    
    // Определяем разделители
    const separators = ['\n', '\r\n', ',', ';', '\t'];
    
    // Пробуем разные разделители
    for (const sep of separators) {
        const parts = content.split(sep);
        if (parts.length > numbers.length) {
            numbers = parts;
        }
    }
    
    // Очищаем и фильтруем номера
    numbers = numbers
        .map(num => num.trim())
        .filter(num => num.length > 0)
        .filter(num => /^[a-zA-Z0-9]+$/.test(num)); // Только буквы и цифры
    
    // Убираем дубликаты
    numbers = [...new Set(numbers)];
    
    return numbers;
}

// Настройка очереди импорта
function setupImportQueue(numbers) {
    window.importQueue = {
        numbers: numbers,
        current: 0,
        total: numbers.length,
        results: [],
        multipleResults: [],
        stopped: false
    };
    
    // Показываем информацию об очереди
    const queueInfo = document.getElementById('import-queue-info');
    const queueList = document.getElementById('import-queue-list');
    
    queueInfo.style.display = 'block';
    queueList.innerHTML = numbers.slice(0, 10).join('<br>') + 
        (numbers.length > 10 ? `<br>... и еще ${numbers.length - 10} номеров` : '');
    
    // Активируем кнопку импорта
    document.getElementById('start-import-btn').disabled = false;
}

// Начать импорт из файла
function startImport() {
    if (!window.importQueue) {
        showNotification('Сначала загрузите файл', 'warning');
        return;
    }
    
    // Показываем прогресс
    document.getElementById('import-progress').style.display = 'block';
    document.getElementById('start-import-btn').disabled = true;
    
    // Запускаем импорт
    processImportQueue();
}

// Начать импорт из буфера обмена
function startClipboardImport() {
    const textarea = document.getElementById('clipboard-import-textarea');
    const content = textarea.value.trim();
    
    if (!content) {
        showNotification('Введите инвентарные номера', 'warning');
        return;
    }
    
    const numbers = parseImportContent(content, 'clipboard');
    
    if (numbers.length === 0) {
        showNotification('Не найдено корректных инвентарных номеров', 'warning');
        return;
    }
    
    // Настраиваем очередь для буфера обмена
    window.importQueue = {
        numbers: numbers,
        current: 0,
        total: numbers.length,
        results: [],
        multipleResults: [],
        stopped: false,
        isClipboard: true
    };
    
    // Показываем информацию об очереди
    const queueInfo = document.getElementById('clipboard-import-queue-info');
    const queueList = document.getElementById('clipboard-import-queue-list');
    
    queueInfo.style.display = 'block';
    queueList.innerHTML = numbers.slice(0, 10).join('<br>') + 
        (numbers.length > 10 ? `<br>... и еще ${numbers.length - 10} номеров` : '');
    
    // Показываем прогресс
    document.getElementById('clipboard-import-progress').style.display = 'block';
    
    // Запускаем импорт
    processImportQueue();
}

// Обработка очереди импорта
async function processImportQueue() {
    const queue = window.importQueue;
    if (!queue || queue.stopped) return;
    
    const progressPrefix = queue.isClipboard ? 'clipboard-import-' : 'import-';
    const progressFill = document.getElementById(progressPrefix + 'progress-fill');
    const progressText = document.getElementById(progressPrefix + 'progress-text');
    
    while (queue.current < queue.total && !queue.stopped) {
        const number = queue.numbers[queue.current];
        const progress = ((queue.current + 1) / queue.total) * 100;
        
        // Обновляем прогресс
        progressFill.style.width = progress + '%';
        progressText.textContent = `Обработка ${queue.current + 1} из ${queue.total}: ${number}`;
        
        try {
            // Выполняем поиск
            const result = await searchNumber(number);
            
            if (result.items && result.items.length > 1) {
                // Множественные результаты - добавляем в очередь для выбора
                queue.multipleResults.push({
                    number: number,
                    items: result.items
                });
            } else if (result.items && result.items.length === 1) {
                // Один результат - добавляем сразу
                addItemToBuffer(result.items[0], number);
            } else {
                // Не найдено
                addNotFoundToBuffer(number);
            }
            
            queue.results.push(result);
            
        } catch (error) {
            console.error('Ошибка при поиске номера', number, error);
            addNotFoundToBuffer(number);
        }
        
        queue.current++;
        
        // Небольшая задержка чтобы не перегружать сервер
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Завершение импорта
    if (!queue.stopped) {
        progressText.textContent = `Импорт завершен. Обработано ${queue.total} номеров.`;
        
        // Обновляем буфер
        renderBuffer();
        
        // Обрабатываем множественные результаты
        if (queue.multipleResults.length > 0) {
            showNotification(`Импорт завершен. Найдено ${queue.multipleResults.length} номеров с множественными результатами.`, 'info');
            processMultipleResults(queue.multipleResults);
        } else {
            showNotification(`Импорт завершен. Добавлено ${queue.results.length} позиций.`, 'success');
            setTimeout(() => closeImportModal(), 2000);
        }
    }
}

// Поиск номера (возвращает Promise)
function searchNumber(searchTerm) {
    return new Promise((resolve, reject) => {
        // Убираем ведущие нули
        const originalTerm = searchTerm;
        searchTerm = searchTerm.replace(/^0+/, '') || '0';
        
        // Проверяем на некорректный номер
        if (searchTerm === '0') {
            resolve({ items: [] });
            return;
        }
        
        const formData = new FormData();
        formData.append('search_serial', searchTerm);
        
        if (typeof GLPI_CSRF_TOKEN !== 'undefined') {
            formData.append('_glpi_csrf_token', GLPI_CSRF_TOKEN);
        }
        
        fetch(window.location.origin + '/plugins/inventory/ajax/search.php', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                reject(new Error(data.error));
            } else if (data.success) {
                resolve(data);
            } else {
                reject(new Error('Неизвестная ошибка при поиске'));
            }
        })
        .catch(error => {
            reject(error);
        });
    });
}

// Обработка множественных результатов
function processMultipleResults(multipleResults) {
    if (multipleResults.length === 0) return;
    
    const currentResult = multipleResults.shift();
    
    // Показываем модальное окно выбора для текущего номера
    showImportSelectionModal(currentResult.number, currentResult.items, () => {
        // После выбора переходим к следующему
        processMultipleResults(multipleResults);
    });
}

// Модальное окно выбора для импорта
function showImportSelectionModal(searchTerm, items, onComplete) {
    // Закрываем модальное окно импорта
    closeImportModal();
    
    const modal = document.createElement('div');
    modal.className = 'inventory-modal-overlay';
    modal.innerHTML = `
        <div class="inventory-modal selection-modal">
            <div class="inventory-modal-header">
                <h3>Найдено несколько позиций для "${searchTerm}" (${items.length})</h3>
                <button class="inventory-modal-close" onclick="closeImportSelectionModal()">&times;</button>
            </div>
            <div class="inventory-modal-body">
                <p>Выберите нужную позицию для добавления в буфер:</p>
                <div class="selection-items-list">
                    ${items.map((item, index) => `
                        <div class="selection-item" onclick="selectImportItem(${index})">
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
                <button class="inventory-action-btn inventory-btn-secondary" onclick="skipImportItem()">
                    Пропустить
                </button>
                <button class="inventory-action-btn inventory-btn-success" onclick="addAllImportItems()">
                    <i class="fas fa-plus"></i> Добавить все
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    window.currentImportSelectionModal = modal;
    window.currentImportSelection = {
        searchTerm: searchTerm,
        items: items,
        onComplete: onComplete
    };
}

// Выбрать элемент при импорте
function selectImportItem(index) {
    const selection = window.currentImportSelection;
    if (selection && selection.items[index]) {
        addItemToBuffer(selection.items[index], selection.searchTerm);
        renderBuffer();
        closeImportSelectionModal();
        if (selection.onComplete) selection.onComplete();
    }
}

// Добавить все элементы при импорте
function addAllImportItems() {
    const selection = window.currentImportSelection;
    if (selection && selection.items) {
        selection.items.forEach(item => {
            addItemToBuffer(item, selection.searchTerm);
        });
        renderBuffer();
        closeImportSelectionModal();
        if (selection.onComplete) selection.onComplete();
    }
}

// Пропустить элемент при импорте
function skipImportItem() {
    const selection = window.currentImportSelection;
    closeImportSelectionModal();
    if (selection && selection.onComplete) selection.onComplete();
}

// Закрыть модальное окно выбора при импорте
function closeImportSelectionModal() {
    if (window.currentImportSelectionModal) {
        window.currentImportSelectionModal.remove();
        window.currentImportSelectionModal = null;
        window.currentImportSelection = null;
    }
}
