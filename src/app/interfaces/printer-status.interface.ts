export type PrinterLiveState = 'not-configured' | 'checking' | 'reachable' | 'printing' | 'ready' | 'paused' | 'error' | 'offline';

export interface IPrinterConnection {
  enabled: boolean;
  type: 'bambu-local';
  host: string;
  port?: number;
  serialNumber?: string;
  accessCode?: string;
}

export interface IPrinterLiveStatus {
  state: PrinterLiveState;
  label: string;
  detail: string;
  isLive: boolean;
  progress?: number;
  remainingMinutes?: number;
  updatedAt?: string;
}
