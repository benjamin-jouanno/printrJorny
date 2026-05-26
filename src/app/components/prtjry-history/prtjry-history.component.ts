import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IPrint } from '../../interfaces/print.interface';

@Component({
  selector: 'prtjry-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './prtjry-history.component.html',
  styleUrls: ['./prtjry-history.component.css']
})
export class PrtjryHistoryComponent {
  @Input() items: IPrint[] = [];
  @Output() select = new EventEmitter<IPrint>();
}
