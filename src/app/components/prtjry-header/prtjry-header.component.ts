import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'prtjry-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './prtjry-header.component.html',
  styleUrls: ['./prtjry-header.component.css']
})
export class PrtjryHeaderComponent {
  @Input() userName = '';
  @Input() printerName = '';
  @Input() printerStatus = '';
}
