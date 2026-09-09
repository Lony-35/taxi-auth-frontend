# Переиспользуемая авторизация React + TypeScript

Отдельный frontend-проект, выделяющий базовые сценарии входа и регистрации из `taxi`. В первой версии намеренно нет Google, WhatsApp, водительских документов, автомобиля и внедрения обратно в исходное приложение.

## Что входит

- типизированный API-клиент для `/auth`, `/token`, `/register`, `/user/authorized`, `/logout`;
- настраиваемые `baseUrl`, пути endpoint'ов, `fetch` и сериализация `u_details`;
- безопасно изолированное хранение пары `token` + `u_hash`;
- независимый от Redux store с состояниями `idle/loading/authenticated/error`;
- `AuthProvider` и `useAuth()` для React-приложений;
- рабочий экран входа, регистрации и профиля;
- автономный mock-режим для демонстрации без обращения к production API;
- тесты протокола входа, ошибок API и хранилища.

## Быстрый запуск

Требуется Node.js 20+.

```bash
cp .env.example .env
npm install
npm run dev
```

По умолчанию `.env.example` включает mock-режим. В нём можно зарегистрировать любого пользователя или войти с `demo@example.com` / `demo`.

Проверки:

```bash
npm test
npm run build
```

## Подключение к реальному backend

1. Укажите `VITE_AUTH_API_URL`, например `https://host.example/taxi/c/default/api/v1`.
2. Установите `VITE_USE_MOCK_AUTH=false`.
3. Убедитесь, что backend разрешает origin нового приложения через CORS.
4. Сверьте формат `u_details`. По умолчанию объект отправляется JSON-строкой; это можно переопределить через `serializeDetails`.

```tsx
import { AuthProvider, createAuthClient } from './auth'

const client = createAuthClient({
  baseUrl: import.meta.env.VITE_AUTH_API_URL,
})

root.render(
  <AuthProvider client={client}>
    <App />
  </AuthProvider>,
)
```

В компоненте:

```tsx
const { state, login, register, logout } = useAuth()

await login({
  login: 'person@example.com',
  password: 'secret',
  type: 'e-mail',
})
```

## Контракт исходного API

Клиент сохраняет совместимость с обнаруженным в `taxi` двухшаговым входом:

1. `POST /auth` получает `auth_hash` и `auth_user`.
2. `POST /token` обменивает `auth_hash` на `data.token` и `data.u_hash`.
3. Токены сохраняются под одним ключом и подставляются в защищённые запросы.
4. При старте `POST /user/authorized` восстанавливает пользователя.

Ошибки `wrong login`, `wrong password`, `wrong phone` и `code sent` превращаются в типизированный `AuthApiError`, а не смешиваются с успешным ответом.

Регистрация отправляет поля существующего backend: `u_name`, `u_email`, `u_phone`, `u_role`, `ref_code`, `u_details`. Для роли водителя дополнительно выставляется `st=1`, как в исходном проекте. В демонстрационной форме оставлена только базовая клиентская регистрация.

## Перенос в другое приложение

Скопируйте каталог `src/auth` или вынесите его в npm/workspace-пакет. UI демо не связан с модулем: приложение может заменить формы, роутинг и стили, сохранив `AuthClient`, `AuthStore`, `AuthProvider` и `TokenStorage`.

Рекомендуемый production-вариант — HttpOnly cookie, выдаваемая сервером. Текущее `localStorage`-хранилище сохранено ради совместимости с `taxi`, изолировано интерфейсом `TokenStorage` и может быть заменено без изменения компонентов.

## Границы первого этапа

- В проект не копировались связанные с такси страницы, локализация, заказы и роли приложения.
- Google и WhatsApp не включены по согласованному ТЗ.
- Реальные логин/регистрация не запускаются автоматически: для интеграционного теста нужны адрес окружения, CORS и тестовая учётная запись заказчика.
