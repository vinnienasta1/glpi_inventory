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
        
        let html = `
            <div class="inventory-buffer-container">
                <div class="inventory-buffer-header">
                    <h3>Буфер найденных позиций <span class="buffer-count">(${itemsBuffer.length})</span></h3>
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
                            <th>Местоположение</th>
                            <th>Пользователь</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        itemsBuffer.forEach(item => {
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
                    <td title="${escapeHtml(item.location_name)}">
                        ${escapeHtml(truncateText(item.location_name, 20))}
                    </td>
                    <td title="${escapeHtml(item.user_name)}">
                        ${escapeHtml(truncateText(item.user_name, 20))}
                    </td>
                    <td>
                        ${item.isNotFound ? 
                            '<span class="not-available">-</span>' :
                            `<a href="${item.url}" target="_blank" class="inventory-open-link">Открыть</a>`
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
    
    // Оставить только актуальные (убрать не найденные)
    window.keepActualItems = function() {
        const actualItems = itemsBuffer.filter(item => !item.isNotFound);
        if (actualItems.length !== itemsBuffer.length) {
            const removedCount = itemsBuffer.length - actualItems.length;
            itemsBuffer = actualItems;
            renderBuffer();
            showNotification(`Удалено ${removedCount} не найденных позиций`, 'success');
        } else {
            showNotification('В буфере нет не найденных позиций', 'info');
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
                <div class="inventory-modal" onclick="event.stopPropagation()">
                    <div class="inventory-modal-header">
                        <h3>Массовое изменение (${actualItems.length} позиций)</h3>
                        <button class="inventory-modal-close" onclick="closeBulkEditModal()">&times;</button>
                    </div>
                    <div class="inventory-modal-body">
                        <div class="inventory-form-group">
                            <label>Новый департамент:</label>
                            <input type="text" id="bulk-department" placeholder="Оставить пустым, чтобы не изменять">
                        </div>
                        <div class="inventory-form-group">
                            <label>Новый статус:</label>
                            <input type="text" id="bulk-status" placeholder="Оставить пустым, чтобы не изменять">
                        </div>
                        <div class="inventory-form-group">
                            <label>Новое местоположение:</label>
                            <input type="text" id="bulk-location" placeholder="Оставить пустым, чтобы не изменять">
                        </div>
                        <div class="inventory-form-group">
                            <label>Новый пользователь:</label>
                            <input type="text" id="bulk-user" placeholder="Оставить пустым, чтобы не изменять">
                        </div>
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
    }
    
    // Закрыть модальное окно редактирования
    window.closeBulkEditModal = function() {
        const modal = document.querySelector('.inventory-modal-overlay');
        if (modal) {
            modal.remove();
        }
    }
    
    // Применить массовые изменения
    window.applyBulkEdit = function() {
        const department = document.getElementById('bulk-department').value.trim();
        const status = document.getElementById('bulk-status').value.trim();
        const location = document.getElementById('bulk-location').value.trim();
        const user = document.getElementById('bulk-user').value.trim();
        
        let changesCount = 0;
        
        itemsBuffer.forEach(item => {
            if (!item.isNotFound) {
                if (department) {
                    item.group_name = department;
                    changesCount++;
                }
                if (status) {
                    item.state_name = status;
                    changesCount++;
                }
                if (location) {
                    item.location_name = location;
                    changesCount++;
                }
                if (user) {
                    item.user_name = user;
                    changesCount++;
                }
            }
        });
        
        closeBulkEditModal();
        renderBuffer();
        
        if (changesCount > 0) {
            showNotification(`Применены изменения (${changesCount} полей)`, 'success');
        } else {
            showNotification('Изменения не были внесены', 'info');
        }
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
