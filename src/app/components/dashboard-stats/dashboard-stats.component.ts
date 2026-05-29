import { Component, Input, AfterViewInit, OnChanges, OnDestroy, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IPrint } from '../../interfaces/print.interface';

type GraphRange = 'last-7-days' | 'last-month' | 'last-year' | 'all-time';

@Component({
  selector: 'dashboard-stats',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard-stats.component.html',
  styleUrls: ['./dashboard-stats.component.css']
})
export class DashboardStatsComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() currentJob = '';
  @Input() activeMaterial = '';
  @Input() nozzleTemperature = 0;
  @Input() bedTemperature = 0;
  @Input() printProgress = 0;
  @Input() stats: Array<{ label: string; value: string; detail: string }> = [];
  @Input() prints: IPrint[] = [];
  @Input() themeMode: 'dark' | 'light' = 'dark';

  @ViewChild('chartCanvas', { static: false }) canvas!: ElementRef<HTMLCanvasElement>;
  selectedGraphRange: GraphRange = 'last-7-days';
  isGraphRangeMenuOpen = false;
  readonly graphRanges: Array<{ label: string; value: GraphRange }> = [
    { label: 'Last 7 days', value: 'last-7-days' },
    { label: 'Last month', value: 'last-month' },
    { label: 'Last year', value: 'last-year' },
    { label: 'All time', value: 'all-time' }
  ];
  private chart: any;

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['prints'] || changes['themeMode']) && !changes['prints']?.firstChange) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    if (this.chart) {
      try { this.chart.destroy(); } catch (e) { /* ignore */ }
    }
  }

  updateGraphRange(): void {
    this.renderChart();
  }

  toggleGraphRangeMenu(): void {
    this.isGraphRangeMenuOpen = !this.isGraphRangeMenuOpen;
  }

  closeGraphRangeMenu(): void {
    this.isGraphRangeMenuOpen = false;
  }

  chooseGraphRange(range: GraphRange): void {
    this.selectedGraphRange = range;
    this.closeGraphRangeMenu();
    this.renderChart();
  }

  getSelectedGraphRangeLabel(): string {
    return this.graphRanges.find(range => range.value === this.selectedGraphRange)?.label || 'Last 7 days';
  }

  private async renderChart() {
    if (!this.canvas) return;
    const module = await import('chart.js/auto');
    const Chart = (module as any).default ?? module;

    // prepare chronological data (oldest -> newest)
    const sorted = this.getFilteredPrints()
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const labels = sorted.map(p => p.date);
    const filamentData = sorted.map(p => Number(p.filament ?? 0));
    const costData = sorted.map(p => Number(p.cost ?? 0));

    const maxFilament = filamentData.length ? Math.max(...filamentData) : 0;
    const maxCost = costData.length ? Math.max(...costData) : 0;
    const chartColors = this.themeMode === 'light'
      ? {
          text: '#3d4d63',
          title: '#142033',
          tooltipBg: 'rgba(255, 255, 255, 0.96)',
          tooltipBorder: 'rgba(15, 23, 42, 0.14)',
          filament: '#0ca678',
          filamentFill: 'rgba(12, 166, 120, 0.12)',
          grid: 'rgba(15, 23, 42, 0.1)',
          axis: 'rgba(15, 23, 42, 0.18)'
        }
      : {
          text: '#c7d0dc',
          title: '#edf2f7',
          tooltipBg: 'rgba(12, 18, 28, 0.96)',
          tooltipBorder: 'rgba(255, 255, 255, 0.12)',
          filament: '#80ffdb',
          filamentFill: 'rgba(128, 255, 219, 0.12)',
          grid: 'rgba(199, 208, 220, 0.1)',
          axis: 'rgba(199, 208, 220, 0.2)'
        };

    const ctx = this.canvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.chart) {
      try { this.chart.destroy(); } catch (e) { /* ignore */ }
    }

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Filament (g)',
            data: filamentData,
            borderColor: chartColors.filament,
            backgroundColor: chartColors.filamentFill,
            yAxisID: 'y',
            tension: 0.3,
            fill: false,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
          },
          {
            label: 'Cost (€)',
            data: costData,
            borderColor: '#ff6b6b',
            backgroundColor: 'rgba(255,107,107,0.12)',
            yAxisID: 'y1',
            tension: 0.3,
            fill: false,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        stacked: false,
        plugins: {
          legend: {
            align: 'end',
            labels: {
              boxHeight: 8,
              boxWidth: 8,
              color: chartColors.text,
              font: {
                family: 'Inter, Avenir, Helvetica, Arial, sans-serif',
                size: 12,
                weight: 700
              },
              padding: 18,
              pointStyle: 'circle',
              usePointStyle: true,
              generateLabels(chart: any) {
                const datasets = chart.data.datasets || [];

                return datasets.map((dataset: any, index: number) => ({
                  datasetIndex: index,
                  fillStyle: dataset.borderColor,
                  fontColor: chartColors.text,
                  hidden: !chart.isDatasetVisible(index),
                  lineCap: 'round',
                  lineDash: [],
                  lineDashOffset: 0,
                  lineJoin: 'round',
                  lineWidth: 0,
                  pointStyle: 'circle',
                  strokeStyle: dataset.borderColor,
                  text: dataset.label
                }));
              }
            }
          },
          tooltip: {
            backgroundColor: chartColors.tooltipBg,
            borderColor: chartColors.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            titleColor: chartColors.title,
            bodyColor: chartColors.text,
            displayColors: true,
            boxPadding: 5
          }
        },
        scales: {
          x: {
            display: true,
            title: { display: false },
            grid: {
              color: chartColors.grid,
              tickColor: chartColors.axis
            },
            border: { color: chartColors.axis },
            ticks: { color: chartColors.text }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: { display: true, text: 'Filament (g)', color: chartColors.text },
            grid: {
              color: chartColors.grid,
              tickColor: chartColors.axis
            },
            border: { color: chartColors.axis },
            ticks: { color: chartColors.text },
            beginAtZero: true,
            suggestedMax: Math.ceil(maxFilament * 1.2 || 10)
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: { display: true, text: 'Cost (€)', color: chartColors.text },
            grid: { drawOnChartArea: false, tickColor: chartColors.axis },
            border: { color: chartColors.axis },
            ticks: { color: chartColors.text },
            beginAtZero: true,
            suggestedMax: Math.ceil(maxCost * 1.2 || 1)
          }
        }
      }
    });
  }

  getTotalFillamentConsumption(): number {
    return this.prints.reduce((total, print) => total + (Number(print.filament) || 0), 0);
  }

  getTotalCost(): number {
    return this.prints.reduce((total, print) => total + (Number(print.cost) || 0), 0);
  }

  getSuccessCount(): number {
    return this.prints.filter(print => print.status === 'success').length;
  }

  getFailedCount(): number {
    return this.prints.filter(print => print.status === 'failed').length;
  }

  getPoorlyDoneCount(): number {
    return this.prints.filter(print => print.status === 'passed poorly').length;
  }

  private getFilteredPrints(): IPrint[] {
    const prints = [...(this.prints || [])];

    if (this.selectedGraphRange === 'all-time') {
      return prints;
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const startDate = new Date(today);

    if (this.selectedGraphRange === 'last-7-days') {
      startDate.setDate(today.getDate() - 6);
    }

    if (this.selectedGraphRange === 'last-month') {
      startDate.setMonth(today.getMonth() - 1);
    }

    if (this.selectedGraphRange === 'last-year') {
      startDate.setFullYear(today.getFullYear() - 1);
    }

    startDate.setHours(0, 0, 0, 0);

    return prints.filter(print => {
      const printDate = new Date(print.date);
      return printDate >= startDate && printDate <= today;
    });
  }
}
