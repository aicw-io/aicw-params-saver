import { ParamsSaverConfig } from './types';
import { LinkDecorator } from './decorator';
import { debounce } from './utils';

export class DynamicObserver {
  private config: ParamsSaverConfig;
  private decorator: LinkDecorator;
  private paramsGetter: () => Record<string, string>;
  private observer: MutationObserver | null = null;
  private originalPushState: typeof history.pushState | null = null;
  private originalReplaceState: typeof history.replaceState | null = null;
  private popstateHandler: (() => void) | null = null;

  constructor(
    config: ParamsSaverConfig,
    decorator: LinkDecorator,
    paramsGetter: () => Record<string, string>
  ) {
    this.config = config;
    this.decorator = decorator;
    this.paramsGetter = paramsGetter;
  }

  private log(msg: string, ...args: unknown[]): void {
    if (this.config.debug) console.log(`[ParamsSaver:Observer] ${msg}`, ...args);
  }

  /**
   * Start observing (both MutationObserver and History API)
   */
  start(): void {
    this.startMutationObserver();
    this.hookHistoryAPI();
  }

  /**
   * Stop observing
   */
  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.unhookHistoryAPI();
  }

  private startMutationObserver(): void {
    if (typeof MutationObserver === 'undefined') {
      this.log('MutationObserver not available');
      return;
    }

    const handleMutations = debounce(() => {
      this.decorator.decorateAll(this.paramsGetter());
    }, 100);

    this.observer = new MutationObserver((mutations) => {
      // Only process if links were added
      const hasNewLinks = mutations.some((m) =>
        Array.from(m.addedNodes).some(
          (n) =>
            n.nodeType === Node.ELEMENT_NODE &&
            ((n as Element).tagName === 'A' || (n as Element).querySelector?.('a'))
        )
      );
      if (hasNewLinks) handleMutations();
    });

    this.observer.observe(document.body, { childList: true, subtree: true });
    this.log('MutationObserver started');
  }

  private hookHistoryAPI(): void {
    const onNavigation = debounce(() => {
      this.log('SPA navigation detected');
      this.decorator.reset();
      this.decorator.decorateAll(this.paramsGetter());
    }, 50);

    this.originalPushState = history.pushState;
    history.pushState = (...args: Parameters<typeof history.pushState>) => {
      this.originalPushState!.apply(history, args);
      onNavigation();
    };

    this.originalReplaceState = history.replaceState;
    history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
      this.originalReplaceState!.apply(history, args);
      onNavigation();
    };

    this.popstateHandler = onNavigation;
    window.addEventListener('popstate', this.popstateHandler);
    this.log('History API hooked');
  }

  private unhookHistoryAPI(): void {
    if (this.originalPushState) {
      history.pushState = this.originalPushState;
      this.originalPushState = null;
    }
    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState;
      this.originalReplaceState = null;
    }
    if (this.popstateHandler) {
      window.removeEventListener('popstate', this.popstateHandler);
      this.popstateHandler = null;
    }
  }
}
