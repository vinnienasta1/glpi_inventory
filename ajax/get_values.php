<?php
/**
 * AJAX обработчик для получения списков значений из GLPI
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
    $glpi_root = '../../../';
}

include ($glpi_root . "inc/includes.php");

// Проверка авторизации
Session::checkLoginUser();

header('Content-Type: application/json');

$type = $_GET['type'] ?? '';

$result = [];

switch ($type) {
    case 'groups':
        // Получаем департаменты
        $iterator = $DB->request([
            'SELECT' => ['id', 'name'],
            'FROM' => 'glpi_groups',
            'ORDER' => 'name ASC'
        ]);
        
        foreach ($iterator as $row) {
            $result[] = [
                'id' => $row['id'],
                'name' => $row['name']
            ];
        }
        break;
        
    case 'states':
        // Получаем статусы
        $iterator = $DB->request([
            'SELECT' => ['id', 'completename'],
            'FROM' => 'glpi_states',
            'ORDER' => 'completename ASC'
        ]);
        
        foreach ($iterator as $row) {
            $result[] = [
                'id' => $row['id'],
                'name' => $row['completename']
            ];
        }
        break;
        
    case 'locations':
        // Получаем местоположения
        $iterator = $DB->request([
            'SELECT' => ['id', 'completename'],
            'FROM' => 'glpi_locations',
            'ORDER' => 'completename ASC'
        ]);
        
        foreach ($iterator as $row) {
            $result[] = [
                'id' => $row['id'],
                'name' => $row['completename']
            ];
        }
        break;
        
    case 'users':
        // Получаем пользователей
        $iterator = $DB->request([
            'SELECT' => ['id', 'realname', 'firstname'],
            'FROM' => 'glpi_users',
            'WHERE' => ['is_deleted' => 0],
            'ORDER' => 'realname ASC'
        ]);
        
        foreach ($iterator as $row) {
            $fullname = trim($row['realname'] . ' ' . $row['firstname']);
            if (empty($fullname)) {
                $fullname = 'ID: ' . $row['id'];
            }
            $result[] = [
                'id' => $row['id'],
                'name' => $fullname
            ];
        }
        break;
        
    default:
        echo json_encode(['error' => 'Unknown type']);
        exit;
}

echo json_encode([
    'success' => true,
    'data' => $result
]);
?>
