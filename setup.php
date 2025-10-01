<?php
/**
 * Plugin Inventory для GLPI
 * 
 * Данный плагин реализует функционал поиска оборудования по инвентарным номерам
 * 
 * @version 2.0.0
 * @author Ваше имя
 */

define('PLUGIN_INVENTORY_VERSION', '2.0.0');

/**
 * Инициализация плагина
 */
function plugin_init_inventory() {
    global $PLUGIN_HOOKS;
    
    $PLUGIN_HOOKS['csrf_compliant']['inventory'] = true;
    
    // Добавляем пункт меню
    $PLUGIN_HOOKS['menu_toadd']['inventory'] = ['tools' => 'PluginInventoryInventory'];
    
    // Регистрируем класс
    Plugin::registerClass('PluginInventoryInventory');
}

/**
 * Получение информации о плагине
 */
function plugin_version_inventory() {
    return [
        'name' => 'Инвенторизация',
        'version' => PLUGIN_INVENTORY_VERSION,
        'author' => 'Ваше имя',
        'license' => 'GPL v3+',
        'homepage' => '',
        'requirements' => [
            'glpi' => [
                'min' => '10.0.0',
            ]
        ]
    ];
}

/**
 * Проверка предварительных требований для установки плагина
 */
function plugin_inventory_check_prerequisites() {
    if (version_compare(GLPI_VERSION, '10.0.0', 'lt')) {
        echo "Данный плагин требует GLPI >= 10.0.0";
        return false;
    }
    return true;
}

/**
 * Проверка конфигурации для работы плагина
 */
function plugin_inventory_check_config() {
    return true;
}

/**
 * Установка плагина
 */
function plugin_inventory_install() {
    return true;
}

/**
 * Удаление плагина
 */
function plugin_inventory_uninstall() {
    return true;
}
