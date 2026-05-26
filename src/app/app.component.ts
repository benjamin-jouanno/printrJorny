import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrtjryHeaderComponent } from './components/prtjry-header/prtjry-header.component';
import { PrtjryHistoryComponent } from './components/prtjry-history/prtjry-history.component';
import { PrintDetailsComponent } from './components/print-details/print-details.component';
import { IPrint } from './interfaces/print.interface';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, PrtjryHeaderComponent, PrtjryHistoryComponent, PrintDetailsComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  selectedPrint: IPrint | null = null;
  userName = 'Benjamin Jouanno';
  printerName = 'Printr Jorny';
  printerStatus = 'Ready';
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
    { name: 'Calibration cube', filament: 12, cost: 0.48, time: '1h 12m', status: 'success', description: 'Baseline calibration object used for leveling and flow tuning.' },
    { name: 'Phone holder', filament: 28, cost: 1.12, time: '2h 03m', status: 'passed poorly', description: 'Utility phone mount with thin walls, had slight underextrusion near the clip.' },
    { name: 'Enclosure hinge', filament: 6, cost: 0.24, time: '0h 35m', status: 'failed', description: 'Small hinge print that failed due to a loose bed attachment midway.' },
    { name: 'Cable clip', filament: 3, cost: 0.12, time: '0h 12m', status: 'success', description: 'Simple cable management clip printed cleanly with no issues.' }
  ];
}
