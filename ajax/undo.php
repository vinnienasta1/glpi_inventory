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

if (empty($_SESSION['inventory_last_mass_update'])) {
    echo json_encode(['success' => false, 'error' => 'Нет изменений для отката']);
    exit;
}

$log = $_SESSION['inventory_last_mass_update'];
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

// Очищаем лог после попытки отката
unset($_SESSION['inventory_last_mass_update']);

echo json_encode(['success' => true, 'results' => ['reverted' => $ok, 'failed' => $fail, 'errors' => $errors]]);
?>


