<?php
/**
 * AJAX обработчик для поиска оборудования
 */

// Определяем путь к GLPI
$glpi_root = '';
for ($i = 0; $i < 5; $i++) {
    $test_path = str_repeat('../', $i) . 'inc/includes.php';
    if (file_exists($test_path)) {
        $glpi_root = str_repeat('../', $i);
        break;
    }
}

if (empty($glpi_root)) {
    // Последняя попытка - стандартный путь
    $glpi_root = '../../../';
}

include ($glpi_root . "inc/includes.php");

// Проверка прав доступа
Session::checkRight("config", READ);

header('Content-Type: application/json');

if (!isset($_POST['search_serial']) || empty(trim($_POST['search_serial']))) {
    echo json_encode(['error' => 'Введите инвентарный номер для поиска']);
    exit;
}

$serial = trim($_POST['search_serial']);

try {
    $items = PluginInventoryInventory::searchBySerial($serial);
    
    $results = [];
    foreach ($items as $item) {
        $data = PluginInventoryInventory::getExtendedInfo($item['data']);
        $type = $item['type'];
        
        $type_name = '';
        switch($type) {
            case 'Computer':
                $type_name = 'Компьютер';
                break;
            case 'Monitor':
                $type_name = 'Монитор';
                break;
            case 'Peripheral':
                $type_name = 'Устройство';
                break;
        }
        
        $results[] = [
            'id' => $data['id'],
            'type' => $type_name,
            'type_class' => strtolower($type),
            'name' => $data['name'],
            'otherserial' => $data['otherserial'],
            'serial' => $data['serial'],
            'group_name' => isset($data['group_name']) ? $data['group_name'] : '-',
            'state_name' => isset($data['state_name']) ? $data['state_name'] : '-',
            'location_name' => isset($data['location_name']) ? $data['location_name'] : '-',
            'user_name' => isset($data['user_name']) ? $data['user_name'] : '-',
            'comment' => $data['comment'],
            'url' => "/front/" . strtolower($type) . ".form.php?id=" . $data['id']
        ];
    }
    
    echo json_encode([
        'success' => true,
        'items' => $results,
        'count' => count($results),
        'search_term' => $serial
    ]);
    
} catch (Exception $e) {
    // Логируем ошибку
    error_log("GLPI Inventory Plugin Error: " . $e->getMessage());
    
    // Отправляем пользователю безопасное сообщение
    $error_message = 'Ошибка поиска: ';
    if (strpos($e->getMessage(), 'database') !== false || strpos($e->getMessage(), 'DB') !== false) {
        $error_message .= 'Проблема с подключением к базе данных';
    } else if (strpos($e->getMessage(), 'Class') !== false && strpos($e->getMessage(), 'not found') !== false) {
        $error_message .= 'Плагин не установлен правильно';
    } else {
        $error_message .= $e->getMessage();
    }
    
    echo json_encode(['error' => $error_message]);
}
?>
