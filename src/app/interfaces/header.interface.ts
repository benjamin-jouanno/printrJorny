import { IPrinterConnection } from './printer-status.interface';

export interface IHeader {
  id?: string;
  userName: string;
  printerModel: string;
  profilePicture?: string;
  printerConnection?: IPrinterConnection;
}
