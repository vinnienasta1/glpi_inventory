<?php
/**
 * AJAX: список и получение шаблонов актов (XLSX)
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

// Доступ только авторизованным
Session::checkLoginUser();

header('Content-Type: application/json; charset=utf-8');

$action = isset($_GET['action']) ? $_GET['action'] : 'list';

// Путь к каталогу шаблонов внутри плагина
$pluginDir = realpath(__DIR__ . '/..'); // ajax/.. => корень плагина
$templatesDir = realpath($pluginDir . DIRECTORY_SEPARATOR . 'templates');

if ($templatesDir === false || !is_dir($templatesDir)) {
    echo json_encode(['success' => false, 'error' => 'Каталог шаблонов не найден']);
    exit;
}

switch ($action) {
    case 'list':
        $files = scandir($templatesDir);
        $list = [];
        foreach ($files as $f) {
            if ($f === '.' || $f === '..') continue;
            $path = $templatesDir . DIRECTORY_SEPARATOR . $f;
            if (is_file($path) && preg_match('/\.xlsx$/i', $f)) {
                $list[] = [
                    'name' => $f,
                    'size' => filesize($path)
                ];
            }
        }
        echo json_encode(['success' => true, 'templates' => $list]);
        break;

    case 'get':
        $name = isset($_GET['name']) ? $_GET['name'] : '';
        $base = basename($name);
        if ($base !== $name) {
            echo json_encode(['success' => false, 'error' => 'Некорректное имя файла']);
            exit;
        }
        $filePath = realpath($templatesDir . DIRECTORY_SEPARATOR . $base);
        if ($filePath === false || strpos($filePath, $templatesDir) !== 0 || !is_file($filePath)) {
            echo json_encode(['success' => false, 'error' => 'Файл не найден']);
            exit;
        }
        if (!preg_match('/\.xlsx$/i', $filePath)) {
            echo json_encode(['success' => false, 'error' => 'Неподдерживаемый формат']);
            exit;
        }
        $content = file_get_contents($filePath);
        if ($content === false) {
            echo json_encode(['success' => false, 'error' => 'Ошибка чтения файла']);
            exit;
        }
        echo json_encode([
            'success' => true,
            'name' => $base,
            'content_base64' => base64_encode($content)
        ]);
        break;

    default:
        echo json_encode(['success' => false, 'error' => 'Неизвестное действие']);
}

?>


