import { useState } from "react";
import { BellRing, X } from "lucide-react";

interface PushPermissionPromptProps {
  permission: NotificationPermission | "unsupported";
  onRequest: () => Promise<NotificationPermission | "unsupported">;
}

/**
 * Bannière compacte affichée uniquement lorsque le navigateur attend une action manuelle
 * pour activer les notifications push (iOS Safari, Android Chrome, Edge).
 */
export default function PushPermissionPrompt({ permission, onRequest }: PushPermissionPromptProps) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("waritrack_push_prompt_dismissed") === "1";
    } catch {
      return false;
    }
  });
  const [requesting, setRequesting] = useState(false);

  if (permission !== "default" || dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-2.5 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-slate-800 px-3 py-2 text-xs">
      <div className="flex min-w-0 items-center gap-2 text-amber-900 dark:text-amber-200">
        <BellRing className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="truncate font-medium">Activez les notifications push pour recevoir vos alertes hors écran.</span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          disabled={requesting}
          onClick={async () => {
            setRequesting(true);
            await onRequest();
            setRequesting(false);
          }}
          className="rounded-lg bg-amber-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {requesting ? "…" : "Activer"}
        </button>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            try {
              sessionStorage.setItem("waritrack_push_prompt_dismissed", "1");
            } catch {
              // Ignore
            }
          }}
          aria-label="Masquer"
          className="flex h-7 w-7 items-center justify-center rounded-full text-amber-700 dark:text-slate-400 hover:bg-amber-100 dark:hover:bg-slate-700"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
