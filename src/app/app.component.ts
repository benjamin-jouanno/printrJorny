import { Component, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrtjryHeaderComponent } from './components/prtjry-header/prtjry-header.component';
import { PrtjryHistoryComponent } from './components/prtjry-history/prtjry-history.component';
import { PrintDetailsComponent } from './components/print-details/print-details.component';
import { DashboardStatsComponent } from './components/dashboard-stats/dashboard-stats.component';
import { LastPrintedComponent } from './components/last-printed/last-printed.component';
import { FilamentTypeComponent } from './components/filament-type/filament-type.component';
import { FilamentFormComponent } from './components/filament-form/filament-form.component';
import { GetStartedComponent } from './components/get-started/get-started.component';
import { PrintFormComponent } from './components/print-form/print-form.component';
import { ProfileSelectionComponent } from './components/profile-selection/profile-selection.component';
import { ProfileFormComponent } from './components/profile-form/profile-form.component';
import { IHeader } from './interfaces/header.interface';
import { IPrint } from './interfaces/print.interface';
import { IFilament } from './interfaces/filament.interface';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, GetStartedComponent, ProfileSelectionComponent, ProfileFormComponent, PrtjryHeaderComponent, PrtjryHistoryComponent, DashboardStatsComponent, LastPrintedComponent, FilamentTypeComponent, FilamentFormComponent, PrintDetailsComponent, PrintFormComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  private readonly profileStorageKey = 'printr-jorny-profile';
  private readonly profilesStorageKey = 'printr-jorny-profiles';
  private readonly activeProfileStorageKey = 'printr-jorny-active-profile';
  private readonly printingHistoryStorageKey = 'printr-jorny-printing-history';
  private readonly filamentInventoryStorageKey = 'printr-jorny-filament-inventory';
  private readonly themeStorageKey = 'printr-jorny-theme';

  profiles: IHeader[] = [];
  profilePrintCounts: Record<string, number> = {};
  selectedPrint: IPrint | null = null;
  printFormItem: IPrint | null = null;
  isPrintFormOpen = false;
  isFilamentFormOpen = false;
  isProfileFormOpen = false;
  emptyFilamentNotification: IFilament | null = null;
  printPendingDeletion: IPrint | null = null;
  headerInfo: IHeader = {
    id: '',
    userName: '',
    printerModel: '',
    profilePicture: '',
  };
  activeProfileId = '';
  themeMode: 'dark' | 'light' = 'dark';

  @HostBinding('class.light-theme')
  get isLightTheme(): boolean {
    return this.themeMode === 'light';
  }
  activeMaterial = 'PLA Matte Black';
  filamentInventory: IFilament[] = [];
  nozzleTemperature = 215;
  bedTemperature = 60;
  printProgress = 68;
  currentJob = 'Calibration cube';

  stats = [];

  printingHistory: IPrint[] = [];

  get lastPrinted(): IPrint | null {
    return this.printingHistory.length ? this.printingHistory[0] : null;
  }

  constructor() {
    this.loadTheme();
    this.loadProfiles();
    this.loadProfilePrintCounts();
    this.loadActiveProfile();
  }

  async minimizeWindow(): Promise<void> {
    const appWindow = await this.getTauriWindow();
    await appWindow?.minimize();
  }

  async toggleMaximizeWindow(): Promise<void> {
    const appWindow = await this.getTauriWindow();
    await appWindow?.toggleMaximize();
  }

  async closeWindow(): Promise<void> {
    const appWindow = await this.getTauriWindow();
    await appWindow?.close();
  }

  toggleTheme(): void {
    this.themeMode = this.themeMode === 'dark' ? 'light' : 'dark';
    localStorage.setItem(this.themeStorageKey, this.themeMode);
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
    this.loadFilamentInventory();
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
    this.filamentInventory = [];
    this.emptyFilamentNotification = null;
    this.printPendingDeletion = null;
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

  openCreateFilamentForm(): void {
    this.isFilamentFormOpen = true;
  }

  closeFilamentForm(): void {
    this.isFilamentFormOpen = false;
  }

  saveFilament(filament: Omit<IFilament, 'id'>): void {
    this.filamentInventory = [
      ...this.filamentInventory,
      {
        ...filament,
        id: this.createFilamentId()
      }
    ];
    this.persistFilamentInventory();
    this.closeFilamentForm();
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
    const previousPrint = this.printingHistory.find(item => item.id === print.id);
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

    this.applyFilamentUsage(savedPrint, previousPrint);
    this.notifyEmptyFilament();
    this.persistPrintingHistory();
    this.updateActiveProfilePrintCount();
    this.closePrintForm();
  }

  deletePrint(print: IPrint): void {
    this.printPendingDeletion = print;
  }

  confirmPrintDeletion(): void {
    if (!this.printPendingDeletion) {
      return;
    }

    const print = this.printPendingDeletion;
    this.restoreFilamentUsage(print);
    this.printingHistory = this.printingHistory.filter(item => item.id !== print.id);
    this.selectedPrint = null;
    this.printPendingDeletion = null;
    this.persistPrintingHistory();
    this.updateActiveProfilePrintCount();
  }

  cancelPrintDeletion(): void {
    this.printPendingDeletion = null;
  }

  deleteProfile(profileId: string): void {
    const profile = this.profiles.find(item => item.id === profileId);

    if (!profile?.id) {
      return;
    }

    this.profiles = this.profiles.filter(item => item.id !== profile.id);
    this.persistProfiles();
    localStorage.removeItem(`${this.printingHistoryStorageKey}-${profile.id}`);
    localStorage.removeItem(`${this.filamentInventoryStorageKey}-${profile.id}`);

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

  private loadTheme(): void {
    const savedTheme = localStorage.getItem(this.themeStorageKey);

    if (savedTheme === 'light' || savedTheme === 'dark') {
      this.themeMode = savedTheme;
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

  private loadFilamentInventory(): void {
    if (!this.activeProfileId) {
      this.filamentInventory = [];
      return;
    }

    const storageKey = this.getFilamentInventoryStorageKey();
    const savedInventory = localStorage.getItem(storageKey);

    if (!savedInventory) {
      this.filamentInventory = [];
      this.persistFilamentInventory();
      return;
    }

    try {
      this.filamentInventory = (JSON.parse(savedInventory) as IFilament[]).map(filament => ({
        ...filament,
        initialQuantityGrams: filament.initialQuantityGrams || filament.quantityGrams
      }));
    } catch {
      localStorage.removeItem(storageKey);
    }
  }

  private persistPrintingHistory(): void {
    if (!this.activeProfileId) {
      return;
    }

    localStorage.setItem(this.getPrintingHistoryStorageKey(), JSON.stringify(this.printingHistory));
  }

  private persistFilamentInventory(): void {
    if (!this.activeProfileId) {
      return;
    }

    localStorage.setItem(this.getFilamentInventoryStorageKey(), JSON.stringify(this.filamentInventory));
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

  private getFilamentInventoryStorageKey(): string {
    return `${this.filamentInventoryStorageKey}-${this.activeProfileId}`;
  }

  private applyFilamentUsage(savedPrint: IPrint, previousPrint?: IPrint): void {
    this.filamentInventory = this.filamentInventory.map(filament => {
      let quantityGrams = filament.quantityGrams;

      if (previousPrint?.filamentId === filament.id) {
        quantityGrams += Number(previousPrint.filament) || 0;
      }

      if (savedPrint.filamentId === filament.id) {
        quantityGrams -= Number(savedPrint.filament) || 0;
      }

      return {
        ...filament,
        quantityGrams: Math.max(0, Math.round(quantityGrams * 10) / 10)
      };
    });
    this.persistFilamentInventory();
  }

  closeEmptyFilamentNotification(): void {
    if (!this.emptyFilamentNotification) {
      return;
    }

    this.filamentInventory = this.filamentInventory.filter(filament => filament.id !== this.emptyFilamentNotification?.id);
    this.persistFilamentInventory();
    this.emptyFilamentNotification = null;
  }

  private restoreFilamentUsage(print: IPrint): void {
    if (!print.filamentId) {
      return;
    }

    this.filamentInventory = this.filamentInventory.map(filament => {
      if (filament.id !== print.filamentId) {
        return filament;
      }

      return {
        ...filament,
        quantityGrams: Math.round((filament.quantityGrams + (Number(print.filament) || 0)) * 10) / 10
      };
    });
    this.persistFilamentInventory();
  }

  private notifyEmptyFilament(): void {
    const emptyFilament = this.filamentInventory.find(filament => filament.quantityGrams <= 0);

    if (emptyFilament) {
      this.emptyFilamentNotification = emptyFilament;
    }
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

  private createFilamentId(): string {
    return `filament-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private async getTauriWindow() {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      return getCurrentWindow();
    } catch {
      return null;
    }
  }
}
