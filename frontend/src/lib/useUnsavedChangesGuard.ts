import { useEffect } from "react";

export function useUnsavedChangesGuard(isDirty: boolean, message = "You have unsaved changes. Leave anyway?") {
  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = message;
      return message;
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [isDirty, message]);
}