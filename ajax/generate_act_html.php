<?php
/**
 * Генерация HTML-актов для печати/сохранения (без зависимостей), на основе буфера.
 * Вход (POST JSON):
 * {
 *   "template": "giveing|return|sale",
 *   "items": [ { name, otherserial, serial, user_name }, ... ],
 *   "issuer_name": "...",
 *   "user_name": "..."
 * }
 */

// Поиск корня GLPI
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

header('Content-Type: application/json; charset=utf-8');

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || empty($input['template'])) {
    echo json_encode(['success' => false, 'error' => 'Некорректные данные']);
    exit;
}

$tpl = strtolower(trim($input['template']));
$items = isset($input['items']) && is_array($input['items']) ? $input['items'] : [];
$issuer = isset($input['issuer_name']) ? (string)$input['issuer_name'] : '';
$user = isset($input['user_name']) ? (string)$input['user_name'] : '';

if ($issuer === '') {
    $uid = Session::getLoginUserID();
    if ($uid) {
        $u = new User();
        if ($u->getFromDB($uid)) {
            $issuer = trim(($u->fields['realname'] ?? '') . ' ' . ($u->fields['firstname'] ?? ''));
        }
    }
}

$title = 'Акт';
if (strpos($tpl, 'giveing') === 0 || $tpl === 'giveing') $title = 'Акт Выдачи';
elseif (strpos($tpl, 'return') === 0 || $tpl === 'return') $title = 'Акт Возврата';
elseif (strpos($tpl, 'sale') === 0 || $tpl === 'sale') $title = 'Акт Выкупа';

function h($s){ return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

$rows = '';
for ($i = 0; $i < 6; $i++) {
    $it = isset($items[$i]) ? $items[$i] : null;
    $rows .= '<tr>'
        . '<td>' . h($it ? ($it['name'] ?? '') : '') . '</td>'
        . '<td>' . h($it ? ($it['otherserial'] ?? '') : '') . '</td>'
        . '<td>' . h($it ? ($it['serial'] ?? '') : '') . '</td>'
        . '</tr>';
}

$date = date('d.m.Y');

$html = '<!DOCTYPE html>'
    . '<html><head><meta charset="utf-8"><title>' . h($title) . '</title>'
    . '<style>'
    . 'body{font-family:Arial,Helvetica,sans-serif;margin:20px;color:#000;}'
    . 'h1{font-size:20px;margin:0 0 10px 0;}'
    . 'table{width:100%;border-collapse:collapse;margin-top:10px;}'
    . 'th,td{border:1px solid #000;padding:6px;font-size:13px;}'
    . '.meta{margin-top:15px;font-size:14px;}'
    . '.signs{margin-top:40px;display:flex;gap:40px;}'
    . '.sign{flex:1;}'
    . '@media print{.no-print{display:none}}'
    . '</style>'
    . '</head><body>'
    . '<div class="no-print" style="text-align:right;margin-bottom:10px">'
    . '<button onclick="window.print()" style="padding:6px 10px">Печать</button>'
    . '</div>'
    . '<h1>' . h($title) . '</h1>'
    . '<div class="meta">Дата: ' . h($date) . '</div>'
    . '<table>'
    . '<thead><tr><th>Наименование</th><th>Инв. номер</th><th>Серийный номер</th></tr></thead>'
    . '<tbody>' . $rows . '</tbody>'
    . '</table>'
    . '<div class="signs">'
    . '<div class="sign">Выдающий: <strong>' . h($issuer) . '</strong></div>'
    . '<div class="sign">Пользователь: <strong>' . h($user) . '</strong></div>'
    . '</div>'
    . '</body></html>';

echo json_encode(['success' => true, 'html' => $html, 'title' => $title]);

?>


