import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IPrint } from '../../interfaces/print.interface';
import { IFilament } from '../../interfaces/filament.interface';

@Component({
  selector: 'print-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './print-form.component.html',
  styleUrls: ['./print-form.component.css']
})
export class PrintFormComponent implements OnChanges {
  @Input() item: IPrint | null = null;
  @Input() filaments: IFilament[] = [];
  @Output() save = new EventEmitter<IPrint>();
  @Output() cancel = new EventEmitter<void>();

  statuses = ['success', 'passed poorly', 'failed'];
  isFilamentMenuOpen = false;
  isStatusMenuOpen = false;
  durationHours = 0;
  durationMinutes = 0;

  formPrint: IPrint = this.createEmptyPrint();

  get isEditing(): boolean {
    return Boolean(this.item);
  }

  get selectedFilament(): IFilament | undefined {
    return this.filaments.find(filament => filament.id === this.formPrint.filamentId);
  }

  get hasDuration(): boolean {
    return Number(this.durationHours) > 0 || Number(this.durationMinutes) > 0;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['item']) {
      this.formPrint = this.item ? { ...this.item } : this.createEmptyPrint();
      this.setDurationFields(this.formPrint.time);
      this.isFilamentMenuOpen = false;
      this.isStatusMenuOpen = false;
    }
  }

  toggleStatusMenu(): void {
    this.isStatusMenuOpen = !this.isStatusMenuOpen;
  }

  closeStatusMenu(): void {
    this.isStatusMenuOpen = false;
  }

  chooseStatus(status: string): void {
    this.formPrint.status = status as IPrint['status'];
    this.closeStatusMenu();
  }

  toggleFilamentMenu(): void {
    this.isFilamentMenuOpen = !this.isFilamentMenuOpen;
  }

  closeFilamentMenu(): void {
    this.isFilamentMenuOpen = false;
  }

  closeMenus(): void {
    this.closeFilamentMenu();
    this.closeStatusMenu();
  }

  chooseFilament(filament: IFilament): void {
    this.formPrint.filamentId = filament.id;
    this.closeFilamentMenu();
  }

  savePrint(): void {
    const name = this.formPrint.name.trim();
    const date = this.formPrint.date.trim();
    const time = this.formatDuration();
    const selectedFilament = this.filaments.find(filament => filament.id === this.formPrint.filamentId);

    if (!name || !date || !time || !selectedFilament) {
      return;
    }

    this.save.emit({
      ...this.formPrint,
      name,
      date,
      time,
      filament: Number(this.formPrint.filament) || 0,
      filamentId: selectedFilament.id,
      filamentName: selectedFilament.name,
      filamentColor: selectedFilament.color,
      cost: Number(this.formPrint.cost) || 0,
      image: this.formPrint.image || '',
      description: this.formPrint.description?.trim(),
      errorDescription: this.formPrint.errorDescription?.trim()
    });
  }

  onPrintImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.formPrint.image = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.readAsDataURL(file);
  }

  removePrintImage(): void {
    this.formPrint.image = '';
  }

  private createEmptyPrint(): IPrint {
    this.setDurationFields('');

    return {
      id: '',
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

  private setDurationFields(time: string): void {
    const hoursMatch = time.match(/(\d+)\s*h/i);
    const minutesMatch = time.match(/(\d+)\s*m/i);

    this.durationHours = hoursMatch ? Number(hoursMatch[1]) : 0;
    this.durationMinutes = minutesMatch ? Number(minutesMatch[1]) : 0;
  }

  private formatDuration(): string {
    const hours = Math.max(0, Math.floor(Number(this.durationHours) || 0));
    const minutes = Math.max(0, Math.min(59, Math.floor(Number(this.durationMinutes) || 0)));

    if (!hours && !minutes) {
      return '';
    }

    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }
}
