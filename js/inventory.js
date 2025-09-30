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
                    <button class="inventory-clear-buffer" onclick="clearBuffer()">Очистить буфер</button>
                </div>
                <table class="inventory-results-table">
                    <thead>
                        <tr>
                            <th>Время</th>
                            <th>Поиск</th>
                            <th>Тип</th>
                            <th>Наименование</th>
                            <th>Инв. номер</th>
                            <th>Серийный номер</th>
                            <th>Департамент</th>
                            <th>Статус</th>
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
            
            const timeStr = item.timestamp.toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            
            html += `
                <tr class="${rowClass}">
                    <td class="time-cell">${timeStr}</td>
                    <td class="search-term-cell">${escapeHtml(item.search_term)}</td>
                    <td>${typeDisplay}</td>
                    <td title="${escapeHtml(item.name)}">
                        ${escapeHtml(truncateText(item.name, 25))}
                    </td>
                    <td>${escapeHtml(item.otherserial || '-')}</td>
                    <td>${escapeHtml(item.serial || '-')}</td>
                    <td>${escapeHtml(item.group_name)}</td>
                    <td>${escapeHtml(item.state_name)}</td>
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
    
    // Инициализация: показываем пустой буфер
    renderBuffer();
    
    // Фокус на поле ввода при загрузке страницы
    searchInput.focus();
});
