import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IPrint } from '../../interfaces/print.interface';

@Component({
  selector: 'last-printed',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './last-printed.component.html',
  styleUrls: ['./last-printed.component.css']
})
export class LastPrintedComponent {
  @Input() item: IPrint | null = null;
}
