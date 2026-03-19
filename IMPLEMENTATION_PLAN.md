# Configurable Notification Appearance - Plano de Implementacao Faseado

## Resumo

Implementacao em 4 fases para customizacao completa da notificacao do foreground service Android. Cada fase e um PR independente. Backward-compatible (todas as opcoes sao opcionais com defaults mantendo o comportamento atual).

---

## ~~Fase 1 - Customizacao Visual Core (v0.9.0-beta.1)~~ CONCLUIDA

**Status:** Implementada em 2026-03-19
**Scope:** `notificationSmallIcon`, `notificationColor`, `notificationShowTimestamp`

### Arquivos a modificar

| Arquivo                                       | Mudanca                                                                                                                     |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/types/tracking.ts`                       | 3 novos campos opcionais em `TrackingOptions`                                                                               |
| `src/NativeBackgroundLocation.ts`             | 3 novos campos em `TrackingOptionsSpec`                                                                                     |
| `src/index.tsx`                               | Mapear novos campos no `specOptions`                                                                                        |
| `android/.../TrackingOptions.kt`              | 3 novos campos + defaults + helpers                                                                                         |
| `android/.../BackgroundLocationModule.kt`     | Parse dos novos campos em `parseTrackingOptions()`                                                                          |
| `android/.../LocationService.kt`              | Usar novos campos em `createNotification()` + Bundle serialization em `startService()` + `parseTrackingOptionsFromBundle()` |
| `android/.../database/TrackingStateEntity.kt` | 3 novas colunas                                                                                                             |
| `android/.../database/LocationDatabase.kt`    | version 1 -> 2                                                                                                              |
| `android/.../database/Migrations.kt`          | `MIGRATION_1_2` com ALTER TABLE                                                                                             |
| `android/.../LocationStorage.kt`              | Atualizar save/restore para novos campos                                                                                    |
| `src/__tests__/index.test.ts`                 | Testes de conversao dos novos campos                                                                                        |

### Detalhes de implementacao

**TypeScript (`TrackingOptions`):**

```typescript
notificationSmallIcon?: string;   // Nome do drawable (e.g., "ic_notification")
notificationColor?: string;        // Hex color (e.g., "#FF5722")
notificationShowTimestamp?: boolean; // Mostrar timestamp na notificacao
```

**Kotlin (`LocationService.createNotification()`):**

- Small icon: `resources.getIdentifier(name, "drawable", packageName)` com fallback para `android.R.drawable.ic_menu_mylocation` se nao encontrado
- Color: `android.graphics.Color.parseColor(hex)` com try/catch para hex invalido
- Timestamp: `builder.setShowWhen(value)`

**DB Migration v1->v2:**

```sql
ALTER TABLE tracking_state ADD COLUMN notificationSmallIcon TEXT
ALTER TABLE tracking_state ADD COLUMN notificationColor TEXT
ALTER TABLE tracking_state ADD COLUMN notificationShowTimestamp INTEGER
```

---

## Fase 2 - Atualizacao Dinamica (v0.9.0-beta.2)

**Scope:** Novo metodo `updateNotification(title, text)` no TurboModule

### Arquivos a modificar

| Arquivo                                   | Mudanca                                                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/NativeBackgroundLocation.ts`         | Novo metodo `updateNotification(title, text): Promise<void>` na Spec                                       |
| `src/index.tsx`                           | Expor `updateNotification` na API publica                                                                  |
| `android/.../BackgroundLocationModule.kt` | Override `updateNotification()` chamando `LocationService.updateNotification()`                            |
| `android/.../LocationService.kt`          | `updateNotificationContent()` (instancia) + `updateNotification()` (companion static via `activeInstance`) |
| `src/__tests__/index.test.ts`             | Testes do novo metodo                                                                                      |

### Detalhes de implementacao

- Usa o padrao `activeInstance` ja existente no `LocationService` (mesmo padrao do `stopLocationUpdatesImmediately`)
- Atualiza `trackingOptions` em memoria com `copy(notificationTitle=title, notificationText=text)`
- Reconstroi notificacao via `createNotification()` (herda icone, cor, timestamp da Fase 1)
- Chama `NotificationManager.notify(NOTIFICATION_ID, notification)` para atualizar in-place
- **Nao recria** o notification channel
- **Nao persiste** no banco - atualizacoes dinamicas sao transientes (documentado como limitacao)

---

## Fase 3 - Action Buttons (v0.9.0-beta.3)

**Scope:** Ate 3 botoes de acao na notificacao com eventos para JS

### Arquivos a modificar

| Arquivo                                           | Mudanca                                                                                                                            |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/types/tracking.ts`                           | Interface `NotificationAction { id, label }` + campo `notificationActions?: NotificationAction[]` + tipo `NotificationActionEvent` |
| `src/NativeBackgroundLocation.ts`                 | `notificationActions?: string` (JSON serializado - limitacao Codegen)                                                              |
| `src/index.tsx`                                   | `JSON.stringify(actions.slice(0, 3))` na conversao                                                                                 |
| `android/.../TrackingOptions.kt`                  | Campo `notificationActions: String?`                                                                                               |
| `android/.../BackgroundLocationModule.kt`         | Parse + handler `handleNotificationAction()` no broadcast receiver                                                                 |
| `android/.../LocationService.kt`                  | Parse JSON + `addAction()` com `PendingIntent.getBroadcast()`                                                                      |
| `android/.../LocationEventBroadcaster.kt`         | Nova action `ACTION_NOTIFICATION_ACTION` + metodo broadcast                                                                        |
| `android/src/main/AndroidManifest.xml`            | Registrar `NotificationActionReceiver`                                                                                             |
| Nova: `android/.../NotificationActionReceiver.kt` | BroadcastReceiver para clicks nos botoes                                                                                           |
| `android/.../database/Migrations.kt`              | `MIGRATION_2_3`                                                                                                                    |
| `android/.../database/TrackingStateEntity.kt`     | Coluna `notificationActions`                                                                                                       |
| `src/hooks/useLocationUpdates.ts`                 | Listener para evento `onNotificationAction` (via callback `onNotificationAction`)                                                  |
| `src/__tests__/index.test.ts`                     | Testes de serializacao JSON                                                                                                        |

### Detalhes de implementacao

**Fluxo do evento:**

```
Usuario clica botao -> PendingIntent -> NotificationActionReceiver (manifest-registered)
  -> LocationEventBroadcaster.broadcastNotificationAction() (LocalBroadcastManager)
  -> BackgroundLocationModule broadcast receiver
  -> RCTDeviceEventEmitter.emit("onNotificationAction", { tripId, actionId })
  -> useLocationUpdates callback
```

**Codegen workaround:** Arrays de objetos tipados nao sao suportados pelo Codegen. Solucao: serializar como JSON string no TS, deserializar com `org.json.JSONArray` no Kotlin.

**Hook usage:**

```typescript
useLocationUpdates({
  onNotificationAction: (event) => {
    if (event.actionId === 'stop') stopTracking();
    if (event.actionId === 'emergency') callEmergency();
  },
});
```

---

## Fase 4 - Customizacao Estendida (v0.9.0)

**Scope:** `notificationLargeIcon`, `notificationSubtext`, `notificationChannelId`

### Arquivos a modificar

Mesmo pipeline da Fase 1 (todos os arquivos do fluxo TS -> Spec -> Kotlin -> Service -> DB).

### Detalhes de implementacao

| Opcao                   | TS Type   | Kotlin Implementation                                                             |
| ----------------------- | --------- | --------------------------------------------------------------------------------- |
| `notificationLargeIcon` | `string?` | `resources.getIdentifier()` + `BitmapFactory.decodeResource()` + `setLargeIcon()` |
| `notificationSubtext`   | `string?` | `builder.setSubText(value)`                                                       |
| `notificationChannelId` | `string?` | Substituir `CHANNEL_ID` hardcoded; minimal notification continua usando default   |

**DB Migration v3->v4:** 3 novas colunas.

---

## Sequenciamento e PRs

| PR   | Fase                     | Base        | Depende de                      | Status     |
| ---- | ------------------------ | ----------- | ------------------------------- | ---------- |
| PR 1 | Fase 1 - Visual Core     | develop     | -                               | CONCLUIDA  |
| PR 2 | Fase 2 - Dynamic Updates | PR 1 branch | PR 1 merged                     | Pendente   |
| PR 3 | Fase 3 - Action Buttons  | PR 2 branch | PR 2 merged                     | Pendente   |
| PR 4 | Fase 4 - Extended        | PR 1 branch | PR 1 merged (paralelo com PR 3) | Pendente   |

---

## Verificacao e Testes

Para cada fase:

1. **Unit tests:** `yarn test` - verificar conversao de opcoes TS -> Spec
2. **Type check:** `yarn typecheck` - nenhum erro novo
3. **Lint:** `yarn lint` - sem violacoes
4. **Build:** `yarn prepare` - library compila (CommonJS + ESM + types)
5. **Android build:** `cd example && yarn build:android` - APK compila sem erros
6. **Manual test no example app:**
   - ~~Fase 1: Adicionar icone custom em `example/android/app/src/main/res/drawable/`, configurar nas options, verificar notificacao~~ (Validado: unit tests, typecheck, lint passando)
   - Fase 2: Chamar `updateNotification()` durante tracking ativo, verificar texto muda
   - Fase 3: Adicionar actions, clicar botoes, verificar eventos no console
   - Fase 4: Verificar large icon, subtext, e channel customizado

---

## Notas Importantes

- **Minimal notification nao muda** - continua hardcoded para garantir o deadline Android 12+
- **Backward compatible** - todos os campos opcionais, defaults preservam comportamento atual
- **Resource fallback** - icone/cor invalidos geram log de warning e usam default, sem crash
- **DB migrations safe** - SQLite ALTER TABLE ADD COLUMN com valores nullable
- **updateNotification() transiente** - atualizacoes dinamicas nao sobrevivem restart do service
