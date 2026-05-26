import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IPrint } from '../../interfaces/print.interface';

@Component({
  selector: 'print-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './print-form.component.html',
  styleUrls: ['./print-form.component.css']
})
export class PrintFormComponent implements OnChanges {
  @Input() item: IPrint | null = null;
  @Output() save = new EventEmitter<IPrint>();
  @Output() cancel = new EventEmitter<void>();

  statuses = ['success', 'passed poorly', 'failed'];

  formPrint: IPrint = this.createEmptyPrint();

  get isEditing(): boolean {
    return Boolean(this.item);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['item']) {
      this.formPrint = this.item ? { ...this.item } : this.createEmptyPrint();
    }
  }

  savePrint(): void {
    const name = this.formPrint.name.trim();
    const date = this.formPrint.date.trim();
    const time = this.formPrint.time.trim();

    if (!name || !date || !time) {
      return;
    }

    this.save.emit({
      ...this.formPrint,
      name,
      date,
      time,
      filament: Number(this.formPrint.filament) || 0,
      cost: Number(this.formPrint.cost) || 0,
      description: this.formPrint.description?.trim(),
      errorDescription: this.formPrint.errorDescription?.trim()
    });
  }

  private createEmptyPrint(): IPrint {
    return {
      id: '',
      name: '',
      filament: 0,
      cost: 0,
      time: '',
      status: 'success',
      date: new Date().toISOString().slice(0, 10),
      description: '',
      errorDescription: ''
    };
  }
}
