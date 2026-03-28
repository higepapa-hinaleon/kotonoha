export interface Notification {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

const notifications = ref<Notification[]>([]);
let nextId = 0;

export function useNotification() {
  function show(message: string, type: Notification["type"] = "info") {
    const id = nextId++;
    notifications.value.push({ id, message, type });

    const duration = type === "error" ? 8000 : 5000;
    setTimeout(() => {
      dismiss(id);
    }, duration);
  }

  function dismiss(id: number) {
    notifications.value = notifications.value.filter((n) => n.id !== id);
  }

  return { notifications, show, dismiss };
}
