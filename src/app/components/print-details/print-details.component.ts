import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IPrint } from '../../interfaces/print.interface';

@Component({
  selector: 'print-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './print-details.component.html',
  styleUrls: ['./print-details.component.css']
})
export class PrintDetailsComponent {
  @Input() item!: IPrint;
  @Output() close = new EventEmitter<void>();

  closeModal() {
    this.close.emit();
  }
}
