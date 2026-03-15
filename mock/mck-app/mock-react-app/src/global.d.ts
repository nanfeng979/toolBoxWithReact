export {};

declare global {
  interface Window {
    hostApi?: {
      showNotification?: (title: string, body: string) => Promise<boolean>;
    };
  }
}
