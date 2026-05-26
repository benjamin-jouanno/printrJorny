import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IFilament } from '../../interfaces/filament.interface';

@Component({
  selector: 'filament-type',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './filament-type.component.html',
  styleUrls: ['./filament-type.component.css']
})
export class FilamentTypeComponent {
  @Input() filaments: IFilament[] = [];
  @Output() addFilament = new EventEmitter<void>();

  getTotalRemaining(): number {
    return this.filaments.reduce((total, filament) => total + filament.quantityGrams, 0);
  }

  getQuantityPercent(filament: IFilament): number {
    const initialQuantity = filament.initialQuantityGrams || filament.quantityGrams;

    if (!initialQuantity) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round((filament.quantityGrams / initialQuantity) * 100)));
  }

  isLowQuantity(filament: IFilament): boolean {
    return this.getQuantityPercent(filament) < 15;
  }
}
