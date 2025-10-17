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

$tpl = trim($input['template']);
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

// Определяем файл шаблона
$tplLower = strtolower($tpl);
if (!preg_match('/\.html$/i', $tplLower)) {
    // Разрешаем ключи вида giveing|return|sale
    $tplLower = $tplLower . '.html';
}

$pluginDir = realpath(__DIR__ . '/..');
$templatesDir = realpath($pluginDir . DIRECTORY_SEPARATOR . 'templates');
$tplPath = realpath($templatesDir . DIRECTORY_SEPARATOR . basename($tplLower));
if ($tplPath === false || strpos($tplPath, $templatesDir) !== 0 || !is_file($tplPath)) {
    echo json_encode(['success' => false, 'error' => 'HTML шаблон не найден']);
    exit;
}

$rawHtml = file_get_contents($tplPath);
if ($rawHtml === false) {
    echo json_encode(['success' => false, 'error' => 'Не удалось прочитать HTML шаблон']);
    exit;
}

// Парсим HTML и подставляем данные
$dom = new DOMDocument('1.0', 'UTF-8');
libxml_use_internal_errors(true);
$dom->loadHTML('<?xml encoding="utf-8" ?>' . $rawHtml, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
libxml_clear_errors();
$xpath = new DOMXPath($dom);

// Первый table: заполняем 6 строк (после заголовка)
$rows = $xpath->query('(//table)[1]//tr');
if ($rows && $rows->length > 1) {
    for ($i = 0; $i < 6; $i++) {
        $rowIndex = 1 + $i; // 0 — это заголовок
        if ($rowIndex >= $rows->length) break;
        $tr = $rows->item($rowIndex);
        if (!$tr) continue;
        $tds = $tr->getElementsByTagName('td');
        $item = isset($items[$i]) ? $items[$i] : null;
        if ($tds->length >= 4) {
            // ожидаем: td[0]=№, td[1]=name (colspan=3), td[2]=inv, td[3]=serial
            if ($item) {
                $tds->item(1)->nodeValue = (string)($item['name'] ?? '');
                $tds->item(2)->nodeValue = (string)($item['otherserial'] ?? '');
                $tds->item(3)->nodeValue = (string)($item['serial'] ?? '');
            } else {
                $tds->item(1)->nodeValue = '';
                $tds->item(2)->nodeValue = '';
                $tds->item(3)->nodeValue = '';
            }
        }
    }
}

// Подписи: ищем в блоке .signature соответствующие строки
$signPs = $xpath->query("//div[contains(concat(' ', normalize-space(@class), ' '), ' signature ')]//p");
if ($signPs) {
    foreach ($signPs as $p) {
        $text = trim($p->textContent);
        if (mb_stripos($text, 'Сотрудник') !== false) {
            while ($p->firstChild) { $p->removeChild($p->firstChild); }
            $p->appendChild($dom->createTextNode('Сотрудник ДИТ: '));
            $strong = $dom->createElement('strong', $issuer);
            $p->appendChild($strong);
        } elseif (mb_stripos($text, 'Получатель') !== false) {
            while ($p->firstChild) { $p->removeChild($p->firstChild); }
            $p->appendChild($dom->createTextNode('Получатель техники: '));
            $strong = $dom->createElement('strong', $user);
            $p->appendChild($strong);
        }
    }
}

$finalHtml = $dom->saveHTML();

// Заголовок для удобства
$title = 'Акт';
if (strpos(basename($tplPath), 'giveing') === 0) $title = 'Акт Выдачи';
elseif (strpos(basename($tplPath), 'return') === 0) $title = 'Акт Возврата';
elseif (strpos(basename($tplPath), 'sale') === 0) $title = 'Акт Выкупа';

echo json_encode(['success' => true, 'html' => $finalHtml, 'title' => $title]);

?>


