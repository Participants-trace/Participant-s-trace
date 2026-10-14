# След участника

Статический интерактивный дашборд влияния программ «Таврида.АРТ» на профессиональную и творческую траекторию участников.

## Локальный запуск

В корне проекта:

```bash
python3 -m http.server 8000
```

Затем открыть `http://localhost:8000`.

## Подготовка папки `dist`

После изменения `index.html`, `styles.css`, `dashboard.js`, данных или иконок:

```bash
python3 scripts/build_site.py
```

Команда копирует готовые статические файлы в `dist`. Именно эта папка публикуется на GitHub Pages.

## Публикация на GitHub Pages

1. Создать пустой репозиторий на GitHub.
2. Привязать его к локальному проекту:

   ```bash
   git remote set-url origin https://github.com/OWNER/REPOSITORY.git
   ```

3. Подготовить и отправить изменения:

   ```bash
   python3 scripts/build_site.py
   git add .
   git commit -m "Prepare dashboard for GitHub Pages"
   git push -u origin main
   ```

4. В репозитории GitHub открыть **Settings → Pages** и в качестве источника выбрать **GitHub Actions**.

После каждого push в `main` workflow `.github/workflows/pages.yml` опубликует содержимое `dist`.
