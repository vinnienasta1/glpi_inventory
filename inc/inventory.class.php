<?php
/**
 * Главный класс плагина Inventory
 */
class PluginInventoryInventory extends CommonGLPI {
    
    static $rightname = 'plugin_inventory';
    
    static function getTypeName($nb = 0) {
        return _n('Инвенторизация', 'Инвенторизация', $nb, 'inventory');
    }
    
    static function getMenuName() {
        return self::getTypeName();
    }
    
    static function getMenuContent() {
        $menu = [
            'title' => self::getMenuName(),
            'page' => '/plugins/inventory/front/inventory.php',
            'icon' => 'fas fa-search'
        ];
        return $menu;
    }
    
    function getTabNameForItem(CommonGLPI $item, $withtemplate = 0) {
        return self::getTypeName();
    }
    
    static function displayTabContentForItem(CommonGLPI $item, $tabnum = 1, $withtemplate = 0) {
        return true;
    }
    
    /**
     * Поиск оборудования по инвентарному номеру
     * 
     * @param string $serial Инвентарный номер для поиска
     * @return array Массив найденных элементов
     */
    static function searchBySerial($serial) {
        global $DB;
        
        $items = [];
        $types = ['Computer', 'Monitor', 'Peripheral'];
        $limit = 50; // ограничиваем количество результатов на тип для производительности
        
        foreach ($types as $type) {
            $table = 'glpi_' . strtolower($type) . 's';
            
            $iterator = $DB->request([
                'SELECT' => ['id', 'name', 'otherserial', 'serial', 'contact', 'groups_id', 'states_id', 'locations_id', 'users_id', 'comment'],
                'FROM' => $table,
                'WHERE' => [
                    'is_deleted' => 0,
                    'OR' => [
                        'otherserial' => ['LIKE', '%' . $DB->escape($serial) . '%'],
                        'serial' => ['LIKE', '%' . $DB->escape($serial) . '%']
                    ]
                ],
                'ORDER' => 'id DESC',
                'LIMIT' => $limit
            ]);
            
            foreach ($iterator as $data) {
                $items[] = [
                    'type' => $type,
                    'data' => $data
                ];
            }
        }
        
        return $items;
    }
    
    /**
     * Получение информации о связанных сущностях
     * 
     * @param array $item Данные элемента
     * @return array Расширенная информация
     */
    static function getExtendedInfo($item, $type = null) {
        global $DB;
        
        $extended = $item;
        
        // Попытка получить дополнительные поля напрямую из объекта GLPI
        if ($type && isset($item['id'])) {
            try {
                if (class_exists($type)) {
                    $obj = new $type();
                    if ($obj->getFromDB((int)$item['id'])) {
                        // Номер иммобилизации: пытаемся найти один из известных ключей
                        $imm = '';
                        if (isset($obj->fields['immobilization_number'])) {
                            $imm = (string)$obj->fields['immobilization_number'];
                        } else if (isset($obj->fields['immo_number'])) {
                            $imm = (string)$obj->fields['immo_number'];
                        } else if (isset($obj->fields['immobilizationnum'])) {
                            $imm = (string)$obj->fields['immobilizationnum'];
                        }
                        if ($imm !== '') {
                            $extended['immo_number'] = $imm;
                        }
                    }
                }
            } catch (Exception $e) {
                // безопасно игнорируем, оставляя поле пустым
            }
        }

        // Номер иммобилизации из glpi_infocoms (официальная таблица фин. информации)
        try {
            if ($type && isset($item['id'])) {
                $req = $DB->request([
                    'SELECT' => ['immo_number'],
                    'FROM'   => 'glpi_infocoms',
                    'WHERE'  => [
                        'items_id' => (int)$item['id'],
                        'itemtype' => (string)$type
                    ],
                    'LIMIT'  => 1
                ]);
                foreach ($req as $row) {
                    if (!empty($row['immo_number'])) {
                        $extended['immo_number'] = (string)$row['immo_number'];
                    }
                    break;
                }
            }
        } catch (Exception $e) {
            // игнорируем ошибки выборки
        }
        
        // Получаем информацию о группе (департаменте)
        if ($item['groups_id'] > 0) {
            $group = new Group();
            if ($group->getFromDB($item['groups_id'])) {
                $extended['group_name'] = $group->fields['name'];
            }
        }
        
        // Получаем информацию о состоянии
        if ($item['states_id'] > 0) {
            $state = new State();
            if ($state->getFromDB($item['states_id'])) {
                $extended['state_name'] = $state->fields['completename'];
            }
        }
        
        // Получаем информацию о местоположении
        if ($item['locations_id'] > 0) {
            $location = new Location();
            if ($location->getFromDB($item['locations_id'])) {
                $extended['location_name'] = $location->fields['completename'];
            }
        }
        
        // Получаем информацию о пользователе
        if ($item['users_id'] > 0) {
            $user = new User();
            if ($user->getFromDB($item['users_id'])) {
                $extended['user_name'] = trim($user->fields['realname'] . ' ' . $user->fields['firstname']);
            }
        }
        
        return $extended;
    }
}
