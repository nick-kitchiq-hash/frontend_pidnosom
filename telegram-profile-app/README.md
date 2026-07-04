# Профіль — Telegram Mini App

Готовий фронтенд для міні-застосунку профілю бота: ім'я користувача, список
маршрутів (з розгортанням дій) і статистика з динамічною діаграмою.

## Що всередині

```
telegram-profile-app/
├── index.html      # розмітка (без жодних "зашитих" даних)
├── style.css        # теми Telegram (--tg-theme-*) + запасна темна палітра
├── app.js           # весь стан, рендер і логіка
├── icons/            # ваш набір іконок (+ play.svg / undo.svg, додані під стиль)
└── README.md
```

Відкрийте `index.html` у будь-якому браузері — застосунок працює і поза
Telegram (на тестових даних), оскільки всі виклики Telegram WebApp API
обгорнуті перевіркою `if (tg) {...}`.

## Дані — все у вигляді об'єктів, нічого не "заверстано"

У `app.js`, розділ **3. DATA**, весь профіль, маршрути й статистика — це один
масив `routes: [...]`. Все інше рахується від нього:

- лічильник "Пройдено маршрутів" = `routes.filter(r => r.completed).length`
- "Відвідано міст" = унікальні міста серед пройдених маршрутів
- стовпчикова діаграма = пройдені маршрути, згруповані по місяцю
  завершення (`completedDate`)

Тобто досить підмінити вміст `routes`/`profile` — і лічильники, списки та
діаграма самі перерахуються. Жодних окремих "захардкоджених" чисел немає.

### Підключення реальних даних

Замініть `getMockData()` на запит до вашого бекенду в `loadProfileData()`:

```js
CONFIG.USE_MOCK_DATA = false;
CONFIG.BACKEND_URL = "https://your-backend.example.com";
```

Очікується ендпоінт `GET /api/webapp/profile`, який поверне JSON у такому ж
форматі, що й `getMockData()` (поля `profile` і `routes`). Для перевірки
запиту на бекенді передавайте `initData` (див. нижче).

## Формат кожного маршруту

```js
{
  id: "golden-gates",          // унікальний ідентифікатор
  name: "Загадки Золотих воріт",
  city: "Київ",
  completed: false,             // false → 3 кнопки, true → одна "Повторити"
  type: "standard",             // "standard" (замок) або "gift" (коробка) — тільки для НЕ пройдених
  completedDate: "2026-05-16"   // потрібно лише коли completed: true (YYYY-MM-DD), для діаграми
}
```

## Команди, які застосунок надсилає боту

| Дія користувача | action           | payload                          |
|---|---|---|
| «Розпочати» | `start_route`     | `{ route }` |
| «Подарувати» → підтвердити | `donate`        | `{ route, address }` |
| «Повернути» → підтвердити | `return_route`   | `{ route }` |
| «Повторити» (пройдений маршрут) | `repeat_route`  | `{ route }` |
| Зберегти нове ім'я | `update_name`    | `{ name }` |

**Важливо:** поле "адреса" в донаті зараз підписане як TON-гаманець
(`наприклад TON-гаманець`) — це припущення, оскільки в ТЗ сказано лише
"ввести адресу користувача". Якщо мається на увазі щось інше (поштова
адреса, юзернейм тощо) — просто зміните `placeholder` в `index.html`
(`#donateAddressInput`) і підпис не вплине на логіку.

## Як команди доходять до бота — два способи

Telegram підтримує `WebApp.sendData()`, **але вона працює лише тоді, коли
міні-застосунок відкритий через клавіатурну кнопку типу `web_app`**. Якщо
застосунок відкривається через кнопку меню (значок біля поля вводу),
inline-кнопку або пряме посилання — `sendData` не спрацює, і потрібен свій
бекенд. Це офіційне обмеження Telegram, не помилка коду.

`app.js` вже вміє обидва варіанти (`sendCommand()` в розділі 11):
якщо задано `CONFIG.BACKEND_URL` — шле `POST` на ваш сервер; інакше
пробує `tg.sendData()`.

### Варіант А — клавіатурна кнопка + `sendData` (найпростіше, без бекенду)

```python
# aiogram 3
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, WebAppInfo

kb = ReplyKeyboardMarkup(keyboard=[[
    KeyboardButton(text="Профіль", web_app=WebAppInfo(url="https://your-domain.example/index.html"))
]], resize_keyboard=True)

@dp.message(F.web_app_data)
async def on_webapp_data(message: Message):
    import json
    data = json.loads(message.web_app_data.data)
    action = data.get("action")
    if action == "start_route":
        ...
    elif action == "donate":
        ...
    elif action == "return_route":
        ...
```

### Варіант Б — меню/inline-кнопка + власний бекенд (рекомендовано для продакшену)

Меню-кнопка виглядає природніше для розділу "Профіль", але вимагає
перевірки `initData` на сервері (щоб бути впевненим, що запит справді від
Telegram, а не підробка):

```python
# FastAPI, перевірка підпису initData
import hashlib, hmac
from urllib.parse import parse_qsl

BOT_TOKEN = "..."

def verify_init_data(init_data: str) -> dict:
    parsed = dict(parse_qsl(init_data))
    hash_ = parsed.pop("hash")
    check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
    secret_key = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    calculated = hmac.new(secret_key, check_string.encode(), hashlib.sha256).hexdigest()
    if calculated != hash_:
        raise ValueError("Invalid initData")
    return parsed

@app.post("/api/webapp/action")
async def webapp_action(request: Request):
    init_data = request.headers.get("X-Telegram-Init-Data", "")
    verify_init_data(init_data)          # кине помилку, якщо запит підроблений
    body = await request.json()
    action = body.get("action")
    # ... обробіть дію, за потреби надішліть повідомлення користувачу через Bot API
    return {"ok": True}
```

Після успішної дії бот сам надсилає користувачу підтвердження в чат
(`bot.send_message(...)`), а міні-застосунок просто закривається/показує
toast — так працює переважна більшість продакшн-ботів із Mini Apps.

## Налаштування в BotFather

1. `/newapp` (або через існуючого бота: `/mybots` → ваш бот → Bot Settings →
   Menu Button / Configure Mini App).
2. Вкажіть HTTPS-посилання на розміщений `index.html` (GitHub Pages,
   Vercel, Cloudflare Pages, ваш сервер тощо — обов'язково HTTPS).
3. Якщо хочете відкриття через кнопку меню — `/setmenubutton`.
4. Якщо хочете `sendData` без бекенду — додайте клавіатурну кнопку
   `web_app` (варіант А вище).

## Тема оформлення

Кольори не зашиті напряму — `style.css` бере їх з
`var(--tg-theme-*, запасне_значення)`, тобто застосунок автоматично
підлаштовується під тему користувача (світлу/темну/кастомну). Запасні
значення підібрані піпеткою з ваших скріншотів (`#24303f` картки,
`#313b43` фон, `#4be1ab` акцент) — саме їх ви побачите поза Telegram.

## Іконки

Усі іконки з вашого `icons_profile.zip` використані як CSS-маски
(`background-color: currentColor` + `mask-image`), тому автоматично
перефарбовуються під тему без окремих файлів для світлої/темної версії.
Два додані власноруч, у тому ж стилі обведення: `play.svg` (Розпочати /
Повторити) і `undo.svg` (Повернути). `box.svg` повторно використаний для
кнопки "Подарувати" (сама іконка коробки/подарунка добре пасує за змістом).

## Інші припущення (позначені, щоб ви могли легко змінити)

- "Не пройдені" маршрути мають два підтипи для іконки: `standard` (замок) і
  `gift` (коробка) — сама кнопкова логіка (3 кнопки) від типу не залежить,
  це суто візуальне розрізнення "звичайний" / "отриманий у подарунок"
  маршрут.
- Підтвердження "Повернути" зроблене на весь екран за зразком екрана
  BotFather "Transfer Ownership", з чекбоксом-підтвердженням перед
  активацією кнопки — для додаткового захисту від випадкового натискання.
- Список "Мої маршрути" показує спершу 3 елементи з кнопкою "Показати
  більше"; можна змінити через `CONFIG.ROUTES_PREVIEW_COUNT`.
