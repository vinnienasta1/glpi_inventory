<?php
/**
 * AJAX: анализ XLSX шаблонов для извлечения плейсхолдеров и координат
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

$pluginDir = realpath(__DIR__ . '/..');
$templatesDir = realpath($pluginDir . DIRECTORY_SEPARATOR . 'templates');

if ($templatesDir === false || !is_dir($templatesDir)) {
    echo json_encode(['success' => false, 'error' => 'Каталог шаблонов не найден']);
    exit;
}

$only = isset($_GET['name']) ? basename($_GET['name']) : null;

$files = [];
if ($only) {
    $path = $templatesDir . DIRECTORY_SEPARATOR . $only;
    if (is_file($path) && preg_match('/\.xlsx$/i', $only)) {
        $files[] = $only;
    }
} else {
    foreach (scandir($templatesDir) as $f) {
        if ($f === '.' || $f === '..') continue;
        if (is_file($templatesDir . DIRECTORY_SEPARATOR . $f) && preg_match('/\.xlsx$/i', $f)) {
            $files[] = $f;
        }
    }
}

$result = [];

foreach ($files as $f) {
    $filePath = $templatesDir . DIRECTORY_SEPARATOR . $f;
    $report = [
        'name' => $f,
        'placeholders' => [] // [ [sheet => 'sheet1', cell => 'A1', text => '{{...}}'], ... ]
    ];
    $za = new ZipArchive();
    if ($za->open($filePath) === true) {
        // Считываем sharedStrings, чтобы получить строки
        $sharedStrings = [];
        $ssIndex = $za->locateName('xl/sharedStrings.xml', ZipArchive::FL_NODIR);
        if ($ssIndex !== false) {
            $xml = $za->getFromIndex($ssIndex);
            if ($xml !== false) {
                // Простой разбор: вытаскиваем t-теги
                if (preg_match_all('/<t[^>]*>(.*?)<\/t>/s', $xml, $m)) {
                    foreach ($m[1] as $idx => $txt) {
                        // Декодируем XML сущности
                        $txt = html_entity_decode(strip_tags($txt), ENT_QUOTES | ENT_XML1, 'UTF-8');
                        $sharedStrings[$idx] = $txt;
                    }
                }
            }
        }

        // Перебираем листы
        for ($i = 1; $i < 50; $i++) {
            $sheetName = 'xl/worksheets/sheet' . $i . '.xml';
            $idx = $za->locateName($sheetName, ZipArchive::FL_NODIR);
            if ($idx === false) {
                if ($i > 10) break; // вероятно листов меньше
                continue;
            }
            $sheetXml = $za->getFromIndex($idx);
            if ($sheetXml === false) continue;

            // Ищем ячейки со строковым типом (t="s") и значением v (индекс sharedStrings)
            if (preg_match_all('/<c[^>]*r=\"([A-Z0-9]+)\"[^>]*?(t=\"s\")[^>]*>\s*<v>(\d+)<\/v>\s*<\/c>/s', $sheetXml, $mm, PREG_SET_ORDER)) {
                foreach ($mm as $cell) {
                    $ref = $cell[1];
                    $ssIdx = (int)$cell[3];
                    $text = isset($sharedStrings[$ssIdx]) ? $sharedStrings[$ssIdx] : '';
                    if (preg_match_all('/\{\{[^}]+\}\}/', $text, $ph)) {
                        foreach ($ph[0] as $phv) {
                            $report['placeholders'][] = [
                                'sheet' => 'sheet' . $i,
                                'cell' => $ref,
                                'text' => $phv,
                                'full' => $text
                            ];
                        }
                    }
                }
            }
        }
        $za->close();
    }
    $result[] = $report;
}

echo json_encode(['success' => true, 'reports' => $result]);

?>


