<?php
/**
 * Возврат журнала массовых изменений текущей сессии
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
$logs = $_SESSION['inventory_mass_updates_log'] ?? [];
// Краткая сводка по изменениям для вывода в таблицу (по типам полей)
foreach ($logs as &$l) {
    $summary = [];
    $items = $l['items'] ?? [];
    foreach ($items as $it) {
        if (!empty($it['old']) && is_array($it['old'])) {
            foreach ($it['old'] as $field => $oldVal) {
                $summary[$field] = true;
            }
        }
    }
    $l['summary_fields'] = array_keys($summary);
}
unset($l);
echo json_encode(['success' => true, 'logs' => $logs]);
?>


