# Авторизация taxi — отдельный React frontend

Самостоятельный React + TypeScript проект, в который вынесен существующий контур авторизации и регистрации из `taxi`. Модуль не импортирует код taxi и может подключаться к другим приложениям через `AuthService`, `AuthStore` или `AuthProvider`.

## Что перенесено

- двухшаговый вход через `POST /auth` → `POST /token`;
- вход по email или телефону и обработка ответов `wrong login`, `wrong password`, `wrong phone`, `code sent`;
- восстановление пароля через `POST /remind`;
- регистрация клиента и водителя через `POST /register`;
- промокод и его проверка через `GET /referral/code/:code/check`;
- поля водителя, документы и загрузка файлов через `POST /dropbox/file`;
- сохранение водительских деталей через `POST /user`;
- создание автомобиля через `POST /car` и настройка лицензии через `POST /car/:id`;
- восстановление пользователя через `POST /user/authorized`;
- хранение пары `token` + `u_hash` и выход через `POST /logout`;
- демо-интерфейс для всех перечисленных сценариев и mock-режим без production API.

Google и WhatsApp намеренно не включены по согласованному ТЗ. Бизнес-страницы поездок, заказы, карты и обратное внедрение в taxi также не входят в этот репозиторий.

## Запуск

Требуется Node.js 20+.

```bash
cp .env.example .env
npm install
npm run dev
```

Проверки:

```bash
npm test
npm run build
```

В mock-режиме вход выполняется с `demo@example.com` / `demo`. Существующий backend taxi не принимает пароль при регистрации: он создаёт его сам и возвращает в `string`, когда регистрация выполняется без email. Поэтому поле создания пароля в форме регистрации отсутствует намеренно.

## Подключение к backend

```env
VITE_AUTH_API_URL=https://host.example/taxi/c/default/api/v1
VITE_USE_MOCK_AUTH=false

# Параметры нужны для сохранения поведения регистрации водителя из taxi.
VITE_DRIVER_PHONE_PREFIX=34
VITE_DEFAULT_COUNTRY=GHA
VITE_DEFAULT_LOCATION_CLASS_ID=5
```

Backend должен разрешать origin нового frontend через CORS. Параметры телефона, страны и класса локации берутся из `site_constants` исходного приложения; для отдельного проекта они передаются конфигурацией.

```tsx
import { AuthProvider, createAuthClient } from './auth'

const client = createAuthClient({
  baseUrl: import.meta.env.VITE_AUTH_API_URL,
  driverPhonePrefix: '34',
  defaultCountry: 'GHA',
  defaultLocationClassId: '5',
})

root.render(
  <AuthProvider client={client}>
    <App />
  </AuthProvider>,
)
```

В компоненте доступны все операции:

```tsx
const {
  state,
  login,
  register,
  remindPassword,
  checkReferralCode,
  logout,
} = useAuth()
```

`RegisterRequest` допускает дополнительные поля, поэтому server-driven форма `form_register` из taxi может передавать свой набор значений без изменения клиента.

## Регистрация водителя

Одна операция `register()` выполняет исходный pipeline:

1. создаёт пользователя;
2. сохраняет `token` и `u_hash`;
3. загружает `passport_photo`, `driver_license_photo` и `license_photo`;
4. записывает ID файлов и `u_details` в профиль;
5. создаёт автомобиль;
6. при наличии страны и класса локации назначает стандартную лицензию;
7. получает актуального авторизованного пользователя.

Модель, цвет и класс автомобиля в исходном taxi приходят из runtime-данных. Демо принимает их ID напрямую, а продуктовый интерфейс может подставить свои `select` без изменения auth-модуля.

## Архитектура

- `src/auth/client.ts` — API и полный auth/register pipeline;
- `src/auth/store.ts` — состояние без Redux и saga;
- `src/auth/context.tsx` — React Provider и hook;
- `src/auth/storage.ts` — заменяемое хранилище токенов;
- `src/auth/formData.ts` — совместимый legacy-формат `u_details`;
- `src/auth/mock.ts` — автономный mock;
- `src/App.tsx` — демонстрационный UI.

Для production безопаснее заменить `localStorage` на HttpOnly cookie, выдаваемую сервером. Интерфейс `TokenStorage` позволяет сделать это без переписывания компонентов.
