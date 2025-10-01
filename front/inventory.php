<?php
/**
 * Главная страница плагина Inventory
 */

include ("../../../inc/includes.php");

// Проверка прав доступа
Session::checkLoginUser();

// Заголовок страницы
Html::header('Инвенторизация', $_SERVER['PHP_SELF'], "tools", "PluginInventoryInventory");

// Подключаем CSS и JS
echo "<link rel='stylesheet' type='text/css' href='/plugins/inventory/css/inventory.css?v=" . time() . "'>";

// Передаем CSRF токен в JavaScript ПРАВИЛЬНО
echo "<script>";
echo "var GLPI_CSRF_TOKEN = '" . Session::getNewCSRFToken() . "';";
echo "</script>";

echo "<script src='/plugins/inventory/js/inventory.js?v=" . time() . "'></script>";

// Режим отладки
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
            <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                <input 
                    type="text" 
                    id="inventory-search-input" 
                    name="search_serial" 
                    placeholder="Введите инвентарный или серийный номер" 
                    style="flex: 1; padding: 10px; font-size: 16px; border: 1px solid #ddd; border-radius: 4px;"
                    autocomplete="off"
                />
                <button 
                    type="submit" 
                    id="inventory-search-btn"
                    style="padding: 10px 30px; font-size: 16px; background: #0d6efd; color: white; border: none; border-radius: 4px; cursor: pointer;"
                >
                    <i class="fas fa-search" style="margin-right: 5px;"></i>
                    Поиск
                </button>
            </div>
        </form>
        
        
        <div id="inventory-results"></div>
    </div>
</div>

<?php
Html::footer();
?>
