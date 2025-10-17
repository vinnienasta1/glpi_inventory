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
        $value = $change['value'] ?? null;
        $idValue = isset($change['id']) ? (int)$change['id'] : 0;
        
        // Преобразуем имена полей из фронтенда в поля GLPI (предпочитаем ID)
        switch ($field) {
            case 'group_name':
                if ($idValue > 0) {
                    $updateData['groups_id'] = $idValue;
                }
                break;
            case 'state_name':
                if ($idValue > 0) {
                    $updateData['states_id'] = $idValue;
                }
                break;
            case 'location_name':
                if ($idValue > 0) {
                    $updateData['locations_id'] = $idValue;
                }
                break;
            case 'user_name':
                if ($idValue > 0) {
                    $updateData['users_id'] = $idValue;
                }
                break;
            case 'contact':
                if ($value !== null) {
                    $updateData['contact'] = $value;
                }
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
