import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IHeader } from '../../interfaces/header.interface';

@Component({
  selector: 'prtjry-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './prtjry-header.component.html',
  styleUrls: ['./prtjry-header.component.css']
})
export class PrtjryHeaderComponent {
  @Input() data: IHeader = {
    userName: '',
    printerModel: '',
    profilePicture: '',
  };
  @Input() themeMode: 'dark' | 'light' = 'dark';
  @Output() addPrint = new EventEmitter<void>();
  @Output() switchProfile = new EventEmitter<void>();
  @Output() editProfile = new EventEmitter<void>();
  @Output() exportProfile = new EventEmitter<void>();
  @Output() toggleTheme = new EventEmitter<void>();
  isSettingsMenuOpen = false;

  get initials(): string {
    const nameParts = this.data.userName.trim().split(/\s+/).filter(Boolean);
    const initials = nameParts.slice(0, 2).map(part => part[0]).join('');

    return initials.toUpperCase() || 'ID';
  }

  get themeToggleLabel(): string {
    return this.themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
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
}
