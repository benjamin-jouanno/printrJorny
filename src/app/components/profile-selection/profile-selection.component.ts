import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IHeader } from '../../interfaces/header.interface';
import { GetStartedComponent } from '../get-started/get-started.component';

@Component({
  selector: 'profile-selection',
  standalone: true,
  imports: [CommonModule, GetStartedComponent],
  templateUrl: './profile-selection.component.html',
  styleUrls: ['./profile-selection.component.css']
})
export class ProfileSelectionComponent {
  @Input() profiles: IHeader[] = [];
  @Input() printCounts: Record<string, number> = {};
  @Output() selectProfile = new EventEmitter<string>();
  @Output() createProfile = new EventEmitter<IHeader>();
  @Output() deleteProfile = new EventEmitter<string>();
  @Output() importProfile = new EventEmitter<File>();

  isCreatingProfile = false;
  profilePendingDeletion: IHeader | null = null;

  get shouldShowCreationForm(): boolean {
    return this.isCreatingProfile || !this.profiles.length;
  }

  getInitials(profile: IHeader): string {
    const nameParts = profile.userName.trim().split(/\s+/).filter(Boolean);
    const initials = nameParts.slice(0, 2).map(part => part[0]).join('');

    return initials.toUpperCase() || 'ID';
  }

  chooseProfile(profile: IHeader): void {
    if (profile.id) {
      this.selectProfile.emit(profile.id);
    }
  }

  getPrintCount(profile: IHeader): number {
    return profile.id ? this.printCounts[profile.id] || 0 : 0;
  }

  removeProfile(event: Event, profile: IHeader): void {
    event.stopPropagation();

    this.profilePendingDeletion = profile;
  }

  confirmProfileDeletion(): void {
    if (this.profilePendingDeletion?.id) {
      this.deleteProfile.emit(this.profilePendingDeletion.id);
    }

    this.profilePendingDeletion = null;
  }

  cancelProfileDeletion(): void {
    this.profilePendingDeletion = null;
  }

  saveNewProfile(profile: IHeader): void {
    this.createProfile.emit(profile);
    this.isCreatingProfile = false;
  }

  onProfileFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      this.importProfile.emit(file);
    }

    input.value = '';
  }
}
