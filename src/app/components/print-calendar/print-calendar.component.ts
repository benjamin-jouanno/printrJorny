import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IPrint } from '../../interfaces/print.interface';

interface CalendarDay {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  prints: IPrint[];
}

interface CalendarMonth {
  date: Date;
  label: string;
  prints: IPrint[];
}

type CalendarView = 'week' | 'month' | 'year';

@Component({
  selector: 'print-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './print-calendar.component.html',
  styleUrls: ['./print-calendar.component.css']
})
export class PrintCalendarComponent {
  @Input() items: IPrint[] = [];
  @Output() select = new EventEmitter<IPrint>();
  @Output() addPrint = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();

  readonly weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  readonly monthOptions = Array.from({ length: 12 }, (_, index) => ({
    value: index,
    label: new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2024, index, 1))
  }));
  readonly calendarViews: CalendarView[] = ['week', 'month', 'year'];
  activeView: CalendarView = 'week';
  visibleDate = this.getDayStart(new Date());
  isMonthMenuOpen = false;
  isYearMenuOpen = false;

  get selectedMonth(): number {
    return this.visibleDate.getMonth();
  }

  get selectedMonthLabel(): string {
    return this.monthOptions.find(month => month.value === this.selectedMonth)?.label || '';
  }

  get selectedYear(): number {
    return this.visibleDate.getFullYear();
  }

  get yearOptions(): number[] {
    const years = this.items
      .map(item => this.parsePrintDate(item.date).getFullYear())
      .filter(year => Number.isFinite(year))
      .sort((a, b) => b - a);

    return [...new Set(years)];
  }

  get canChooseYear(): boolean {
    return this.yearOptions.length > 0;
  }

  get periodLabel(): string {
    if (this.activeView === 'week') {
      const days = this.visibleDays;
      const firstDay = days[0]?.date || this.visibleDate;
      const lastDay = days[days.length - 1]?.date || this.visibleDate;
      const firstLabel = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(firstDay);
      const lastLabel = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(lastDay);

      return `${firstLabel} - ${lastLabel}`;
    }

    if (this.activeView === 'year') {
      return `${this.selectedYear}`;
    }

    return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(this.visibleDate);
  }

  get visibleDays(): CalendarDay[] {
    return this.activeView === 'week' ? this.getWeekDays() : this.getMonthDays();
  }

  get yearMonths(): CalendarMonth[] {
    return Array.from({ length: 12 }, (_, monthIndex) => {
      const date = new Date(this.selectedYear, monthIndex, 1);

      return {
        date,
        label: new Intl.DateTimeFormat('en', { month: 'long' }).format(date),
        prints: this.getPrintsForMonth(date)
      };
    });
  }

  selectView(view: CalendarView): void {
    this.activeView = view;
  }

  toggleMonthMenu(): void {
    this.isMonthMenuOpen = !this.isMonthMenuOpen;
    this.isYearMenuOpen = false;
  }

  toggleYearMenu(): void {
    this.isYearMenuOpen = !this.isYearMenuOpen;
    this.isMonthMenuOpen = false;
  }

  closeMenus(): void {
    this.isMonthMenuOpen = false;
    this.isYearMenuOpen = false;
  }

  previousPeriod(): void {
    if (this.activeView === 'week') {
      this.visibleDate = this.addDays(this.visibleDate, -7);
      return;
    }

    if (this.activeView === 'year') {
      this.visibleDate = new Date(this.selectedYear - 1, this.selectedMonth, 1);
      return;
    }

    this.visibleDate = new Date(this.selectedYear, this.selectedMonth - 1, 1);
  }

  nextPeriod(): void {
    if (this.activeView === 'week') {
      this.visibleDate = this.addDays(this.visibleDate, 7);
      return;
    }

    if (this.activeView === 'year') {
      this.visibleDate = new Date(this.selectedYear + 1, this.selectedMonth, 1);
      return;
    }

    this.visibleDate = new Date(this.selectedYear, this.selectedMonth + 1, 1);
  }

  goToToday(): void {
    this.visibleDate = this.getDayStart(new Date());
  }

  chooseMonth(month: number): void {
    this.visibleDate = new Date(this.selectedYear, month, 1);
    this.closeMenus();
  }

  chooseYear(year: number): void {
    if (!this.canChooseYear) {
      return;
    }

    this.visibleDate = new Date(year, this.selectedMonth, 1);
    this.closeMenus();
  }

  private getMonthDays(): CalendarDay[] {
    const firstDay = this.getMonthStart(this.visibleDate);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const gridStart = new Date(firstDay);
    gridStart.setDate(firstDay.getDate() - startOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);

      return {
        date,
        dayNumber: date.getDate(),
        isCurrentMonth: date.getMonth() === this.visibleDate.getMonth(),
        isToday: this.getDateKey(date) === this.getDateKey(new Date()),
        prints: this.getPrintsForDate(date)
      };
    });
  }

  private getWeekDays(): CalendarDay[] {
    const startOffset = (this.visibleDate.getDay() + 6) % 7;
    const weekStart = this.addDays(this.visibleDate, -startOffset);

    return Array.from({ length: 7 }, (_, index) => {
      const date = this.addDays(weekStart, index);

      return {
        date,
        dayNumber: date.getDate(),
        isCurrentMonth: true,
        isToday: this.getDateKey(date) === this.getDateKey(new Date()),
        prints: this.getPrintsForDate(date)
      };
    });
  }

  private getPrintsForDate(date: Date): IPrint[] {
    const dateKey = this.getDateKey(date);

    return this.items.filter(item => this.getDateKey(this.parsePrintDate(item.date)) === dateKey);
  }

  private getPrintsForMonth(date: Date): IPrint[] {
    const year = date.getFullYear();
    const month = date.getMonth();

    return this.items.filter(item => {
      const printDate = this.parsePrintDate(item.date);
      return printDate.getFullYear() === year && printDate.getMonth() === month;
    });
  }

  private parsePrintDate(value: string): Date {
    return new Date(value.includes('T') ? value : `${value}T00:00:00`);
  }

  private addDays(date: Date, amount: number): Date {
    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + amount);

    return this.getDayStart(nextDate);
  }

  private getDayStart(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private getMonthStart(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private getDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
