# Карта переноса из `taxi`

| Исходный код | Новый модуль | Результат |
| --- | --- | --- |
| `src/API/auth.ts#login` | `src/auth/client.ts#login` | Сохранён двухшаговый `/auth` → `/token`. |
| `src/API/auth.ts#register` | `src/auth/client.ts#register` | Клиент, водитель, `st=1`, токены и ответ с серверным паролем. |
| `src/API/auth.ts#remindPassword` | `src/auth/client.ts#remindPassword` | Перенесён `/remind`. |
| `src/API/auth.ts#logout` | `src/auth/client.ts#logout` | Перенесён `/logout`. |
| `src/API/user.ts#getAuthorizedUser` | `src/auth/client.ts#getAuthorizedUser` | Восстановление сессии по `token/u_hash`. |
| `src/API/user.ts#editUserAfterRegister` | `src/auth/client.ts#updateRegisteredDriver` | Сохранение деталей и ID документов. |
| `src/API/index.ts#uploadFile` | `src/auth/client.ts#uploadRegistrationFile` | Base64-загрузка документов. |
| `src/API/index.ts#checkRefCode` | `src/auth/client.ts#checkReferralCode` | Проверка промокода. |
| `src/API/car.ts#createUserCar` | `src/auth/client.ts#createDriverCar` | Создание автомобиля водителя. |
| `src/API/car.ts#setDefaultCarLicenses` | `src/auth/client.ts#setDefaultCarLicense` | Назначение лицензии при заданной конфигурации. |
| `src/components/modals/ProfileModal.tsx` | `src/ProfileEditor.tsx`, `src/auth/client.ts#updateProfile` | Редактирование клиента и водителя с теми же ограничениями по роли и статусу проверки. |
| `src/API/user.ts#editUser` | `src/auth/client.ts#editUser` | Сохранён `POST /user` и legacy-формат `u_details`. |
| `src/API/user.ts#getUserCars` | `src/auth/client.ts#getAuthorizedCars` | Загрузка автомобиля через `/user/authorized/car`. |
| `src/API/car.ts#editCar` | `src/auth/client.ts#updateProfile` | Редактирование автомобиля до сохранения профиля. |
| `src/state/user/*` | `src/auth/store.ts` | Saga/reducer заменены независимым store. |
| `LoginModal/Login.tsx` | `src/App.tsx` | Email/телефон, пароль, восстановление и выход. |
| `LoginModal/Register.tsx`, `RegisterJSON.tsx` | `src/App.tsx` + `RegisterRequest` | Клиентская и водительская формы, документы, автомобиль и произвольные server-driven поля. |

## Намеренно исключено

- Google OAuth (`googleLogin`, redirect handler и Google button);
- WhatsApp login/signup, WA code modal и связанные состояния;
- навигация на страницы заказов после входа;
- доменные модули поездок, карт и заказов.

## Точки интеграции

Перед ревью на реальном окружении нужно подтвердить:

1. точный `VITE_AUTH_API_URL` и CORS;
2. префикс телефона водителя из `def_maska_tel`;
3. страну и ID intercity location class для лицензии автомобиля;
4. runtime-списки моделей, цветов и классов авто;
5. обязательность водительских полей из `reg_driver`;
6. тестовые учётные данные или отдельный backend-стенд.
