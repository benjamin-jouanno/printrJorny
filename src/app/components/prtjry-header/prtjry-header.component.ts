import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { openUrl } from '@tauri-apps/plugin-opener';
import { IHeader } from '../../interfaces/header.interface';
import { IPrinterLiveStatus } from '../../interfaces/printer-status.interface';
import { IPrint } from '../../interfaces/print.interface';

@Component({
  selector: 'prtjry-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './prtjry-header.component.html',
  styleUrls: ['./prtjry-header.component.css']
})
export class PrtjryHeaderComponent {
  private readonly githubUrl = 'https://github.com/benjamin-jouanno/printrJorny';

  @Input() data: IHeader = {
    userName: '',
    printerModel: '',
    profilePicture: '',
  };
  @Input() themeMode: 'dark' | 'light' = 'dark';
  @Input() prints: IPrint[] = [];
  @Input() printerStatus: IPrinterLiveStatus = {
    state: 'not-configured',
    label: 'Manual',
    detail: 'Live status disabled',
    isLive: false
  };
  @Output() addPrint = new EventEmitter<void>();
  @Output() switchProfile = new EventEmitter<void>();
  @Output() editProfile = new EventEmitter<void>();
  @Output() exportProfile = new EventEmitter<void>();
  @Output() toggleTheme = new EventEmitter<void>();
  @Output() openPrinterSettings = new EventEmitter<void>();
  @Output() openProjects = new EventEmitter<void>();
  isSettingsMenuOpen = false;

  get initials(): string {
    const nameParts = this.data.userName.trim().split(/\s+/).filter(Boolean);
    const initials = nameParts.slice(0, 2).map(part => part[0]).join('');

    return initials.toUpperCase() || 'ID';
  }

  get firstName(): string {
    return this.data.userName.trim().split(/\s+/).filter(Boolean)[0] || this.data.userName || 'there';
  }

  get themeToggleLabel(): string {
    return this.themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  }

  get printerStatusClass(): string {
    return `is-${this.printerStatus.state}`;
  }

  get isLiveStatusDisabled(): boolean {
    return this.printerStatus.state === 'not-configured';
  }

  get hasPrintProgress(): boolean {
    return typeof this.printerStatus.progress === 'number';
  }

  get printProgress(): number {
    return Math.max(0, Math.min(100, this.printerStatus.progress ?? 0));
  }

  get isPrinterConnectionEnabled(): boolean {
    return Boolean(this.data.printerConnection?.enabled);
  }

  get printerStatusLabel(): string {
    if (this.printerStatus.state === 'reachable' || this.printerStatus.state === 'ready') {
      return 'Online';
    }

    return this.printerStatus.label;
  }

  get printerActivityLabel(): string {
    if (!this.isPrinterConnectionEnabled) {
      return 'Live status disabled';
    }

    if (this.printerStatus.state === 'printing') {
      return 'Printing';
    }

    if (this.printerStatus.state === 'paused') {
      return 'Paused';
    }

    if (this.printerStatus.state === 'offline' || this.printerStatus.state === 'error') {
      return 'Issue';
    }

    return 'Idle';
  }

  get totalFilamentUsed(): number {
    return this.prints.reduce((total, print) => total + (Number(print.filament) || 0), 0);
  }

  get totalCost(): number {
    return this.prints.reduce((total, print) => total + (Number(print.cost) || 0), 0);
  }

  get successCount(): number {
    return this.prints.filter(print => print.status === 'success').length;
  }

  get failedCount(): number {
    return this.prints.filter(print => print.status === 'failed').length;
  }

  get passedPoorlyCount(): number {
    return this.prints.filter(print => print.status === 'passed poorly').length;
  }

  @HostListener('document:click')
  closeSettingsMenuFromDocument(): void {
    this.closeSettingsMenu();
  }

  toggleSettingsMenu(): void {
    this.isSettingsMenuOpen = !this.isSettingsMenuOpen;
  }

  closeSettingsMenu(): void {
    this.isSettingsMenuOpen = false;
  }

  runMenuAction(action: EventEmitter<void>): void {
    action.emit();
    this.closeSettingsMenu();
  }

  openGithubPage(): void {
    this.closeSettingsMenu();

    if ('__TAURI_INTERNALS__' in window) {
      void openUrl(this.githubUrl).catch(() => undefined);
      return;
    }

    window.open(this.githubUrl, '_blank', 'noopener,noreferrer');
  }
}
