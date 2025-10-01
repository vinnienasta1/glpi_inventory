# Инструкция по загрузке плагина на GitHub

## Репозиторий
🔗 **GitHub:** https://github.com/vinnienasta1/glpi_inventory

## Способ 1: Через веб-интерфейс GitHub (рекомендуется)

### Шаг 1: Подготовка файлов
Все файлы готовы для загрузки в папке `D:\GLPI plugin\`

### Шаг 2: Загрузка через веб-интерфейс
1. Перейдите на https://github.com/vinnienasta1/glpi_inventory
2. Нажмите кнопку **"uploading an existing file"** или **"Add file" → "Upload files"**
3. Перетащите все файлы и папки из `D:\GLPI plugin\` в область загрузки

### Структура файлов для загрузки:
```
/
├── ajax/
│   └── search.php
├── css/
│   └── inventory.css
├── front/
│   └── inventory.php
├── inc/
│   └── inventory.class.php
├── js/
│   └── inventory.js
├── locales/
│   ├── en_US.po
│   └── ru_RU.po
├── .gitignore
├── CHANGELOG.md
├── INSTALL.md
├── LICENSE
├── README.md
└── setup.php
```

### Шаг 3: Коммит изменений
1. Внизу страницы добавьте описание коммита:
   - **Commit title:** `Initial release v1.0.0 - GLPI Inventory Plugin`
   - **Description:** 
     ```
     Добавлен плагин "Инвенторизация" для GLPI
     
     Функционал:
     - Поиск оборудования по инвентарным номерам
     - AJAX интерфейс
     - Поддержка компьютеров, мониторов, периферии
     - Многоязычность (RU/EN)
     - Адаптивный дизайн
     ```
2. Выберите **"Commit directly to the main branch"**
3. Нажмите **"Commit changes"**

## Способ 2: Через Git CLI (если установлен)

```bash
cd "D:\GLPI plugin"
git init
git add .
git commit -m "Initial release v1.0.0 - GLPI Inventory Plugin"
git branch -M main
git remote add origin https://github.com/vinnienasta1/glpi_inventory.git
git push -u origin main
```

## Способ 3: Через GitHub Desktop

1. Установите GitHub Desktop
2. Нажмите **"Clone a repository from the Internet"**
3. Введите URL: `https://github.com/vinnienasta1/glpi_inventory`
4. Скопируйте все файлы в склонированную папку
5. В GitHub Desktop сделайте коммит и push

## После загрузки

1. Перейдите на https://github.com/vinnienasta1/glpi_inventory
2. Убедитесь, что все файлы загружены корректно
3. Проверьте отображение README.md
4. При необходимости создайте Release с тегом v1.0.0

## Создание Release

1. В репозитории перейдите во вкладку **"Releases"**
2. Нажмите **"Create a new release"**
3. Заполните:
   - **Tag version:** `v1.0.0`
   - **Release title:** `GLPI Inventory Plugin v1.0.0`
   - **Description:** Используйте содержимое из CHANGELOG.md
4. Нажмите **"Publish release"**

## Настройка репозитория

После загрузки рекомендуется:
1. Добавить топики (topics): `glpi`, `plugin`, `inventory`, `php`, `javascript`
2. Установить описание репозитория: "Plugin for GLPI to search equipment by inventory numbers"
3. Добавить ссылку на сайт GLPI: https://glpi-project.org/
