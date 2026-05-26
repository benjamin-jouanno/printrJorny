import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IFilament } from '../../interfaces/filament.interface';

@Component({
  selector: 'filament-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './filament-form.component.html',
  styleUrls: ['./filament-form.component.css']
})
export class FilamentFormComponent {
  @Output() save = new EventEmitter<Omit<IFilament, 'id'>>();
  @Output() cancel = new EventEmitter<void>();

  filamentBrands = [
    {
      brand: 'Bambu Lab',
      names: ['PLA Basic', 'PLA Matte', 'PETG HF', 'ABS', 'ASA', 'TPU 95A']
    },
    {
      brand: 'Prusament',
      names: ['PLA Galaxy Black', 'PLA Prusa Orange', 'PETG Jet Black', 'ASA Prusa Galaxy Black', 'PC Blend']
    },
    {
      brand: 'Polymaker',
      names: ['PolyLite PLA', 'PolyTerra PLA', 'PolyLite PETG', 'PolyFlex TPU95', 'PolyMax PC']
    },
    {
      brand: 'eSUN',
      names: ['PLA+', 'PETG', 'ABS+', 'eTPU-95A', 'PA-CF']
    },
    {
      brand: 'Overture',
      names: ['PLA', 'Matte PLA', 'PETG', 'ABS', 'TPU']
    },
    {
      brand: 'Sunlu',
      names: ['PLA+', 'PLA Meta', 'PETG', 'ABS', 'TPU']
    }
  ];

  selectedFilament = '';
  color = '#80ffdb';
  quantityGrams = 1000;
  isFilamentMenuOpen = false;

  get selectedFilamentLabel(): string {
    const option = this.findSelectedFilament();

    return option ? `${option.brand} - ${option.name}` : '';
  }

  toggleFilamentMenu(): void {
    this.isFilamentMenuOpen = !this.isFilamentMenuOpen;
  }

  closeFilamentMenu(): void {
    this.isFilamentMenuOpen = false;
  }

  chooseFilament(name: string): void {
    this.selectedFilament = name;
    this.closeFilamentMenu();
  }

  saveFilament(): void {
    const option = this.findSelectedFilament();

    if (!option || this.quantityGrams <= 0) {
      return;
    }

    this.save.emit({
      brand: option.brand,
      name: `${option.brand} - ${option.name}`,
      color: this.color,
      initialQuantityGrams: Number(this.quantityGrams),
      quantityGrams: Number(this.quantityGrams)
    });
  }

  private findSelectedFilament(): { brand: string; name: string } | null {
    for (const group of this.filamentBrands) {
      if (group.names.includes(this.selectedFilament)) {
        return {
          brand: group.brand,
          name: this.selectedFilament
        };
      }
    }

    return null;
  }
}
