import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IHeader } from '../../interfaces/header.interface';

@Component({
  selector: 'profile-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile-form.component.html',
  styleUrls: ['./profile-form.component.css']
})
export class ProfileFormComponent implements OnChanges {
  private readonly customPrinterModelOption = 'Custom / Other';

  @Input() profile: IHeader | null = null;
  @Output() save = new EventEmitter<IHeader>();
  @Output() cancel = new EventEmitter<void>();

  printerBrands = [
    { brand: 'Anycubic', models: ['Anycubic Kobra 2', 'Anycubic Kobra 2 Max', 'Anycubic Kobra 2 Neo', 'Anycubic Kobra 3', 'Anycubic Kobra 3 Combo', 'Anycubic Photon Mono 2', 'Anycubic Photon Mono M5s', 'Anycubic Photon Mono X 6Ks'] },
    { brand: 'Bambu Lab', models: ['Bambu Lab A1', 'Bambu Lab A1 mini', 'Bambu Lab H2D', 'Bambu Lab P1P', 'Bambu Lab P1S', 'Bambu Lab X1 Carbon', 'Bambu Lab X1E'] },
    { brand: 'Creality', models: ['Creality CR-10 SE', 'Creality Ender-3', 'Creality Ender-3 S1', 'Creality Ender-3 V2', 'Creality Ender-3 V3', 'Creality Ender-3 V3 KE', 'Creality Ender-3 V3 SE', 'Creality Ender-5 S1', 'Creality K1', 'Creality K1 Max', 'Creality K1C', 'Creality K2 Plus'] },
    { brand: 'Elegoo', models: ['Elegoo Mars 4', 'Elegoo Mars 5 Ultra', 'Elegoo Neptune 3 Pro', 'Elegoo Neptune 4', 'Elegoo Neptune 4 Max', 'Elegoo Neptune 4 Plus', 'Elegoo Neptune 4 Pro', 'Elegoo Saturn 3 Ultra', 'Elegoo Saturn 4 Ultra'] },
    { brand: 'Flashforge', models: ['Flashforge Adventurer 4', 'Flashforge Adventurer 5M', 'Flashforge Adventurer 5M Pro', 'Flashforge Creator Pro 2'] },
    { brand: 'Formlabs', models: ['Formlabs Form 3+', 'Formlabs Form 4'] },
    { brand: 'Prusa', models: ['Original Prusa i3 MK3S+', 'Prusa CORE One', 'Prusa MINI+', 'Prusa MK4', 'Prusa MK4S', 'Prusa SL1S Speed', 'Prusa XL'] },
    { brand: 'Qidi', models: ['Qidi Plus4', 'Qidi Q1 Pro', 'Qidi X-Max 3', 'Qidi X-Plus 3'] },
    { brand: 'Raise3D', models: ['Raise3D E2', 'Raise3D Pro2', 'Raise3D Pro3'] },
    { brand: 'Sovol', models: ['Sovol SV06', 'Sovol SV07', 'Sovol SV08'] },
    { brand: 'Ultimaker', models: ['Ultimaker S3', 'Ultimaker S5', 'Ultimaker S7'] },
    { brand: 'Voron', models: ['Voron 0.2', 'Voron 2.4', 'Voron Switchwire', 'Voron Trident'] },
    { brand: 'Other', models: [this.customPrinterModelOption] }
  ];

  formProfile: IHeader = {
    id: '',
    userName: '',
    printerModel: '',
    profilePicture: ''
  };
  customPrinterModel = '';

  get isCustomPrinterModelSelected(): boolean {
    return this.formProfile.printerModel === this.customPrinterModelOption;
  }

  get profileInitials(): string {
    const nameParts = this.formProfile.userName.trim().split(/\s+/).filter(Boolean);
    const initials = nameParts.slice(0, 2).map(part => part[0]).join('');

    return initials.toUpperCase() || 'ID';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['profile'] && this.profile) {
      const knownModels = this.printerBrands.flatMap(group => group.models);
      const printerModel = knownModels.includes(this.profile.printerModel)
        ? this.profile.printerModel
        : this.customPrinterModelOption;

      this.formProfile = {
        ...this.profile,
        printerModel
      };
      this.customPrinterModel = printerModel === this.customPrinterModelOption ? this.profile.printerModel : '';
    }
  }

  saveProfile(): void {
    const userName = this.formProfile.userName.trim();
    const printerModel = this.isCustomPrinterModelSelected
      ? this.customPrinterModel.trim()
      : this.formProfile.printerModel.trim();

    if (!userName || !printerModel) {
      return;
    }

    this.save.emit({
      ...this.formProfile,
      userName,
      printerModel
    });
  }

  onProfilePictureSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.formProfile.profilePicture = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.readAsDataURL(file);
  }

  removeProfilePicture(): void {
    this.formProfile.profilePicture = '';
  }
}
