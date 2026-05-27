import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { openUrl } from '@tauri-apps/plugin-opener';
import { IHeader } from '../../interfaces/header.interface';
import { IPrinterLiveStatus } from '../../interfaces/printer-status.interface';

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
  @Output() openPrinterDetails = new EventEmitter<void>();
  isSettingsMenuOpen = false;

  get initials(): string {
    const nameParts = this.data.userName.trim().split(/\s+/).filter(Boolean);
    const initials = nameParts.slice(0, 2).map(part => part[0]).join('');

    return initials.toUpperCase() || 'ID';
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
