import { Component, ElementRef, HostBinding, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
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
import { IProject, IProjectTask, ProjectTaskStatus } from './interfaces/project.interface';
import { IPrinterConnection, IPrinterLiveStatus } from './interfaces/printer-status.interface';

interface IPrintrJornyProfileFile {
  format: 'printr-jorny-profile';
  version: 1;
  exportedAt: string;
  profile: IHeader;
  printingHistory: IPrint[];
  filamentInventory: IFilament[];
  projects: IProject[];
}

interface IPrintrJornyProjectFile {
  format: 'printr-jorny-project';
  version: 1;
  exportedAt: string;
  project: IProject;
}

interface IPendingTaskStatusChange {
  taskId: string;
  status: ProjectTaskStatus;
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
  private readonly projectsStorageKey = 'printr-jorny-projects';
  private readonly themeStorageKey = 'printr-jorny-theme';

  profiles: IHeader[] = [];
  profilePrintCounts: Record<string, number> = {};
  selectedPrint: IPrint | null = null;
  printFormItem: IPrint | null = null;
  isPrintFormOpen = false;
  isFilamentFormOpen = false;
  isProfileFormOpen = false;
  isPrinterSettingsOpen = false;
  isProjectFormOpen = false;
  isProjectTaskFormOpen = false;
  emptyFilamentNotification: IFilament | null = null;
  printPendingDeletion: IPrint | null = null;
  projectPendingDeletion: IProject | null = null;
  projectTaskPendingDeletion: IProjectTask | null = null;
  projectTaskPendingStatusChange: IPendingTaskStatusChange | null = null;
  headerInfo: IHeader = {
    id: '',
    userName: '',
    printerModel: '',
    profilePicture: '',
    printerConnection: this.normalizePrinterConnection()
  };
  activeProfileId = '';
  activeView: 'dashboard' | 'calendar' | 'projects' | 'project-board' = 'dashboard';
  selectedProjectId = '';
  selectedProjectTask: IProjectTask | null = null;
  draggedTaskId = '';
  hoveredTaskDropStatus: ProjectTaskStatus | '' = '';
  private taskDragStartX = 0;
  private taskDragStartY = 0;
  private isTaskPointerDragging = false;
  private suppressNextTaskClick = false;
  themeMode: 'dark' | 'light' = 'dark';
  printerStatus: IPrinterLiveStatus = this.createManualPrinterStatus();
  printerSettingsForm: IPrinterConnection = this.normalizePrinterConnection();
  private printerStatusTimer: number | null = null;
  private projectTaskReturnId = '';

  @HostBinding('class.light-theme')
  get isLightTheme(): boolean {
    return this.themeMode === 'light';
  }

  @HostBinding('class.projects-list-view')
  get isProjectsListView(): boolean {
    return this.activeView === 'projects';
  }

  @HostBinding('class.profile-entry-view')
  get isProfileEntryView(): boolean {
    return !this.activeProfileId;
  }

  activeMaterial = 'PLA Matte Black';
  filamentInventory: IFilament[] = [];
  projects: IProject[] = [];
  projectForm: IProject = this.createEmptyProject();
  projectTaskForm: IProjectTask = this.createEmptyProjectTask();
  readonly projectTaskStatuses: ProjectTaskStatus[] = ['to do', 'doing', 'on hold', 'ready for review', 'done', 'discontinued'];
  readonly printStatuses = ['success', 'passed poorly', 'failed'];
  openTaskPrintStatusIndex: number | null = null;
  openTaskPrintFilamentIndex: number | null = null;
  isEditingProjectName = false;
  projectNameDraft = '';
  pendingTaskDurationHours = 0;
  pendingTaskDurationMinutes = 0;
  nozzleTemperature = 215;
  bedTemperature = 60;
  printProgress = 68;
  currentJob = 'Calibration cube';

  stats = [];

  printingHistory: IPrint[] = [];

  @ViewChild('projectTaskDescriptionEditor')
  private projectTaskDescriptionEditor?: ElementRef<HTMLElement>;

  get lastPrinted(): IPrint | null {
    return this.printingHistory.length ? this.printingHistory[0] : null;
  }

  get selectedProject(): IProject | null {
    return this.projects.find(project => project.id === this.selectedProjectId) || null;
  }

  get projectTaskPendingCompletion(): IProjectTask | null {
    return this.projectTaskPendingStatusChange
      ? this.getSelectedProjectTaskById(this.projectTaskPendingStatusChange.taskId)
      : null;
  }

  get isEditingProjectTask(): boolean {
    return Boolean(this.projectTaskForm.id);
  }

  get hasPendingTaskDuration(): boolean {
    return Number(this.pendingTaskDurationHours) > 0 || Number(this.pendingTaskDurationMinutes) > 0;
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

  showProjectsView(): void {
    this.activeView = 'projects';
    this.selectedPrint = null;
    this.selectedProjectId = '';
    this.selectedProjectTask = null;
    this.projectPendingDeletion = null;
    this.projectTaskPendingDeletion = null;
    this.projectTaskPendingStatusChange = null;
    this.cancelProjectNameEdit();
  }

  openProject(project: IProject): void {
    this.selectedProjectId = project.id;
    this.selectedProjectTask = null;
    this.cancelProjectNameEdit();
    this.activeView = 'project-board';
  }

  startProjectNameEdit(project: IProject): void {
    this.projectNameDraft = project.name;
    this.isEditingProjectName = true;
  }

  saveProjectName(project: IProject): void {
    const name = this.projectNameDraft.trim();

    if (!name) {
      return;
    }

    this.projects = this.projects.map(item => item.id === project.id ? { ...item, name } : item);
    this.isEditingProjectName = false;
    this.projectNameDraft = '';
    this.persistProjects();
  }

  cancelProjectNameEdit(): void {
    this.isEditingProjectName = false;
    this.projectNameDraft = '';
  }

  deleteSelectedProject(): void {
    const project = this.selectedProject;

    if (!project) {
      return;
    }

    this.projectPendingDeletion = project;
  }

  confirmProjectDeletion(): void {
    if (!this.projectPendingDeletion) {
      return;
    }

    this.projects = this.projects.filter(item => item.id !== this.projectPendingDeletion?.id);
    this.projectPendingDeletion = null;
    this.persistProjects();
    this.showProjectsView();
  }

  cancelProjectDeletion(): void {
    this.projectPendingDeletion = null;
  }

  async exportSelectedProject(): Promise<void> {
    const project = this.selectedProject;

    if (!project) {
      return;
    }

    const projectFile: IPrintrJornyProjectFile = {
      format: 'printr-jorny-project',
      version: 1,
      exportedAt: new Date().toISOString(),
      project: this.normalizeProject(project)
    };
    const defaultName = `${this.getExportFileName(project.name)}.printrjorny-project`;

    try {
      await this.saveJsonFile(projectFile, defaultName, 'Printr Jorny project', ['.printrjorny-project', '.json']);
    } catch {
      window.alert('Could not save project file.');
    }
  }

  async importProjectFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    try {
      const importedProject = this.createImportedProjectCopy(this.parseProjectExport(await file.text()).project);
      this.projects = [importedProject, ...this.projects];
      this.persistProjects();
      this.openProject(importedProject);
    } catch {
      window.alert('This project file could not be imported.');
    } finally {
      input.value = '';
    }
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
      localStorage.setItem(`${this.projectsStorageKey}-${profileId}`, JSON.stringify(importedProfile.projects));
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
      filamentInventory: this.filamentInventory,
      projects: this.projects
    };

    const defaultName = `${this.getExportFileName(this.headerInfo.userName)}.printrjorny`;

    try {
      await this.saveJsonFile(profileFile, defaultName, 'Printr Jorny profile', ['.printrjorny', '.json']);
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
    this.loadProjects();
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
    this.projects = [];
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

  openCreateProjectForm(): void {
    this.projectForm = this.createEmptyProject();
    this.isProjectFormOpen = true;
  }

  openEditSelectedProjectForm(): void {
    const project = this.selectedProject;

    if (!project) {
      return;
    }

    this.cancelProjectNameEdit();
    this.projectForm = {
      ...project,
      tasks: project.tasks.map(task => ({
        ...task,
        prints: task.prints.map(print => ({ ...print }))
      }))
    };
    this.isProjectFormOpen = true;
  }

  closeProjectForm(): void {
    this.isProjectFormOpen = false;
    this.projectForm = this.createEmptyProject();
  }

  saveProject(): void {
    const name = this.projectForm.name.trim();
    const startDate = this.projectForm.startDate.trim();

    if (!name || !startDate) {
      return;
    }

    const project = this.normalizeProject({
      ...this.projectForm,
      name,
      startDate,
      description: this.projectForm.description.trim(),
      tasks: this.projectForm.tasks
    });

    this.projects = this.projectForm.id
      ? this.projects.map(item => item.id === project.id ? project : item)
      : [project, ...this.projects];
    this.persistProjects();
    this.closeProjectForm();
  }

  onProjectImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.projectForm.image = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.readAsDataURL(file);
  }

  removeProjectImage(): void {
    this.projectForm.image = '';
  }

  openCreateProjectTaskForm(): void {
    this.projectTaskForm = this.createEmptyProjectTask();
    this.projectTaskReturnId = '';
    this.isProjectTaskFormOpen = true;
    window.setTimeout(() => this.syncProjectTaskDescriptionEditor());
  }

  openEditProjectTaskForm(task: IProjectTask): void {
    this.projectTaskForm = { ...task };
    this.projectTaskReturnId = task.id;
    this.selectedProjectTask = null;
    this.isProjectTaskFormOpen = true;
    window.setTimeout(() => this.syncProjectTaskDescriptionEditor());
  }

  closeProjectTaskForm(): void {
    this.isProjectTaskFormOpen = false;
    this.projectTaskReturnId = '';
    this.closeProjectTaskPrintMenus();
    this.projectTaskForm = this.createEmptyProjectTask();
  }

  cancelProjectTaskForm(): void {
    const taskId = this.projectTaskReturnId;
    this.closeProjectTaskForm();
    this.returnToProjectTaskDetails(taskId);
  }

  saveProjectTask(): void {
    const project = this.selectedProject;
    const name = this.projectTaskForm.name.trim();

    if (!project || !name) {
      return;
    }

    const task = this.normalizeProjectTask({
      ...this.projectTaskForm,
      name
    });

    this.projects = this.projects.map(item => item.id === project.id
      ? {
          ...item,
          tasks: task.id && item.tasks.some(projectTask => projectTask.id === task.id)
            ? item.tasks.map(projectTask => projectTask.id === task.id ? task : projectTask)
            : [...item.tasks, task]
        }
      : item
    );
    this.persistProjects();
    if (task.status === 'done') {
      this.addTaskPrintsToHistory(task);
    }
    const taskId = this.projectTaskReturnId;
    this.closeProjectTaskForm();
    this.returnToProjectTaskDetails(taskId);
  }

  addProjectTaskPrint(): void {
    this.projectTaskForm.prints = [
      ...(this.projectTaskForm.prints || []),
      this.createEmptyTaskPrint()
    ];
  }

  removeProjectTaskPrint(index: number): void {
    this.projectTaskForm.prints = this.projectTaskForm.prints.filter((_, printIndex) => printIndex !== index);
  }

  onProjectTaskPrintImageSelected(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.projectTaskForm.prints = this.projectTaskForm.prints.map((print, printIndex) => printIndex === index
        ? { ...print, image: typeof reader.result === 'string' ? reader.result : '' }
        : print
      );
    };
    reader.readAsDataURL(file);
  }

  removeProjectTaskPrintImage(index: number): void {
    this.projectTaskForm.prints = this.projectTaskForm.prints.map((print, printIndex) => printIndex === index
      ? { ...print, image: '' }
      : print
    );
  }

  getTaskPrintFilamentName(print: IPrint): string {
    return print.filamentName || this.filamentInventory.find(filament => filament.id === print.filamentId)?.name || 'No filament selected';
  }

  confirmProjectTaskStatusChange(): void {
    const pendingChange = this.projectTaskPendingStatusChange;
    const duration = this.formatTaskDuration(this.pendingTaskDurationHours, this.pendingTaskDurationMinutes);

    if (!pendingChange || !duration) {
      return;
    }

    this.applyProjectTaskStatusChange(pendingChange.taskId, pendingChange.status, duration);
    this.projectTaskPendingStatusChange = null;
    this.resetPendingTaskDuration();
  }

  cancelProjectTaskStatusChange(): void {
    this.projectTaskPendingStatusChange = null;
    this.resetPendingTaskDuration();
  }

  toggleTaskPrintStatusMenu(index: number): void {
    this.openTaskPrintStatusIndex = this.openTaskPrintStatusIndex === index ? null : index;
    this.openTaskPrintFilamentIndex = null;
  }

  chooseTaskPrintStatus(index: number, status: string): void {
    this.projectTaskForm.prints[index].status = status;
    this.openTaskPrintStatusIndex = null;
  }

  toggleTaskPrintFilamentMenu(index: number): void {
    this.openTaskPrintFilamentIndex = this.openTaskPrintFilamentIndex === index ? null : index;
    this.openTaskPrintStatusIndex = null;
  }

  chooseTaskPrintFilament(index: number, filamentId: string): void {
    this.projectTaskForm.prints[index].filamentId = filamentId;
    this.openTaskPrintFilamentIndex = null;
  }

  getTaskPrintDurationHours(print: IPrint): number {
    return this.getDurationPart(print.time, 'h');
  }

  getTaskPrintDurationMinutes(print: IPrint): number {
    return this.getDurationPart(print.time, 'm');
  }

  updateTaskPrintDuration(index: number, part: 'hours' | 'minutes', value: number | string): void {
    const print = this.projectTaskForm.prints[index];
    const currentHours = this.getTaskPrintDurationHours(print);
    const currentMinutes = this.getTaskPrintDurationMinutes(print);
    const normalizedValue = Math.max(0, Math.floor(Number(value) || 0));
    const hours = part === 'hours' ? normalizedValue : currentHours;
    const minutes = part === 'minutes' ? Math.min(59, normalizedValue) : currentMinutes;

    this.projectTaskForm.prints[index].time = this.formatTaskPrintDuration(hours, minutes);
  }

  closeProjectTaskPrintMenus(): void {
    this.openTaskPrintStatusIndex = null;
    this.openTaskPrintFilamentIndex = null;
  }

  deleteSelectedProjectTask(): void {
    const project = this.selectedProject;
    const task = this.selectedProjectTask;

    if (!project || !task) {
      return;
    }

    this.projectTaskPendingDeletion = task;
  }

  confirmProjectTaskDeletion(): void {
    const project = this.selectedProject;
    const task = this.projectTaskPendingDeletion;

    if (!project || !task) {
      return;
    }

    this.projects = this.projects.map(item => item.id === project.id
      ? { ...item, tasks: item.tasks.filter(projectTask => projectTask.id !== task.id) }
      : item
    );
    this.selectedProjectTask = null;
    this.projectTaskPendingDeletion = null;
    this.persistProjects();
  }

  cancelProjectTaskDeletion(): void {
    this.projectTaskPendingDeletion = null;
  }

  onProjectTaskPictureSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.projectTaskForm.picture = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.readAsDataURL(file);
  }

  removeProjectTaskPicture(): void {
    this.projectTaskForm.picture = '';
  }

  updateProjectTaskDescription(event: Event): void {
    const editor = event.target as HTMLElement;
    this.projectTaskForm.description = editor.innerHTML.trim();
  }

  formatProjectTaskDescription(command: 'bold' | 'italic' | 'insertUnorderedList'): void {
    document.execCommand(command);
  }

  private syncProjectTaskDescriptionEditor(): void {
    if (this.projectTaskDescriptionEditor?.nativeElement) {
      this.projectTaskDescriptionEditor.nativeElement.innerHTML = this.projectTaskForm.description || '';
    }
  }

  private returnToProjectTaskDetails(taskId: string): void {
    if (!taskId) {
      return;
    }

    this.selectedProjectTask = this.selectedProject?.tasks.find(task => task.id === taskId) || null;
  }

  getProjectTasksByStatus(status: ProjectTaskStatus): IProjectTask[] {
    return this.selectedProject?.tasks.filter(task => task.status === status) || [];
  }

  getProjectTaskStatusClass(status: ProjectTaskStatus): string {
    return `task-status-${status.replace(/\s+/g, '-')}`;
  }

  openProjectTaskDetails(task: IProjectTask): void {
    if (this.suppressNextTaskClick) {
      this.suppressNextTaskClick = false;
      return;
    }

    this.selectedProjectTask = task;
  }

  startTaskDrag(task: IProjectTask, event?: DragEvent): void {
    this.draggedTaskId = task.id;
    event?.dataTransfer?.setData('text/plain', task.id);
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  startTaskPointerDrag(task: IProjectTask, event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    this.draggedTaskId = task.id;
    this.taskDragStartX = event.clientX;
    this.taskDragStartY = event.clientY;
    this.isTaskPointerDragging = false;
    this.hoveredTaskDropStatus = '';
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  trackTaskPointerDrag(event: PointerEvent): void {
    if (!this.draggedTaskId) {
      return;
    }

    const distanceX = Math.abs(event.clientX - this.taskDragStartX);
    const distanceY = Math.abs(event.clientY - this.taskDragStartY);
    this.isTaskPointerDragging = this.isTaskPointerDragging || distanceX > 6 || distanceY > 6;

    if (this.isTaskPointerDragging) {
      this.hoveredTaskDropStatus = this.getTaskDropStatusFromPoint(event.clientX, event.clientY);
    }
  }

  finishTaskPointerDrag(event: PointerEvent): void {
    if (!this.draggedTaskId) {
      return;
    }

    const taskId = this.draggedTaskId;
    const taskWasDragged = this.isTaskPointerDragging;
    const status = this.getTaskDropStatusFromPoint(event.clientX, event.clientY);

    if ((event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    }

    if (taskWasDragged && this.isProjectTaskStatus(status)) {
      this.dropTask(status);
      this.suppressNextTaskClick = true;
      this.isTaskPointerDragging = false;
      this.hoveredTaskDropStatus = '';
      return;
    }

    if (taskWasDragged) {
      this.suppressNextTaskClick = true;
    } else {
      const task = this.selectedProject?.tasks.find(projectTask => projectTask.id === taskId);
      if (task) {
        this.selectedProjectTask = task;
      }
    }

    this.clearTaskDrag();
    this.isTaskPointerDragging = false;
  }

  dropTask(status: ProjectTaskStatus): void {
    const taskId = this.draggedTaskId;

    if (!taskId) {
      return;
    }

    this.requestProjectTaskStatusChange(taskId, status);
    this.draggedTaskId = '';
  }

  private requestProjectTaskStatusChange(taskId: string, status: ProjectTaskStatus): void {
    const task = this.getSelectedProjectTaskById(taskId);

    if (!task || task.status === status) {
      return;
    }

    if (task.status === 'done' && status !== 'discontinued') {
      return;
    }

    if (status === 'done' && task.status !== 'done') {
      this.pendingTaskDurationHours = this.getDurationPart(task.duration, 'h');
      this.pendingTaskDurationMinutes = this.getDurationPart(task.duration, 'm');
      this.projectTaskPendingStatusChange = { taskId, status };
      return;
    }

    this.applyProjectTaskStatusChange(taskId, status);
  }

  private applyProjectTaskStatusChange(taskId: string, status: ProjectTaskStatus, duration?: string): void {
    const project = this.selectedProject;

    if (!project) {
      return;
    }

    const taskToUpdate = project.tasks.find(task => task.id === taskId);

    this.projects = this.projects.map(item => item.id === project.id
      ? {
          ...item,
          tasks: item.tasks.map(task => task.id === taskId ? { ...task, status, duration: duration ?? task.duration } : task)
        }
      : item
    );

    if (status === 'done' && taskToUpdate) {
      this.addTaskPrintsToHistory({ ...taskToUpdate, status, duration: duration ?? taskToUpdate.duration });
    }

    this.persistProjects();
  }

  clearTaskDrag(): void {
    this.draggedTaskId = '';
    this.isTaskPointerDragging = false;
    this.hoveredTaskDropStatus = '';
  }

  private isProjectTaskStatus(status?: string): status is ProjectTaskStatus {
    return this.projectTaskStatuses.includes(status as ProjectTaskStatus);
  }

  private getTaskDropStatusFromPoint(clientX: number, clientY: number): ProjectTaskStatus | '' {
    const target = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const column = target?.closest<HTMLElement>('[data-task-status]');
    const status = column?.dataset['taskStatus'];

    return this.isProjectTaskStatus(status) ? status : '';
  }

  private getSelectedProjectTaskById(taskId: string): IProjectTask | null {
    return this.selectedProject?.tasks.find(task => task.id === taskId) || null;
  }

  private getDurationPart(time: string, unit: 'h' | 'm'): number {
    const match = time.match(unit === 'h' ? /(\d+)\s*h/i : /(\d+)\s*m/i);
    return match ? Number(match[1]) : 0;
  }

  private formatTaskDuration(hours: number | string, minutes: number | string): string {
    const normalizedHours = Math.max(0, Math.floor(Number(hours) || 0));
    const normalizedMinutes = Math.max(0, Math.min(59, Math.floor(Number(minutes) || 0)));

    if (!normalizedHours && !normalizedMinutes) {
      return '';
    }

    return `${normalizedHours}h ${normalizedMinutes.toString().padStart(2, '0')}m`;
  }

  private resetPendingTaskDuration(): void {
    this.pendingTaskDurationHours = 0;
    this.pendingTaskDurationMinutes = 0;
  }

  private formatTaskPrintDuration(hours: number, minutes: number): string {
    if (!hours && !minutes) {
      return '';
    }

    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
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
    localStorage.removeItem(`${this.projectsStorageKey}-${profile.id}`);

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

  private loadProjects(): void {
    if (!this.activeProfileId) {
      this.projects = [];
      return;
    }

    const storageKey = this.getProjectsStorageKey();
    const savedProjects = localStorage.getItem(storageKey);

    if (!savedProjects) {
      this.projects = [];
      this.persistProjects();
      return;
    }

    try {
      this.projects = (JSON.parse(savedProjects) as Array<Partial<IProject>>)
        .filter(project => project.name && project.startDate)
        .map(project => this.normalizeProject(project));
      this.persistProjects();
    } catch {
      localStorage.removeItem(storageKey);
      this.projects = [];
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

  private persistProjects(): void {
    if (!this.activeProfileId) {
      return;
    }

    localStorage.setItem(this.getProjectsStorageKey(), JSON.stringify(this.projects));
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

  private getProjectsStorageKey(): string {
    return `${this.projectsStorageKey}-${this.activeProfileId}`;
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

  private createProjectId(): string {
    return `project-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private createProjectTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private createEmptyProject(): IProject {
    return {
      id: '',
      name: '',
      image: '',
      description: '',
      startDate: new Date().toISOString().slice(0, 10),
      tasks: []
    };
  }

  private createEmptyProjectTask(status: ProjectTaskStatus = 'to do'): IProjectTask {
    return {
      id: '',
      name: '',
      description: '',
      duration: '',
      picture: '',
      status,
      prints: []
    };
  }

  private createEmptyTaskPrint(): IPrint {
    return {
      id: this.createPrintId(),
      name: '',
      filament: 0,
      filamentId: '',
      filamentName: '',
      filamentColor: '',
      cost: 0,
      time: '',
      status: 'success',
      date: new Date().toISOString().slice(0, 10),
      image: '',
      description: '',
      errorDescription: ''
    };
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

  private normalizeProject(project: Partial<IProject>): IProject {
    return {
      id: project.id || this.createProjectId(),
      name: project.name?.trim() || 'Untitled project',
      image: project.image || '',
      description: project.description?.trim() || '',
      startDate: project.startDate || new Date().toISOString().slice(0, 10),
      tasks: Array.isArray(project.tasks)
        ? project.tasks.map(task => this.normalizeProjectTask(task))
        : []
    };
  }

  private normalizeProjectTask(task: Partial<IProjectTask>): IProjectTask {
    return {
      id: task.id || this.createProjectTaskId(),
      name: task.name?.trim() || 'Untitled task',
      description: task.description?.trim() || '',
      duration: task.duration?.trim() || '',
      picture: task.picture || '',
      status: this.normalizeProjectTaskStatus(task.status),
      prints: Array.isArray(task.prints)
        ? task.prints
            .filter(print => Boolean(print.name?.trim()))
            .map(print => this.normalizeTaskPrint(print))
        : []
    };
  }

  private normalizeTaskPrint(print: Partial<IPrint>): IPrint {
    const filament = this.filamentInventory.find(item => item.id === print.filamentId);

    return {
      id: print.id || this.createPrintId(),
      name: print.name?.trim() || 'Untitled print',
      filament: Number(print.filament) || 0,
      filamentId: filament?.id || print.filamentId || '',
      filamentName: filament?.name || print.filamentName || '',
      filamentColor: filament?.color || print.filamentColor || '',
      cost: Number(print.cost) || 0,
      time: print.time?.trim() || '',
      status: this.printStatuses.includes(print.status || '') ? print.status || 'success' : 'success',
      date: print.date || new Date().toISOString().slice(0, 10),
      image: print.image || '',
      description: print.description?.trim() || '',
      errorDescription: print.errorDescription?.trim() || ''
    };
  }

  private addTaskPrintsToHistory(task: IProjectTask): void {
    const printsToAdd = task.prints
      .map(print => this.normalizeTaskPrint(print))
      .filter(print => print.name.trim() && !this.printingHistory.some(historyPrint => historyPrint.id === print.id));

    if (!printsToAdd.length) {
      return;
    }

    this.printingHistory = this.sortPrints([...printsToAdd, ...this.printingHistory]);
    printsToAdd.forEach(print => this.applyFilamentUsage(print));
    this.notifyEmptyFilament();
    this.persistPrintingHistory();
    this.updateActiveProfilePrintCount();
  }

  private normalizeProjectTaskStatus(status?: string): ProjectTaskStatus {
    const allowedStatuses: ProjectTaskStatus[] = ['to do', 'doing', 'on hold', 'ready for review', 'done', 'discontinued'];

    return allowedStatuses.includes(status as ProjectTaskStatus)
      ? status as ProjectTaskStatus
      : 'to do';
  }

  private parseProfileExport(value: string): IPrintrJornyProfileFile {
    const data = JSON.parse(value) as Partial<IPrintrJornyProfileFile>;

    if (
      data.format !== 'printr-jorny-profile' ||
      data.version !== 1 ||
      !data.profile?.userName ||
      !data.profile.printerModel ||
      !Array.isArray(data.printingHistory) ||
      !Array.isArray(data.filamentInventory) ||
      (data.projects !== undefined && !Array.isArray(data.projects))
    ) {
      throw new Error('Invalid Printr Jorny profile file.');
    }

    return {
      format: 'printr-jorny-profile',
      version: 1,
      exportedAt: data.exportedAt || new Date().toISOString(),
      profile: data.profile,
      printingHistory: data.printingHistory,
      filamentInventory: data.filamentInventory,
      projects: (data.projects || []).map(project => this.normalizeProject(project))
    };
  }

  private parseProjectExport(value: string): IPrintrJornyProjectFile {
    const data = JSON.parse(value) as Partial<IPrintrJornyProjectFile>;

    if (
      data.format !== 'printr-jorny-project' ||
      data.version !== 1 ||
      !data.project?.name ||
      !data.project.startDate
    ) {
      throw new Error('Invalid Printr Jorny project file.');
    }

    return {
      format: 'printr-jorny-project',
      version: 1,
      exportedAt: data.exportedAt || new Date().toISOString(),
      project: this.normalizeProject(data.project)
    };
  }

  private createImportedProjectCopy(project: IProject): IProject {
    return {
      ...project,
      id: this.createProjectId(),
      name: project.name.trim().endsWith(' - imported') ? project.name.trim() : `${project.name.trim()} - imported`,
      tasks: project.tasks.map(task => ({
        ...task,
        id: this.createProjectTaskId(),
        prints: task.prints.map(print => ({
          ...print,
          id: this.createPrintId()
        }))
      }))
    };
  }

  private getExportFileName(value: string): string {
    return (value || 'profile')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'profile';
  }

  private async saveJsonFile(data: unknown, fileName: string, description: string, extensions: string[]): Promise<void> {
    const contents = JSON.stringify(data, null, 2);

    if ('__TAURI_INTERNALS__' in window) {
      const selectedPath = await save({
        defaultPath: fileName,
        filters: [
          {
            name: description,
            extensions: extensions.map(extension => extension.replace(/^\./, ''))
          }
        ]
      });

      if (!selectedPath) {
        return;
      }

      await invoke('write_export_file', { path: selectedPath, contents });
      return;
    }

    const showSaveFilePicker = (window as any).showSaveFilePicker;

    if (typeof showSaveFilePicker === 'function') {
      try {
        const handle = await showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description,
              accept: {
                'application/json': extensions
              }
            }
          ]
        });
        const writable = await handle.createWritable();
        await writable.write(contents);
        await writable.close();
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        throw error;
      }

      return;
    }

    this.downloadJsonFile(data, fileName);
  }

  private downloadJsonFile(data: unknown, fileName: string): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = fileName;
    downloadLink.click();
    URL.revokeObjectURL(url);
  }

  private getTauriWindow(): TauriWindow | null {
    if (!('__TAURI_INTERNALS__' in window)) {
      return null;
    }

    return getCurrentWindow();
  }
}
