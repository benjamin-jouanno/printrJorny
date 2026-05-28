import { Component, HostBinding, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, type Window as TauriWindow } from '@tauri-apps/api/window';
import { PrtjryHeaderComponent } from './components/prtjry-header/prtjry-header.component';
import { PrtjryHistoryComponent } from './components/prtjry-history/prtjry-history.component';
import { PrintDetailsComponent } from './components/print-details/print-details.component';
import { DashboardStatsComponent } from './components/dashboard-stats/dashboard-stats.component';
import { LastPrintedComponent } from './components/last-printed/last-printed.component';
import { FilamentTypeComponent } from './components/filament-type/filament-type.component';
import { FilamentFormComponent } from './components/filament-form/filament-form.component';
import { PrintFormComponent } from './components/print-form/print-form.component';
import { PrintCalendarComponent } from './components/print-calendar/print-calendar.component';
import { ProfileSelectionComponent } from './components/profile-selection/profile-selection.component';
import { ProfileFormComponent } from './components/profile-form/profile-form.component';
import { IHeader } from './interfaces/header.interface';
import { IPrint } from './interfaces/print.interface';
import { IFilament } from './interfaces/filament.interface';
import { IPrinterConnection, IPrinterLiveStatus } from './interfaces/printer-status.interface';

interface IPrintrJornyProfileFile {
  format: 'printr-jorny-profile';
  version: 1;
  exportedAt: string;
  profile: IHeader;
  printingHistory: IPrint[];
  filamentInventory: IFilament[];
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, ProfileSelectionComponent, ProfileFormComponent, PrtjryHeaderComponent, PrtjryHistoryComponent, PrintCalendarComponent, DashboardStatsComponent, LastPrintedComponent, FilamentTypeComponent, FilamentFormComponent, PrintDetailsComponent, PrintFormComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnDestroy {
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
  isPrinterSettingsOpen = false;
  emptyFilamentNotification: IFilament | null = null;
  printPendingDeletion: IPrint | null = null;
  headerInfo: IHeader = {
    id: '',
    userName: '',
    printerModel: '',
    profilePicture: '',
    printerConnection: this.normalizePrinterConnection()
  };
  activeProfileId = '';
  activeView: 'dashboard' | 'calendar' = 'dashboard';
  themeMode: 'dark' | 'light' = 'dark';
  printerStatus: IPrinterLiveStatus = this.createManualPrinterStatus();
  printerSettingsForm: IPrinterConnection = this.normalizePrinterConnection();
  private printerStatusTimer: number | null = null;

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

  ngOnDestroy(): void {
    this.stopPrinterStatusPolling();
  }

  startWindowDrag(event: MouseEvent): void {
    if (event.button !== 0 || (event.target as HTMLElement).closest('.window-button')) {
      return;
    }

    void this.getTauriWindow()?.startDragging().catch(() => undefined);
  }

  minimizeWindow(): void {
    void this.getTauriWindow()?.minimize().catch(() => undefined);
  }

  toggleMaximizeWindow(): void {
    void this.getTauriWindow()?.toggleMaximize().catch(() => undefined);
  }

  closeWindow(): void {
    void this.getTauriWindow()?.close().catch(() => undefined);
  }

  showCalendarView(): void {
    this.activeView = 'calendar';
    this.selectedPrint = null;
  }

  showDashboardView(): void {
    this.activeView = 'dashboard';
  }

  toggleTheme(): void {
    this.themeMode = this.themeMode === 'dark' ? 'light' : 'dark';
    localStorage.setItem(this.themeStorageKey, this.themeMode);
  }

  saveProfile(profile: IHeader): void {
    const savedProfile: IHeader = {
      ...profile,
      id: profile.id || this.createProfileId(),
      printerConnection: this.normalizePrinterConnection(profile.printerConnection)
    };

    this.profiles = [...this.profiles, savedProfile];
    this.persistProfiles();
    this.profilePrintCounts = {
      ...this.profilePrintCounts,
      [savedProfile.id || '']: 0
    };
    this.selectProfile(savedProfile.id || '');
  }

  async importProfileFile(file: File): Promise<void> {
    try {
      const importedProfile = this.parseProfileExport(await file.text());
      const profileId = this.createProfileId();
      const profile: IHeader = {
        ...importedProfile.profile,
        id: profileId,
        printerConnection: this.normalizePrinterConnection(importedProfile.profile.printerConnection)
      };

      this.profiles = [...this.profiles, profile];
      this.persistProfiles();
      localStorage.setItem(`${this.printingHistoryStorageKey}-${profileId}`, JSON.stringify(importedProfile.printingHistory));
      localStorage.setItem(`${this.filamentInventoryStorageKey}-${profileId}`, JSON.stringify(importedProfile.filamentInventory));
      this.loadProfilePrintCounts();
      this.selectProfile(profileId);
    } catch {
      window.alert('This profile file could not be imported.');
    }
  }

  async exportActiveProfile(): Promise<void> {
    if (!this.activeProfileId) {
      return;
    }

    const profileFile: IPrintrJornyProfileFile = {
      format: 'printr-jorny-profile',
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: this.headerInfo,
      printingHistory: this.printingHistory,
      filamentInventory: this.filamentInventory
    };

    if (!('__TAURI_INTERNALS__' in window)) {
      const blob = new Blob([JSON.stringify(profileFile, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = `${this.getExportFileName(this.headerInfo.userName)}.printrjorny`;
      downloadLink.click();
      URL.revokeObjectURL(url);
      return;
    }

    const defaultName = `${this.getExportFileName(this.headerInfo.userName)}.printrjorny`;

    try {
      const tauri = (window as any).__TAURI__;

      if (!tauri?.dialog || !tauri?.fs) {
        // If Tauri internals exist but dialog/fs are not exposed, fallback to browser download
        const blob = new Blob([JSON.stringify(profileFile, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = defaultName;
        downloadLink.click();
        URL.revokeObjectURL(url);
        return;
      }

      const selectedPath = await tauri.dialog.save({
        defaultPath: defaultName,
        filters: [
          { name: 'Printr Jorny profile', extensions: ['printrjorny', 'json'] }
        ]
      });

      if (!selectedPath) {
        return;
      }

      await tauri.fs.writeFile({ path: selectedPath, contents: JSON.stringify(profileFile, null, 2) });
    } catch {
      window.alert('Could not save profile file.');
    }
  }

  selectProfile(profileId: string): void {
    const profile = this.profiles.find(item => item.id === profileId);

    if (!profile?.id) {
      return;
    }

    this.headerInfo = profile;
    this.activeProfileId = profile.id;
    this.activeView = 'dashboard';
    localStorage.setItem(this.activeProfileStorageKey, profile.id);
    this.selectedPrint = null;
    this.closePrintForm();
    this.loadPrintingHistory();
    this.loadFilamentInventory();
    this.loadProfilePrintCounts();
    this.startPrinterStatusPolling();
  }

  showProfileSelection(): void {
    this.activeProfileId = '';
    this.headerInfo = {
      id: '',
      userName: '',
      printerModel: '',
      profilePicture: '',
      printerConnection: this.normalizePrinterConnection()
    };
    this.printingHistory = [];
    this.filamentInventory = [];
    this.activeView = 'dashboard';
    this.emptyFilamentNotification = null;
    this.printPendingDeletion = null;
    this.selectedPrint = null;
    this.closePrintForm();
    this.closeProfileForm();
    this.stopPrinterStatusPolling();
    localStorage.removeItem(this.activeProfileStorageKey);
  }

  openProfileForm(): void {
    this.isProfileFormOpen = true;
  }

  closeProfileForm(): void {
    this.isProfileFormOpen = false;
  }

  openPrinterSettings(): void {
    this.printerSettingsForm = this.normalizePrinterConnection(this.headerInfo.printerConnection);
    this.isPrinterSettingsOpen = true;
  }

  closePrinterSettings(): void {
    this.isPrinterSettingsOpen = false;
  }

  savePrinterSettings(): void {
    if (!this.activeProfileId) {
      return;
    }

    const updatedProfile: IHeader = {
      ...this.headerInfo,
      printerConnection: this.normalizePrinterConnection(this.printerSettingsForm)
    };

    this.profiles = this.profiles.map(item => item.id === this.activeProfileId ? updatedProfile : item);
    this.headerInfo = updatedProfile;
    this.persistProfiles();
    this.startPrinterStatusPolling();
    this.closePrinterSettings();
  }

  hasPrinterProgress(): boolean {
    return typeof this.printerStatus.progress === 'number';
  }

  getPrinterProgress(): number {
    return Math.max(0, Math.min(100, this.printerStatus.progress ?? 0));
  }

  updateProfile(profile: IHeader): void {
    if (!this.activeProfileId) {
      return;
    }

    const updatedProfile: IHeader = {
      ...profile,
      id: this.activeProfileId,
      printerConnection: this.normalizePrinterConnection(profile.printerConnection)
    };

    this.profiles = this.profiles.map(item => item.id === this.activeProfileId ? updatedProfile : item);
    this.headerInfo = updatedProfile;
    this.persistProfiles();
    this.startPrinterStatusPolling();
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
          profilePicture: profile.profilePicture || '',
          printerConnection: this.normalizePrinterConnection(profile.printerConnection)
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
            id: profile.id || this.createProfileId(),
            printerConnection: this.normalizePrinterConnection(profile.printerConnection)
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

  private startPrinterStatusPolling(): void {
    this.stopPrinterStatusPolling();
    this.refreshPrinterStatus();
    this.printerStatusTimer = window.setInterval(() => this.refreshPrinterStatus(), 15000);
  }

  private stopPrinterStatusPolling(): void {
    if (this.printerStatusTimer !== null) {
      window.clearInterval(this.printerStatusTimer);
      this.printerStatusTimer = null;
    }

    this.printerStatus = this.createManualPrinterStatus();
  }

  private async refreshPrinterStatus(): Promise<void> {
    const profileId = this.activeProfileId;
    const connection = this.headerInfo.printerConnection;

    if (!connection?.enabled || !connection.host.trim()) {
      this.printerStatus = this.createManualPrinterStatus();
      return;
    }

    this.printerStatus = {
      state: 'checking',
      label: 'Checking',
      detail: `Connecting to ${connection.host.trim()}`,
      isLive: false
    };

    if (!('__TAURI_INTERNALS__' in window)) {
      this.printerStatus = {
        state: 'offline',
        label: 'Desktop only',
        detail: 'Live printer status is available in the installed app.',
        isLive: false
      };
      return;
    }

    try {
      const status = await invoke<IPrinterLiveStatus>('get_bambu_printer_status', {
        config: {
          host: connection.host.trim(),
          port: connection.port || 8883
        }
      });

      if (profileId === this.activeProfileId) {
        this.printerStatus = {
          ...status,
          updatedAt: new Date().toISOString()
        };
      }
    } catch {
      if (profileId === this.activeProfileId) {
        this.printerStatus = {
          state: 'offline',
          label: 'Offline',
          detail: 'Could not reach the printer on the local network.',
          isLive: false
        };
      }
    }
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

  private createManualPrinterStatus(): IPrinterLiveStatus {
    return {
      state: 'not-configured',
      label: 'Manual',
      detail: 'Live status disabled',
      isLive: false
    };
  }

  private normalizePrinterConnection(connection?: Partial<IPrinterConnection>): IPrinterConnection {
    return {
      enabled: Boolean(connection?.enabled),
      type: 'bambu-local',
      host: connection?.host || '',
      port: connection?.port || 8883,
      serialNumber: connection?.serialNumber || '',
      accessCode: connection?.accessCode || ''
    };
  }

  private parseProfileExport(value: string): IPrintrJornyProfileFile {
    const data = JSON.parse(value) as Partial<IPrintrJornyProfileFile>;

    if (
      data.format !== 'printr-jorny-profile' ||
      data.version !== 1 ||
      !data.profile?.userName ||
      !data.profile.printerModel ||
      !Array.isArray(data.printingHistory) ||
      !Array.isArray(data.filamentInventory)
    ) {
      throw new Error('Invalid Printr Jorny profile file.');
    }

    return {
      format: 'printr-jorny-profile',
      version: 1,
      exportedAt: data.exportedAt || new Date().toISOString(),
      profile: data.profile,
      printingHistory: data.printingHistory,
      filamentInventory: data.filamentInventory
    };
  }

  private getExportFileName(value: string): string {
    return (value || 'profile')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'profile';
  }

  private getTauriWindow(): TauriWindow | null {
    if (!('__TAURI_INTERNALS__' in window)) {
      return null;
    }

    return getCurrentWindow();
  }
}
