<?php
/**
 * AJAX обработчик для поиска оборудования
 */

include ("../../../inc/includes.php");

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
    echo json_encode(['error' => 'Ошибка поиска: ' . $e->getMessage()]);
}
?>
