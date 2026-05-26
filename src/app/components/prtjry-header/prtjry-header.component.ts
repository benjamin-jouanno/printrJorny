import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IHeader } from '../../interfaces/header.interface';

@Component({
  selector: 'prtjry-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './prtjry-header.component.html',
  styleUrls: ['./prtjry-header.component.css']
})
export class PrtjryHeaderComponent {
  @Input() data: IHeader = {
    userName: '',
    printerModel: '',
    profilePicture: '',
  };
  @Output() addPrint = new EventEmitter<void>();
  @Output() switchProfile = new EventEmitter<void>();
  @Output() editProfile = new EventEmitter<void>();

  get initials(): string {
    const nameParts = this.data.userName.trim().split(/\s+/).filter(Boolean);
    const initials = nameParts.slice(0, 2).map(part => part[0]).join('');

    return initials.toUpperCase() || 'ID';
  }
}
