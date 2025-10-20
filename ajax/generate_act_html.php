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

// Приоритетно берём полное имя из сессии GLPI
if (isset($_SESSION) && !empty($_SESSION['glpifriendlyname'])) {
    $issuer = (string)$_SESSION['glpifriendlyname'];
}
// Фоллбэк: берём из карточки пользователя
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
// Вспомогательные функции для распознавания заголовков
$normalize = function($s) { return trim(mb_strtolower(preg_replace('/\s+/u', ' ', (string)$s))); };
$contains = function($hay, $needle) { return mb_strpos($hay, $needle) !== false; };
// Транкование наименования до одной строки с многоточием
$truncate = function($s, $max = 50) {
    $s = (string)$s;
    if (mb_strlen($s) <= $max) return $s;
    return mb_substr($s, 0, $max - 1) . '…';
};

$rows = $xpath->query('(//table)[1]//tr');
if ($rows && $rows->length > 1) {
    // Определяем индексы столбцов по заголовку
    $header = $rows->item(0);
    $headerCells = $header ? ($header->getElementsByTagName('th')->length ? $header->getElementsByTagName('th') : $header->getElementsByTagName('td')) : null;
    $idxMap = ['name' => null, 'inv' => null, 'sn' => null, 'sum' => null, 'comment' => null, 'num' => null];
    if ($headerCells && $headerCells->length) {
        for ($i = 0; $i < $headerCells->length; $i++) {
            $txt = $normalize($headerCells->item($i)->textContent);
            if ($idxMap['num'] === null && ($txt === '№' || $contains($txt, '№'))) { $idxMap['num'] = $i; continue; }
            if ($idxMap['name'] === null && ($contains($txt, 'наимен') || $contains($txt, 'наименование'))) { $idxMap['name'] = $i; continue; }
            if ($idxMap['inv'] === null && ($contains($txt, 'инв'))) { $idxMap['inv'] = $i; continue; }
            if ($idxMap['sn'] === null && ($contains($txt, 'sn') || $contains($txt, 's.n') || $contains($txt, 'сер'))) { $idxMap['sn'] = $i; continue; }
            if ($idxMap['sum'] === null && ($contains($txt, 'сумм'))) { $idxMap['sum'] = $i; continue; }
            if ($idxMap['comment'] === null && ($contains($txt, 'коммент'))) { $idxMap['comment'] = $i; continue; }
        }
    }

    // Заполняем строки данными (до 6)
    for ($i = 0; $i < 6; $i++) {
        $rowIndex = 1 + $i; // 0 — заголовок
        if ($rowIndex >= $rows->length) break;
        $tr = $rows->item($rowIndex);
        if (!$tr) continue;
        $tds = $tr->getElementsByTagName('td');
        $item = isset($items[$i]) ? $items[$i] : null;
        if (!$tds || !$tds->length) continue;

        // Наименование (одна строка, усечение)
        if ($idxMap['name'] !== null && $idxMap['name'] < $tds->length) {
            $tds->item($idxMap['name'])->nodeValue = $item ? $truncate($item['name'] ?? '', 50) : '';
        }
        // Инв. номер
        if ($idxMap['inv'] !== null && $idxMap['inv'] < $tds->length) {
            $tds->item($idxMap['inv'])->nodeValue = $item ? (string)($item['otherserial'] ?? '') : '';
        }
        // Серийный номер
        if ($idxMap['sn'] !== null && $idxMap['sn'] < $tds->length) {
            $tds->item($idxMap['sn'])->nodeValue = $item ? (string)($item['serial'] ?? '') : '';
        }
        // Особые правила для шаблона sale: Сумма пусто, Комментарий = инв. номер
        $isSale = (mb_strpos(mb_strtolower(basename($tplPath)), 'sale') === 0);
        if ($isSale) {
            if ($idxMap['sum'] !== null && $idxMap['sum'] < $tds->length) {
                $tds->item($idxMap['sum'])->nodeValue = '';
            }
            if ($idxMap['comment'] !== null && $idxMap['comment'] < $tds->length) {
                $tds->item($idxMap['comment'])->nodeValue = $item ? (string)($item['otherserial'] ?? '') : '';
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

// Добавляем минимальные рекомендации для печати (убрать поля страницы)
$printCss = "<style>@page{size:A4;margin:0}body{margin:0}</style>";
echo json_encode(['success' => true, 'html' => $printCss . $finalHtml, 'title' => $title]);

?>


