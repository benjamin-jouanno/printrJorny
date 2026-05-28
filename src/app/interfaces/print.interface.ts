export interface IPrint {
  id: string;
  name: string;
  filament: number;
  filamentId?: string;
  filamentName?: string;
  filamentColor?: string;
  cost: number;
  time: string;
  status: string;
  date: string;
  image?: string;
  description?: string;
  errorDescription?: string;
}
