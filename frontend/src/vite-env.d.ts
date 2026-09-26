/// <reference types="vite/client" />

interface QtWebChannel {
  objects: Record<string, unknown>;
}

interface QWebChannelConstructor {
  new (
    transport: unknown,
    callback: (channel: QtWebChannel) => void
  ): QtWebChannel;
}

declare global {
  interface Window {
    qt?: { webChannelTransport?: unknown };
    QWebChannel?: QWebChannelConstructor;
  }
}

export {};
