import { render } from 'preact';
import { WidgetRoot } from './WidgetRoot';

export interface WidgetOptions {
  container?: HTMLElement;
}

let rootElement: HTMLElement | null = null;

export function mountWidget(options: WidgetOptions = {}) {
  const target = options.container ?? document.body;

  if (!target) {
    throw new Error('No container element available to mount the widget.');
  }

  if (!rootElement) {
    rootElement = document.createElement('div');
    rootElement.id = 'tiny-chatbot-widget-root';
    target.appendChild(rootElement);
  }

  render(<WidgetRoot />, rootElement);
}

export function unmountWidget() {
  if (rootElement) {
    render(null, rootElement);
    rootElement.remove();
    rootElement = null;
  }
}

declare global {
  interface Window {
    TinyChatbotSDK?: {
      mount: (options?: WidgetOptions) => void;
      unmount: () => void;
    };
  }
}

if (typeof window !== 'undefined') {
  window.TinyChatbotSDK = {
    mount: mountWidget,
    unmount: unmountWidget
  };
}
