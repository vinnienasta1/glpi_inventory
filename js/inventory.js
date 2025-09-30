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
        const searchTerm = searchInput.value.trim();
        
        if (!searchTerm) {
            showError('Введите инвентарный номер для поиска');
            return;
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
                showError(data.error);
            } else if (data.success) {
                addToBuffer(data, searchTerm);
            } else {
                showError('Неизвестная ошибка при поиске');
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            // Добавляем "не найдено" в буфер при ошибке соединения  
            addNotFoundToBuffer(searchTerm);
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
        } else {
            // Найдены элементы
            data.items.forEach(item => {
                addItemToBuffer(item, searchTerm);
            });
        }
        
        renderBuffer();
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
    
    // Показать индикатор загрузки
    function showLoading() {
        resultsContainer.innerHTML = `
            <div class="inventory-loading">
                <div class="inventory-spinner"></div>
                Поиск оборудования...
            </div>
        `;
    }
    
    // Показать ошибку
    function showError(message) {
        const errorHtml = `
            <div class="inventory-error">
                <strong>Ошибка:</strong> ${escapeHtml(message)}
            </div>
        `;
        
        // Добавляем ошибку в начало контейнера, сохраняя буфер
        const existingContent = resultsContainer.innerHTML;
        if (existingContent.includes('inventory-buffer-container')) {
            // Вставляем ошибку перед буфером
            resultsContainer.innerHTML = errorHtml + existingContent;
        } else {
            resultsContainer.innerHTML = errorHtml;
        }
        
        // Автоматически скрываем ошибку через 5 секунд
        setTimeout(() => {
            const errorElement = resultsContainer.querySelector('.inventory-error');
            if (errorElement) {
                errorElement.remove();
            }
        }, 5000);
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
        
        // Подсчитываем актуальные позиции (найденные и не дубликаты)
        const actualCount = itemsBuffer.filter(item => !item.isNotFound).length;
        const uniqueActual = new Set();
        itemsBuffer.forEach(item => {
            if (!item.isNotFound && !item.isDuplicate) {
                uniqueActual.add(`${item.type_class}-${item.id}`);
            }
        });
        const uniqueActualCount = uniqueActual.size;
        
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
                            <th>Поиск</th>
                            <th>Тип</th>
                            <th>Наименование</th>
                            <th>Инв. номер</th>
                            <th>Серийный номер</th>
                            <th>Департамент</th>
                            <th>Статус</th>
                            <th>Стеллаж</th>
                            <th>Местоположение</th>
                            <th>Пользователь</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        itemsBuffer.forEach((item, index) => {
            const rowClass = item.isNotFound ? 'inventory-not-found-row' : 
                           item.isDuplicate ? 'inventory-duplicate-row' : '';
            
            const typeDisplay = item.isNotFound ? 
                '<span class="inventory-type-badge inventory-type-not-found">Не найдено</span>' :
                `<span class="inventory-type-badge inventory-type-${item.type_class}">
                    ${escapeHtml(item.type)}${item.isDuplicate ? ' <small>(Дубликат)</small>' : ''}
                </span>`;
            
            html += `
                <tr class="${rowClass}">
                    <td class="search-term-cell">${escapeHtml(item.search_term)}</td>
                    <td>${typeDisplay}</td>
                    <td title="${escapeHtml(item.name)}">
                        ${escapeHtml(truncateText(item.name, 25))}
                    </td>
                    <td>${escapeHtml(item.otherserial || '-')}</td>
                    <td>${escapeHtml(item.serial || '-')}</td>
                    <td>${escapeHtml(item.group_name)}</td>
                    <td>${escapeHtml(item.state_name)}</td>
                    <td title="${escapeHtml(item.contact || '-')}">
                        ${escapeHtml(truncateText(item.contact || '-', 15))}
                    </td>
                    <td title="${escapeHtml(item.location_name)}">
                        ${escapeHtml(truncateText(item.location_name, 20))}
                    </td>
                    <td title="${escapeHtml(item.user_name)}">
                        ${escapeHtml(truncateText(item.user_name, 20))}
                    </td>
                    <td class="actions-cell">
                        ${item.isNotFound ? 
                            `<button class="inventory-delete-btn" onclick="removeFromBuffer(${index})" title="Удалить">
                                <i class="fas fa-trash"></i>
                            </button>` :
                            `<a href="${item.url}" target="_blank" class="inventory-open-link" title="Открыть">
                                <i class="fas fa-external-link-alt"></i>
                            </a>
                            <button class="inventory-delete-btn" onclick="removeFromBuffer(${index})" title="Удалить">
                                <i class="fas fa-trash"></i>
                            </button>`
                        }
                    </td>
                </tr>
            `;
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
    window.showColumnsModal = function() {
        const modalHtml = `
            <div class="inventory-modal-overlay" onclick="closeColumnsModal()">
                <div class="inventory-modal" onclick="event.stopPropagation()">
                    <div class="inventory-modal-header">
                        <h3>Настройка столбцов</h3>
                        <button class="inventory-modal-close" onclick="closeColumnsModal()">&times;</button>
                    </div>
                    <div class="inventory-modal-body">
                        <p>Выберите столбцы для отображения:</p>
                        <div class="inventory-columns-list">
                            <label><input type="checkbox" checked> Поиск</label>
                            <label><input type="checkbox" checked> Тип</label>
                            <label><input type="checkbox" checked> Наименование</label>
                            <label><input type="checkbox" checked> Инв. номер</label>
                            <label><input type="checkbox" checked> Серийный номер</label>
                            <label><input type="checkbox" checked> Департамент</label>
                            <label><input type="checkbox" checked> Статус</label>
                            <label><input type="checkbox" checked> Стеллаж</label>
                            <label><input type="checkbox" checked> Местоположение</label>
                            <label><input type="checkbox" checked> Пользователь</label>
                            <label><input type="checkbox" checked> Действия</label>
                        </div>
                    </div>
                    <div class="inventory-modal-footer">
                        <button class="inventory-action-btn inventory-btn-secondary" onclick="closeColumnsModal()">
                            Отмена
                        </button>
                        <button class="inventory-action-btn inventory-btn-primary" onclick="applyColumnsSettings()">
                            Применить
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
    
    // Закрыть модальное окно настройки столбцов
    window.closeColumnsModal = function() {
        const modal = document.querySelector('.inventory-modal-overlay');
        if (modal) {
            modal.remove();
        }
    }
    
    // Применить настройки столбцов
    window.applyColumnsSettings = function() {
        // Пока что просто закрываем модальное окно
        // В будущем здесь будет логика скрытия/показа столбцов
        closeColumnsModal();
        showNotification('Настройки столбцов сохранены', 'success');
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
    
    // Инициализация: показываем пустой буфер
    renderBuffer();
    
    // Фокус на поле ввода при загрузке страницы
    searchInput.focus();
});
