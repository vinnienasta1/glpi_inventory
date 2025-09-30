<?php
/**
 * AJAX обработчик для массового обновления оборудования
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

// Получаем данные из POST
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['items']) || !isset($input['changes'])) {
    echo json_encode(['error' => 'Некорректные данные запроса']);
    exit;
}

$items = $input['items'];
$changes = $input['changes'];

$results = [
    'success' => 0,
    'failed' => 0,
    'errors' => []
];

foreach ($items as $item) {
    if ($item['isNotFound']) {
        continue; // Пропускаем не найденные
    }
    
    // Определяем класс объекта
    $itemClass = null;
    switch ($item['type_class']) {
        case 'computer':
            $itemClass = new Computer();
            break;
        case 'monitor':
            $itemClass = new Monitor();
            break;
        case 'peripheral':
            $itemClass = new Peripheral();
            break;
        default:
            continue 2; // Пропускаем неизвестный тип
    }
    
    // Загружаем объект из БД
    if (!$itemClass->getFromDB($item['id'])) {
        $results['failed']++;
        $results['errors'][] = "Не удалось загрузить объект ID: {$item['id']}";
        continue;
    }
    
    // Подготавливаем данные для обновления
    $updateData = ['id' => $item['id']];
    
    foreach ($changes as $change) {
        $field = $change['field'];
        $value = $change['value'];
        
        // Преобразуем имена полей из фронтенда в поля GLPI
        $glpiField = null;
        
        switch ($field) {
            case 'group_name':
                $glpiField = 'groups_id';
                // Находим ID группы по имени
                $group = new Group();
                $groupId = $group->import(['name' => $value]);
                if ($groupId) {
                    $updateData[$glpiField] = $groupId;
                }
                break;
                
            case 'state_name':
                $glpiField = 'states_id';
                // Находим ID статуса по имени
                $iterator = $DB->request([
                    'SELECT' => 'id',
                    'FROM' => 'glpi_states',
                    'WHERE' => ['completename' => $value]
                ]);
                foreach ($iterator as $row) {
                    $updateData[$glpiField] = $row['id'];
                    break;
                }
                break;
                
            case 'location_name':
                $glpiField = 'locations_id';
                // Находим ID местоположения по имени
                $iterator = $DB->request([
                    'SELECT' => 'id',
                    'FROM' => 'glpi_locations',
                    'WHERE' => ['completename' => $value]
                ]);
                foreach ($iterator as $row) {
                    $updateData[$glpiField] = $row['id'];
                    break;
                }
                break;
                
            case 'user_name':
                $glpiField = 'users_id';
                // Находим ID пользователя по имени
                $names = explode(' ', trim($value));
                $where = [];
                if (count($names) >= 2) {
                    $where = [
                        'realname' => $names[0],
                        'firstname' => $names[1]
                    ];
                } else {
                    $where = ['realname' => $value];
                }
                $iterator = $DB->request([
                    'SELECT' => 'id',
                    'FROM' => 'glpi_users',
                    'WHERE' => $where
                ]);
                foreach ($iterator as $row) {
                    $updateData[$glpiField] = $row['id'];
                    break;
                }
                break;
                
            case 'contact':
                $glpiField = 'contact';
                $updateData[$glpiField] = $value;
                break;
        }
    }
    
    // Выполняем обновление
    if (count($updateData) > 1) { // Больше чем просто ID
        if ($itemClass->update($updateData)) {
            $results['success']++;
        } else {
            $results['failed']++;
            $results['errors'][] = "Не удалось обновить объект ID: {$item['id']}";
        }
    }
}

echo json_encode([
    'success' => true,
    'results' => $results
]);
?>
