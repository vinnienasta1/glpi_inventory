<?php
/**
 * Откат последнего массового изменения (в рамках сессии)
 */

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
Session::checkLoginUser();
header('Content-Type: application/json');
if (session_status() === PHP_SESSION_NONE) { @session_start(); }

// Можно откатывать по id записи из журнала, или последнее
$log = null;
if (!empty($_POST['log_id'])) {
    $logId = (string)$_POST['log_id'];
    $logs = $_SESSION['inventory_mass_updates_log'] ?? [];
    foreach (array_reverse($logs) as $l) {
        if (!empty($l['id']) && $l['id'] === $logId) { $log = $l; break; }
    }
} else {
    $log = $_SESSION['inventory_last_mass_update'] ?? null;
}

if (!$log) {
    echo json_encode(['success' => false, 'error' => 'Нет изменений для отката']);
    exit;
}
$items = $log['items'] ?? [];
$ok = 0; $fail = 0; $errors = [];

foreach ($items as $entry) {
    $type = $entry['type_class'] ?? '';
    $id = (int)($entry['id'] ?? 0);
    $fields = $entry['fields'] ?? [];
    if (!$type || !$id || empty($fields)) continue;

    $itemClass = null;
    switch ($type) {
        case 'computer': $itemClass = new Computer(); break;
        case 'monitor': $itemClass = new Monitor(); break;
        case 'peripheral': $itemClass = new Peripheral(); break;
        default: continue 2;
    }
    if (!$itemClass->getFromDB($id)) { $fail++; $errors[] = "Не удалось загрузить объект ID: $id"; continue; }
    $data = array_merge(['id' => $id], $fields);
    if ($itemClass->update($data)) { $ok++; } else { $fail++; $errors[] = "Не удалось откатить объект ID: $id"; }
}

// Очищаем «последний», но общий журнал сохраняем (можно решить иначе)
unset($_SESSION['inventory_last_mass_update']);

echo json_encode(['success' => true, 'results' => ['reverted' => $ok, 'failed' => $fail, 'errors' => $errors]]);
?>


