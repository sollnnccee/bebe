# Челлендж The Last of Us

Сайт журнала Игоря. Гости только смотрят, править можно после входа.

## Вход

Кнопка **Войти** справа сверху. Пароль задаётся в `.env` как `ADMIN_PASSWORD`.

Локально сейчас: `IgorTlou24` — после выкладки на сервер поставь свой в настройках хостинга.

## Запуск на компьютере

```bash
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Открой http://127.0.0.1:8000/

## Бесплатно в интернет — Render

1. Зарегистрируйся на [github.com](https://github.com) и залей эту папку в новый репозиторий.
2. Зайди на [render.com](https://render.com), войти через GitHub.
3. **New + → Web Service →** выбери репозиторий.
4. Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. В Environment добавь:
   - `ADMIN_PASSWORD` = свой пароль
   - `SECRET_KEY` = любой длинный случайный текст
   - `HTTPS` = `true`
6. Deploy. Render даст ссылку вида `https://....onrender.com`.

Бесплатный тариф засыпает без визитов: первый заход за день может открываться 30–60 секунд.

## Hugging Face Spaces

1. [huggingface.co/new-space](https://huggingface.co/new-space)
2. SDK: **Docker**, сделай Space публичным.
3. Залей файлы проекта (без папки `.venv`).
4. Settings → Variables: те же `ADMIN_PASSWORD`, `SECRET_KEY`, `HTTPS=true`.
