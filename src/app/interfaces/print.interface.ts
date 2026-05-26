export interface IPrint {
  id: string;
  name: string;
  filament: number;
  cost: number;
  time: string;
  status: string;
  date: string;
  description?: string;
  errorDescription?: string;
}
