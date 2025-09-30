<?php
/**
 * Главная страница плагина Inventory
 */

include ("../../../inc/includes.php");

// Проверка прав доступа
Session::checkRight("config", READ);

// Заголовок страницы
Html::header('Инвенторизация', $_SERVER['PHP_SELF'], "tools", "PluginInventoryInventory");

// Подключаем CSS и JS
echo "<link rel='stylesheet' type='text/css' href='/plugins/inventory/css/inventory.css'>";
echo "<script src='/plugins/inventory/js/inventory.js'></script>";

// Режим отладки (можно включить для диагностики)
$debug_mode = false;
if ($debug_mode) {
    echo "<script>console.log('GLPI Inventory Plugin Debug Mode');</script>";
    echo "<script>console.log('Current URL:', window.location.href);</script>";
    echo "<script>console.log('Plugin path:', '/plugins/inventory/');</script>";
}

?>

<div class="inventory-container">
    <div class="inventory-search-box">
        <h2 style="margin-top: 0; margin-bottom: 20px; color: #333;">
            <i class="fas fa-search" style="margin-right: 10px;"></i>
            Поиск оборудования по инвентарному номеру
        </h2>
        
        <form id="inventory-search-form">
            <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 10px;">
                <input 
                    type="text" 
                    id="inventory-search-input"
                    class="inventory-search-input"
                    placeholder="Введите инвентарный номер..."
                    autocomplete="off"
                    autofocus
                >
                <button 
                    type="submit" 
                    id="inventory-search-btn"
                    class="inventory-search-btn"
                >
                    <i class="fas fa-search" style="margin-right: 5px;"></i>
                    Поиск
                </button>
            </div>
        </form>
        
        <div style="margin-top: 15px; color: #6c757d; font-size: 14px;">
            <i class="fas fa-info-circle" style="margin-right: 5px;"></i>
            Поиск осуществляется по компьютерам, мониторам и периферийным устройствам
        </div>
    </div>
    
    <div id="inventory-results" class="inventory-results">
        <!-- Результаты поиска будут загружены сюда -->
    </div>
</div>

<?php
Html::footer();
?>
