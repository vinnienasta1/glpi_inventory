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

if (session_status() === PHP_SESSION_NONE) {
    @session_start();
}
if (!isset($_SESSION['inventory_mass_updates_log']) || !is_array($_SESSION['inventory_mass_updates_log'])) {
    $_SESSION['inventory_mass_updates_log'] = [];
}

// Получаем данные из POST
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['items']) || !isset($input['changes'])) {
    echo json_encode(['error' => 'Некорректные данные запроса']);
    exit;
}

$items = $input['items'];
$unique = [];
$filtered_items = [];
foreach ($items as $it) {
    if (!empty($it['isNotFound']) || !empty($it['isDuplicate'])) continue;
    $key = ($it['type_class'] ?? '') . ':' . ($it['id'] ?? '');
    if (isset($unique[$key])) continue;
    $unique[$key] = true;
    $filtered_items[] = $it;
}
$items = $filtered_items;
$changes = $input['changes'];

$results = [
    'success' => 0,
    'failed' => 0,
    'errors' => []
];

$undoLog = [
    'when' => date('c'),
    'user_id' => Session::getLoginUserID(),
    'user_name' => '',
    'items' => [] // каждый элемент: {'type_class','id','name','otherserial','serial','old':{...},'new':{...}}
];

// Определим отображаемое имя пользователя
$__uid = Session::getLoginUserID();
if ($__uid) {
    $u = new User();
    if ($u->getFromDB($__uid)) {
        $undoLog['user_name'] = trim(($u->fields['realname'] ?? '') . ' ' . ($u->fields['firstname'] ?? ''));
    }
}

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
    $revertFields = [];
    $appliedFields = [];
    $revertLabels = [];
    $appliedLabels = [];
    
    foreach ($changes as $change) {
        $field = $change['field'];
        $value = $change['value'] ?? null;
        $idValue = isset($change['id']) ? (int)$change['id'] : 0;
        
        // Преобразуем имена полей из фронтенда в поля GLPI (предпочитаем ID)
        switch ($field) {
            case 'group_name':
                if ($idValue > 0) {
                    if (isset($itemClass->fields['groups_id'])) {
                        $revertFields['groups_id'] = (int)$itemClass->fields['groups_id'];
                        // Человеко-читаемое имя старой группы
                        $oldName = '';
                        if ($revertFields['groups_id'] > 0) {
                            $grp = new Group();
                            if ($grp->getFromDB($revertFields['groups_id'])) {
                                $oldName = (string)($grp->fields['name'] ?? '');
                            }
                        }
                        $revertLabels['groups_id'] = $oldName;
                    }
                    $updateData['groups_id'] = $idValue;
                    $appliedFields['groups_id'] = $idValue;
                    // Имя новой группы
                    $newName = '';
                    $grp2 = new Group();
                    if ($grp2->getFromDB($idValue)) {
                        $newName = (string)($grp2->fields['name'] ?? '');
                    }
                    $appliedLabels['groups_id'] = $newName;
                }
                break;
            case 'state_name':
                if ($idValue > 0) {
                    if (isset($itemClass->fields['states_id'])) {
                        $revertFields['states_id'] = (int)$itemClass->fields['states_id'];
                        $oldName = '';
                        if ($revertFields['states_id'] > 0) {
                            $st = new State();
                            if ($st->getFromDB($revertFields['states_id'])) {
                                $oldName = (string)($st->fields['name'] ?? '');
                            }
                        }
                        $revertLabels['states_id'] = $oldName;
                    }
                    $updateData['states_id'] = $idValue;
                    $appliedFields['states_id'] = $idValue;
                    $newName = '';
                    $st2 = new State();
                    if ($st2->getFromDB($idValue)) {
                        $newName = (string)($st2->fields['name'] ?? '');
                    }
                    $appliedLabels['states_id'] = $newName;
                }
                break;
            case 'location_name':
                if ($idValue > 0) {
                    if (isset($itemClass->fields['locations_id'])) {
                        $revertFields['locations_id'] = (int)$itemClass->fields['locations_id'];
                        $oldName = '';
                        if ($revertFields['locations_id'] > 0) {
                            $loc = new Location();
                            if ($loc->getFromDB($revertFields['locations_id'])) {
                                $oldName = (string)($loc->fields['name'] ?? '');
                            }
                        }
                        $revertLabels['locations_id'] = $oldName;
                    }
                    $updateData['locations_id'] = $idValue;
                    $appliedFields['locations_id'] = $idValue;
                    $newName = '';
                    $loc2 = new Location();
                    if ($loc2->getFromDB($idValue)) {
                        $newName = (string)($loc2->fields['name'] ?? '');
                    }
                    $appliedLabels['locations_id'] = $newName;
                }
                break;
            case 'user_name':
                if ($idValue > 0) {
                    if (isset($itemClass->fields['users_id'])) {
                        $revertFields['users_id'] = (int)$itemClass->fields['users_id'];
                        $oldName = '';
                        if ($revertFields['users_id'] > 0) {
                            $usr = new User();
                            if ($usr->getFromDB($revertFields['users_id'])) {
                                $oldName = trim((string)($usr->fields['realname'] ?? '') . ' ' . (string)($usr->fields['firstname'] ?? ''));
                            }
                        }
                        $revertLabels['users_id'] = $oldName;
                    }
                    $updateData['users_id'] = $idValue;
                    $appliedFields['users_id'] = $idValue;
                    $newName = '';
                    $usr2 = new User();
                    if ($usr2->getFromDB($idValue)) {
                        $newName = trim((string)($usr2->fields['realname'] ?? '') . ' ' . (string)($usr2->fields['firstname'] ?? ''));
                    }
                    $appliedLabels['users_id'] = $newName;
                }
                break;
            case 'contact':
                if ($value !== null) {
                    if (isset($itemClass->fields['contact'])) {
                        $revertFields['contact'] = (string)$itemClass->fields['contact'];
                        $revertLabels['contact'] = (string)$itemClass->fields['contact'];
                    }
                    $updateData['contact'] = $value;
                    $appliedFields['contact'] = $value;
                    $appliedLabels['contact'] = $value;
                }
                break;
            case 'comment_append':
                if ($value !== null) {
                    $current = isset($itemClass->fields['comment']) ? (string)$itemClass->fields['comment'] : '';
                    $append = (string)$value;
                    if ($append !== '') {
                        $revertFields['comment'] = $current;
                        $revertLabels['comment'] = $current;
                        $updateData['comment'] = $current === '' ? $append : ($current . "\n" . $append);
                        $appliedFields['comment'] = $updateData['comment'];
                        $appliedLabels['comment'] = $updateData['comment'];
                    }
                }
                break;
            case 'comment_set':
                if ($value !== null) {
                    $current = isset($itemClass->fields['comment']) ? (string)$itemClass->fields['comment'] : '';
                    $revertFields['comment'] = $current;
                    $revertLabels['comment'] = $current;
                    $updateData['comment'] = (string)$value;
                    $appliedFields['comment'] = $updateData['comment'];
                    $appliedLabels['comment'] = $updateData['comment'];
                }
                break;
        }
    }
    
    // Выполняем обновление
    if (count($updateData) > 1) { // Больше чем просто ID
        if ($itemClass->update($updateData)) {
            $results['success']++;
            if (!empty($revertFields)) {
                $undoLog['items'][] = [
                    'type_class' => $item['type_class'],
                    'id' => (int)$item['id'],
                    'name' => isset($itemClass->fields['name']) ? (string)$itemClass->fields['name'] : '',
                    'otherserial' => isset($itemClass->fields['otherserial']) ? (string)$itemClass->fields['otherserial'] : '',
                    'serial' => isset($itemClass->fields['serial']) ? (string)$itemClass->fields['serial'] : '',
                    'old' => $revertFields,
                    'new' => $appliedFields,
                    'old_labels' => $revertLabels,
                    'new_labels' => $appliedLabels
                ];
            }
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

// Сохраняем лог для возможного отката (только если были успешные обновления)
if ($results['success'] > 0 && !empty($undoLog['items'])) {
    $_SESSION['inventory_last_mass_update'] = $undoLog;
    // Добавляем в общий журнал
    $undoLog['id'] = uniqid('log_', true);
    $_SESSION['inventory_mass_updates_log'][] = $undoLog;
}
?>
