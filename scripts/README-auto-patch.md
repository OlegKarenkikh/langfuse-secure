# auto-patch.js — автоматическое исправление уязвимостей

## Как это работает

```
Trivy scan (CI)
    └── trivy-web.json / trivy-worker.json
            └── auto-patch.js
                    ├── version-patch.js  (version-field patch)
                    └── patch-all.js      (binary copy patch)
                            └── git commit → PR → merge → rebuild
```

### Workflow `auto-fix.yml`

Запускается автоматически после `Build & CVE Scan` **при условии провала** (Gate exit-code 1):

1. Скачивает JSON-артефакты Trivy из упавшего прогона
2. Запускает `node scripts/auto-patch.js trivy-web.json trivy-worker.json`
3. Если скрипт нашёл новые патчи (exit code 2) — создаёт ветку `auto-fix/YYYY-MM-DD-<run_id>` и открывает PR в `main`
4. После merge CI пересобирает образы с новыми патчами

### Ограничения

| Ситуация | Поведение |
|---|---|
| CVE без `FixedVersion` в Trivy | Пропускается, PR не создаётся по этому пакету |
| Несколько major-версий в `FixedVersion` | Выбирается та, что совпадает по major с installed |
| Пакет уже покрыт >= нужной версии | Не перезаписывается |
| Бинарный патч невозможен (нет источника в образе) | Применяется только version-field patch |

### Ручной запуск

```bash
# Скачать артефакты из GitHub Actions, затем:
node scripts/auto-patch.js trivy-web.json trivy-worker.json
```

### Exit codes

| Code | Значение |
|---|---|
| 0 | Нет новых патчей |
| 1 | Ошибка (нет аргументов / невалидный JSON) |
| 2 | Патчи записаны, нужен rebuild |
