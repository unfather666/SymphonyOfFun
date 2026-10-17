// Modal ui, logging, settings.

// ---- ui / log / settings --------------------------------------------------

export interface MenuItem {
  label: string;
  /** Greyed and not pickable. */
  disabled?: boolean;
  onPick(): void;
}

export interface MenuOptions {
  title?: string;
  items: readonly MenuItem[];
  /** b / select. Default: close the menu. */
  onCancel?(): void;
}

export interface UiHandle {
  close(): void;
  isOpen(): boolean;
}

/** Modal ui (menu, textBox) pauses the game's update while open; notice does not. */
export interface Ui {
  menu(opts: MenuOptions): UiHandle;
  textBox(text: string, onClose?: () => void): UiHandle;
  notice(text: string, ms?: number): void;
}

export interface Logger {
  info(msg: string): void;
  /** Logged once per key. */
  warn(key: string, msg: string): void;
  error(key: string, msg: string): void;
}

export interface Settings {
  readonly platform: 'desktop' | 'phone' | 'browser';
  readonly reducedFx: boolean;
}
