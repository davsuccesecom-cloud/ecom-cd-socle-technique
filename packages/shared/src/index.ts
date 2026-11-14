// Point d'entrée unique — chaque app importe depuis "@ecomcod/shared"
// plutôt que depuis les fichiers internes, pour garder une frontière claire.

export * from "./types";
export * from "./constants";
export * from "./firebase";

export * from "./utils/phone";
export * from "./utils/loadBalancing";
export * from "./utils/remuneration";
export * from "./utils/logoImage";

export * from "./hooks/useOrders";
export * from "./hooks/useCashSettlements";
export * from "./hooks/useTeam";
export * from "./hooks/useTeams";
export * from "./hooks/useTeamUsers";
export * from "./hooks/useNotifications";
export * from "./hooks/useRemunerationTotals";
export * from "./hooks/useDailyStats";
export * from "./hooks/useAuth";
export * from "./hooks/useAdminEmailAuth";
export * from "./hooks/useCallInProgress";
export * from "./hooks/useUpdateOrderStatus";
export * from "./hooks/useRegisterPushNotifications";
export * from "./hooks/useWhiteLabel";
export { default as NotificationBell } from "./components/NotificationBell";
export { default as PushToast } from "./components/PushToast";
export { default as PushPermissionPrompt } from "./components/PushPermissionPrompt";
export { default as ConfirmDialog } from "./components/ConfirmDialog";
export { default as AutoResizeTextarea } from "./components/AutoResizeTextarea";

export * from "./hooks/useConnectionGuard";
export * from "./components/ConnectionGuard";
export * from "./hooks/useTheme";
export * from "./indicators";
export * from "./utils/deliveryReceipt";
