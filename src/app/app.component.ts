import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrtjryHeaderComponent } from './components/prtjry-header/prtjry-header.component';
import { PrtjryHistoryComponent } from './components/prtjry-history/prtjry-history.component';
import { PrintDetailsComponent } from './components/print-details/print-details.component';
import { DashboardStatsComponent } from './components/dashboard-stats/dashboard-stats.component';
import { LastPrintedComponent } from './components/last-printed/last-printed.component';
import { GetStartedComponent } from './components/get-started/get-started.component';
import { PrintFormComponent } from './components/print-form/print-form.component';
import { ProfileSelectionComponent } from './components/profile-selection/profile-selection.component';
import { ProfileFormComponent } from './components/profile-form/profile-form.component';
import { IHeader } from './interfaces/header.interface';
import { IPrint } from './interfaces/print.interface';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, GetStartedComponent, ProfileSelectionComponent, ProfileFormComponent, PrtjryHeaderComponent, PrtjryHistoryComponent, DashboardStatsComponent, LastPrintedComponent, PrintDetailsComponent, PrintFormComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  private readonly profileStorageKey = 'printr-jorny-profile';
  private readonly profilesStorageKey = 'printr-jorny-profiles';
  private readonly activeProfileStorageKey = 'printr-jorny-active-profile';
  private readonly printingHistoryStorageKey = 'printr-jorny-printing-history';

  profiles: IHeader[] = [];
  profilePrintCounts: Record<string, number> = {};
  selectedPrint: IPrint | null = null;
  printFormItem: IPrint | null = null;
  isPrintFormOpen = false;
  isProfileFormOpen = false;
  headerInfo: IHeader = {
    id: '',
    userName: '',
    printerModel: '',
    profilePicture: '',
  };
  activeProfileId = '';
  activeMaterial = 'PLA Matte Black';
  nozzleTemperature = 215;
  bedTemperature = 60;
  printProgress = 68;
  currentJob = 'Calibration cube';

  stats = [
    { label: 'Nozzle', value: `${this.nozzleTemperature}°C`, detail: 'Target 215°C' },
    { label: 'Bed', value: `${this.bedTemperature}°C`, detail: 'Target 60°C' },
    { label: 'Progress', value: `${this.printProgress}%`, detail: this.currentJob },
    { label: 'Material', value: 'PLA', detail: this.activeMaterial }
  ];

  printingHistory: IPrint[] = [
    { id: 'sample-1', name: 'Calibration cube', filament: 12, cost: 0.48, time: '1h 12m', status: 'success', date: '2026-05-21', description: 'Baseline calibration object used for leveling and flow tuning.' },
    { id: 'sample-2', name: 'Phone holder', filament: 28, cost: 1.12, time: '2h 03m', status: 'passed poorly', date: '2026-05-22', description: 'Utility phone mount with thin walls, had slight underextrusion near the clip.', errorDescription: 'Thin walls and inconsistent extrusion around the clip led to poorer-than-expected part quality.' },
    { id: 'sample-3', name: 'Enclosure hinge', filament: 6, cost: 0.24, time: '0h 35m', status: 'failed', date: '2026-05-23', description: 'Small hinge print that failed due to a loose bed attachment midway.', errorDescription: 'The part detached from the bed mid-print, causing the hinge to collapse and fail.' },
    { id: 'sample-4', name: 'Cable clip', filament: 3, cost: 0.12, time: '0h 12m', status: 'success', date: '2026-05-24', description: 'Simple cable management clip printed cleanly with no issues.' }
  ];

  get lastPrinted(): IPrint | null {
    return this.printingHistory.length ? this.printingHistory[0] : null;
  }

  constructor() {
    this.loadProfiles();
    this.loadProfilePrintCounts();
    this.loadActiveProfile();
  }

  saveProfile(profile: IHeader): void {
    const savedProfile: IHeader = {
      ...profile,
      id: profile.id || this.createProfileId()
    };

    this.profiles = [...this.profiles, savedProfile];
    this.persistProfiles();
    this.profilePrintCounts = {
      ...this.profilePrintCounts,
      [savedProfile.id || '']: 0
    };
    this.selectProfile(savedProfile.id || '');
  }

  selectProfile(profileId: string): void {
    const profile = this.profiles.find(item => item.id === profileId);

    if (!profile?.id) {
      return;
    }

    this.headerInfo = profile;
    this.activeProfileId = profile.id;
    localStorage.setItem(this.activeProfileStorageKey, profile.id);
    this.selectedPrint = null;
    this.closePrintForm();
    this.loadPrintingHistory();
    this.loadProfilePrintCounts();
  }

  showProfileSelection(): void {
    this.activeProfileId = '';
    this.headerInfo = {
      id: '',
      userName: '',
      printerModel: '',
      profilePicture: ''
    };
    this.printingHistory = [];
    this.selectedPrint = null;
    this.closePrintForm();
    this.closeProfileForm();
    localStorage.removeItem(this.activeProfileStorageKey);
  }

  openProfileForm(): void {
    this.isProfileFormOpen = true;
  }

  closeProfileForm(): void {
    this.isProfileFormOpen = false;
  }

  updateProfile(profile: IHeader): void {
    if (!this.activeProfileId) {
      return;
    }

    const updatedProfile: IHeader = {
      ...profile,
      id: this.activeProfileId
    };

    this.profiles = this.profiles.map(item => item.id === this.activeProfileId ? updatedProfile : item);
    this.headerInfo = updatedProfile;
    this.persistProfiles();
    this.closeProfileForm();
  }

  openCreatePrintForm(): void {
    this.printFormItem = null;
    this.isPrintFormOpen = true;
    this.selectedPrint = null;
  }

  openEditPrintForm(print: IPrint): void {
    this.printFormItem = print;
    this.isPrintFormOpen = true;
    this.selectedPrint = null;
  }

  closePrintForm(): void {
    this.isPrintFormOpen = false;
    this.printFormItem = null;
  }

  savePrint(print: IPrint): void {
    const savedPrint: IPrint = {
      ...print,
      id: print.id || this.createPrintId()
    };

    const existingIndex = this.printingHistory.findIndex(item => item.id === savedPrint.id);

    if (existingIndex >= 0) {
      this.printingHistory = this.sortPrints([
        ...this.printingHistory.slice(0, existingIndex),
        savedPrint,
        ...this.printingHistory.slice(existingIndex + 1)
      ]);
    } else {
      this.printingHistory = this.sortPrints([savedPrint, ...this.printingHistory]);
    }

    this.persistPrintingHistory();
    this.updateActiveProfilePrintCount();
    this.closePrintForm();
  }

  deletePrint(print: IPrint): void {
    if (!confirm(`Delete "${print.name}" from your printing history?`)) {
      return;
    }

    this.printingHistory = this.printingHistory.filter(item => item.id !== print.id);
    this.selectedPrint = null;
    this.persistPrintingHistory();
    this.updateActiveProfilePrintCount();
  }

  deleteProfile(profileId: string): void {
    const profile = this.profiles.find(item => item.id === profileId);

    if (!profile?.id) {
      return;
    }

    this.profiles = this.profiles.filter(item => item.id !== profile.id);
    this.persistProfiles();
    localStorage.removeItem(`${this.printingHistoryStorageKey}-${profile.id}`);

    const { [profile.id]: _removedCount, ...remainingCounts } = this.profilePrintCounts;
    this.profilePrintCounts = remainingCounts;

    if (this.activeProfileId === profile.id) {
      this.showProfileSelection();
    }
  }

  private loadProfile(): void {
    const savedProfile = localStorage.getItem(this.profileStorageKey);

    if (!savedProfile) {
      return;
    }

    try {
      const profile = JSON.parse(savedProfile) as IHeader & { printerName?: string };
      const printerModel = profile.printerModel || profile.printerName || '';

      if (profile.userName && printerModel) {
        const migratedProfile: IHeader = {
          id: profile.id || this.createProfileId(),
          userName: profile.userName,
          printerModel,
          profilePicture: profile.profilePicture || ''
        };

        this.profiles = [migratedProfile];
        this.persistProfiles();
        localStorage.setItem(this.activeProfileStorageKey, migratedProfile.id || '');
        localStorage.removeItem(this.profileStorageKey);
      }
    } catch {
      localStorage.removeItem(this.profileStorageKey);
    }
  }

  private loadProfiles(): void {
    const savedProfiles = localStorage.getItem(this.profilesStorageKey);

    if (savedProfiles) {
      try {
        this.profiles = (JSON.parse(savedProfiles) as IHeader[])
          .filter(profile => profile.userName && profile.printerModel)
          .map(profile => ({
            ...profile,
            id: profile.id || this.createProfileId()
          }));
        this.persistProfiles();
        return;
      } catch {
        localStorage.removeItem(this.profilesStorageKey);
      }
    }

    this.loadProfile();
  }

  private loadActiveProfile(): void {
    const savedActiveProfileId = localStorage.getItem(this.activeProfileStorageKey);
    const activeProfile = this.profiles.find(profile => profile.id === savedActiveProfileId) || this.profiles[0];

    if (activeProfile?.id) {
      this.selectProfile(activeProfile.id);
    }
  }

  private persistProfiles(): void {
    localStorage.setItem(this.profilesStorageKey, JSON.stringify(this.profiles));
  }

  private loadPrintingHistory(): void {
    if (!this.activeProfileId) {
      this.printingHistory = [];
      return;
    }

    const storageKey = this.getPrintingHistoryStorageKey();
    let savedPrintingHistory = localStorage.getItem(storageKey);

    if (!savedPrintingHistory) {
      const legacyPrintingHistory = localStorage.getItem(this.printingHistoryStorageKey);

      if (legacyPrintingHistory) {
        savedPrintingHistory = legacyPrintingHistory;
        localStorage.setItem(storageKey, legacyPrintingHistory);
        localStorage.removeItem(this.printingHistoryStorageKey);
      }
    }

    if (!savedPrintingHistory) {
      this.printingHistory = [];
      return;
    }

    try {
      const prints = JSON.parse(savedPrintingHistory) as Array<IPrint & { id?: string }>;
      this.printingHistory = this.sortPrints(
        prints.map(print => ({
          ...print,
          id: print.id || this.createPrintId()
        }))
      );
      this.persistPrintingHistory();
    } catch {
      localStorage.removeItem(storageKey);
      this.printingHistory = [];
    }
  }

  private persistPrintingHistory(): void {
    if (!this.activeProfileId) {
      return;
    }

    localStorage.setItem(this.getPrintingHistoryStorageKey(), JSON.stringify(this.printingHistory));
  }

  private loadProfilePrintCounts(): void {
    this.profilePrintCounts = this.profiles.reduce<Record<string, number>>((counts, profile) => {
      if (!profile.id) {
        return counts;
      }

      const savedPrintingHistory = localStorage.getItem(`${this.printingHistoryStorageKey}-${profile.id}`);

      if (!savedPrintingHistory) {
        counts[profile.id] = 0;
        return counts;
      }

      try {
        counts[profile.id] = (JSON.parse(savedPrintingHistory) as IPrint[]).length;
      } catch {
        counts[profile.id] = 0;
      }

      return counts;
    }, {});
  }

  private updateActiveProfilePrintCount(): void {
    if (!this.activeProfileId) {
      return;
    }

    this.profilePrintCounts = {
      ...this.profilePrintCounts,
      [this.activeProfileId]: this.printingHistory.length
    };
  }

  private getPrintingHistoryStorageKey(): string {
    return `${this.printingHistoryStorageKey}-${this.activeProfileId}`;
  }

  private sortPrints(prints: IPrint[]): IPrint[] {
    return [...prints].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  private createPrintId(): string {
    return `print-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private createProfileId(): string {
    return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
