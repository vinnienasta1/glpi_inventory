<?php
/**
 * AJAX обработчик для поиска оборудования
 */

// Логирование
error_log("INVENTORY AJAX: Request started");
error_log("INVENTORY AJAX: POST data: " . print_r($_POST, true));

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
    $glpi_root = '../../../';
}

error_log("INVENTORY AJAX: Before includes");

// ВАЖНО: Устанавливаем флаг для пропуска CSRF проверки в includes.php
define('GLPI_AJAX_CSRF', true);

include ($glpi_root . "inc/includes.php");

error_log("INVENTORY AJAX: After includes");

// Проверка авторизации
Session::checkLoginUser();

error_log("INVENTORY AJAX: User authorized");

header('Content-Type: application/json');

if (!isset($_POST['search_serial']) || empty(trim($_POST['search_serial']))) {
    echo json_encode(['error' => 'Введите инвентарный номер для поиска']);
    exit;
}

$serial = trim($_POST['search_serial']);

error_log("INVENTORY AJAX: Searching for: $serial");

try {
    $items = PluginInventoryInventory::searchBySerial($serial);
    
    error_log("INVENTORY AJAX: Found " . count($items) . " items");
    
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
            'contact' => isset($data['contact']) ? $data['contact'] : '-',
            'user_name' => isset($data['user_name']) ? $data['user_name'] : '-',
            'comment' => $data['comment'],
            'url' => "/front/" . strtolower($type) . ".form.php?id=" . $data['id']
        ];
    }
    
    $response = [
        'success' => true,
        'items' => $results,
        'count' => count($results),
        'search_term' => $serial
    ];
    
    error_log("INVENTORY AJAX: Response prepared");
    echo json_encode($response);
    
} catch (Exception $e) {
    error_log("INVENTORY AJAX ERROR: " . $e->getMessage());
    echo json_encode([
        'error' => 'Ошибка поиска: ' . $e->getMessage()
    ]);
}
?>
