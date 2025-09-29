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
        
        fetch('/plugins/inventory/ajax/search.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showError(data.error);
            } else if (data.success) {
                showResults(data);
            } else {
                showError('Неизвестная ошибка при поиске');
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            showError('Ошибка соединения с сервером');
        })
        .finally(() => {
            // Включаем кнопку поиска
            searchBtn.disabled = false;
        });
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
        resultsContainer.innerHTML = `
            <div class="inventory-error">
                <strong>Ошибка:</strong> ${escapeHtml(message)}
            </div>
        `;
    }
    
    // Показать результаты
    function showResults(data) {
        if (data.items.length === 0) {
            resultsContainer.innerHTML = `
                <div class="inventory-no-results">
                    Оборудование с инвентарным номером "${escapeHtml(data.search_term)}" не найдено
                </div>
            `;
            return;
        }
        
        let html = `
            <table class="inventory-results-table">
                <thead>
                    <tr>
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
        
        data.items.forEach(item => {
            html += `
                <tr>
                    <td>
                        <span class="inventory-type-badge inventory-type-${item.type_class}">
                            ${escapeHtml(item.type)}
                        </span>
                    </td>
                    <td title="${escapeHtml(item.name)}">
                        ${escapeHtml(truncateText(item.name, 30))}
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
                        <a href="${item.url}" target="_blank" class="inventory-open-link">
                            Открыть
                        </a>
                    </td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
            <div class="inventory-stats">
                Найдено элементов: <strong>${data.count}</strong>
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
    
    // Фокус на поле ввода при загрузке страницы
    searchInput.focus();
});
