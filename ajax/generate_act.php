<?php
/**
 * Генерация актов на сервере с сохранением стилей шаблона XLSX.
 * Вход (POST JSON):
 * {
 *   "template": "giveing.xlsx|return.xlsx|sale.xlsx",
 *   "items": [ { name, otherserial, serial, user_name }, ... ], // берём первые 6
 *   "issuer_name": "...",  // ФИО выдающего (GLPI)
 *   "user_name": "..."     // ФИО пользователя (из буфера)
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

// Читаем входные данные
$input = json_decode(file_get_contents('php://input'), true);
if (!$input || empty($input['template'])) {
    echo json_encode(['success' => false, 'error' => 'Некорректные данные']);
    exit;
}

$template = basename($input['template']);
$items = isset($input['items']) && is_array($input['items']) ? $input['items'] : [];
$issuerName = isset($input['issuer_name']) ? (string)$input['issuer_name'] : '';
$userName = isset($input['user_name']) ? (string)$input['user_name'] : '';

// Папка шаблонов
$pluginDir = realpath(__DIR__ . '/..');
$templatesDir = realpath($pluginDir . DIRECTORY_SEPARATOR . 'templates');
if ($templatesDir === false) {
    echo json_encode(['success' => false, 'error' => 'Каталог шаблонов не найден']);
    exit;
}

$tplPath = realpath($templatesDir . DIRECTORY_SEPARATOR . $template);
if ($tplPath === false || strpos($tplPath, $templatesDir) !== 0 || !preg_match('/\.xlsx$/i', $tplPath)) {
    echo json_encode(['success' => false, 'error' => 'Шаблон не найден']);
    exit;
}

// Готовим временную копию
$tmpFile = tempnam(sys_get_temp_dir(), 'act_');
if ($tmpFile === false) {
    echo json_encode(['success' => false, 'error' => 'Не удалось создать временный файл']);
    exit;
}
@unlink($tmpFile);
$tmpFile .= '.xlsx';
if (!copy($tplPath, $tmpFile)) {
    echo json_encode(['success' => false, 'error' => 'Не удалось скопировать шаблон']);
    exit;
}

// Координаты для заполнения
$mapRows = [
    'name' => ['col' => 'C', 'start' => 6, 'end' => 11],
    'otherserial' => ['col' => 'G', 'start' => 6, 'end' => 11],
    'serial' => ['col' => 'I', 'start' => 6, 'end' => 11],
];

$signCells = [];
$low = strtolower($template);
if (strpos($low, 'giveing') === 0) {
    $signCells = ['issuer' => 'B26', 'user' => 'B28'];
} elseif (strpos($low, 'return') === 0) {
    $signCells = ['issuer' => 'B34', 'user' => 'B36'];
} elseif (strpos($low, 'sale') === 0) {
    $signCells = ['issuer' => 'B32', 'user' => 'B34'];
}

// Вспомогательные функции
function xml_escape_text($text) {
    return htmlspecialchars($text ?? '', ENT_QUOTES | ENT_XML1, 'UTF-8');
}

function replace_cell_inline(&$xml, $cellRef, $value) {
    // Меняем содержимое ячейки на inlineStr, сохранив атрибуты/стили
    $escaped = xml_escape_text($value);
    $pattern = '/<c([^>]*)\br=\"' . preg_quote($cellRef, '/') . '\"([^>]*)>([\s\S]*?)<\/c>/';
    $xml = preg_replace_callback($pattern, function ($m) use ($escaped) {
        $attrs = $m[1] . $m[2];
        // Удаляем существующие t="...", и добавим t="inlineStr"
        $attrsOut = preg_replace('/\s+t=\"[^\"]*\"/i', '', $attrs);
        $attrsOut .= ' t="inlineStr"';
        // Сохраняем существующий s= стиль
        // Внутренности ячейки заменяем на <is><t>...</t></is>
        return '<c' . $attrsOut . '><is><t>' . $escaped . '</t></is></c>';
    }, $xml, 1); // только первое совпадение
}

$zip = new ZipArchive();
if ($zip->open($tmpFile) !== true) {
    echo json_encode(['success' => false, 'error' => 'Не удалось открыть временный XLSX']);
    exit;
}

$desiredSheetName = 'Лист1';

// Определяем фактический путь к первому листу (или к листу по имени)
$workbookPath = 'xl/workbook.xml';
$relsPath = 'xl/_rels/workbook.xml.rels';
$sheetPath = null;

$workbookXml = $zip->getFromName($workbookPath);
if ($workbookXml !== false) {
    // Собираем список листов: name + r:id + sheetId + order
    $sheets = [];
    if (preg_match_all('/<sheet[^>]*name=\"([^\"]+)\"[^>]*r:id=\"([^\"]+)\"[^>]*>/i', $workbookXml, $mm, PREG_SET_ORDER)) {
        foreach ($mm as $i => $m) {
            $sheets[] = [
                'name' => $m[1],
                'rid' => $m[2],
                'order' => $i
            ];
        }
    }

    // Разрешаем выбор по имени (Лист1) или берём первый
    $targetRid = null;
    foreach ($sheets as $s) {
        if ($s['name'] === $desiredSheetName) { $targetRid = $s['rid']; break; }
    }
    if ($targetRid === null && !empty($sheets)) {
        $targetRid = $sheets[0]['rid'];
    }

    // Находим Target по rId
    if ($targetRid) {
        $relsXml = $zip->getFromName($relsPath);
        if ($relsXml !== false && preg_match('/<Relationship[^>]*Id=\"'.preg_quote($targetRid,'/').'\"[^>]*Target=\"([^\"]+)\"/i', $relsXml, $rm)) {
            $target = $rm[1]; // например, worksheets/sheet1.xml
            $candidate = 'xl/' . ltrim($target, '/');
            if ($zip->locateName($candidate, ZipArchive::FL_NODIR) !== false) {
                $sheetPath = $candidate;
            }
        }
    }
}

// Fallback: первый xml в xl/worksheets/
if ($sheetPath === null) {
    // Перебор всех файлов в архиве и выбор первого листа из xl/worksheets/
    $candidates = [];
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $name = $zip->getNameIndex($i);
        if (preg_match('#^xl/worksheets/[^/]+\.xml$#i', $name)) {
            $candidates[] = $name;
        }
    }
    if (!empty($candidates)) {
        sort($candidates, SORT_STRING);
        $sheetPath = $candidates[0];
    }
}

if ($sheetPath === null) {
    $zip->close();
    echo json_encode(['success' => false, 'error' => 'Лист не найден']);
    exit;
}

$idx = $zip->locateName($sheetPath, ZipArchive::FL_NODIR);
$sheetXml = $zip->getFromIndex($idx);
if ($sheetXml === false) {
    $zip->close();
    echo json_encode(['success' => false, 'error' => 'Не удалось прочитать worksheet']);
    exit;
}

// Если ФИО выдающего не передано с клиента, берём из сессии GLPI
if ($issuerName === '') {
    $uid = Session::getLoginUserID();
    if ($uid) {
        $u = new User();
        if ($u->getFromDB($uid)) {
            $issuerName = trim(($u->fields['realname'] ?? '') . ' ' . ($u->fields['firstname'] ?? ''));
        }
    }
}

// Заполнение строк (первые 6 позиций)
for ($i = 0; $i < 6; $i++) {
    $row = $mapRows['name']['start'] + $i;
    $item = isset($items[$i]) ? $items[$i] : null;
    $nameVal = $item ? (string)($item['name'] ?? '') : '';
    $invVal = $item ? (string)($item['otherserial'] ?? '') : '';
    $serialVal = $item ? (string)($item['serial'] ?? '') : '';
    replace_cell_inline($sheetXml, $mapRows['name']['col'] . $row, $nameVal);
    replace_cell_inline($sheetXml, $mapRows['otherserial']['col'] . $row, $invVal);
    replace_cell_inline($sheetXml, $mapRows['serial']['col'] . $row, $serialVal);
}

// Подписи
if (!empty($signCells['issuer'])) {
    replace_cell_inline($sheetXml, $signCells['issuer'], $issuerName);
}
if (!empty($signCells['user'])) {
    replace_cell_inline($sheetXml, $signCells['user'], $userName);
}

// Сохраняем обратно в архив
if (!$zip->addFromString($sheetPath, $sheetXml)) {
    $zip->close();
    echo json_encode(['success' => false, 'error' => 'Не удалось записать worksheet']);
    exit;
}

$zip->close();

$content = file_get_contents($tmpFile);
@unlink($tmpFile);

$outName = 'Акт_' . date('Y-m-d') . '.xlsx';
if (strpos($low, 'giveing') === 0) $outName = 'Акт_Выдачи_' . date('Y-m-d') . '.xlsx';
elseif (strpos($low, 'return') === 0) $outName = 'Акт_Возврата_' . date('Y-m-d') . '.xlsx';
elseif (strpos($low, 'sale') === 0) $outName = 'Акт_Выкупа_' . date('Y-m-d') . '.xlsx';

echo json_encode([
    'success' => true,
    'filename' => $outName,
    'content_base64' => base64_encode($content)
]);

?>


