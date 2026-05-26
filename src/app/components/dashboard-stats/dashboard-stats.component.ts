import { Component, Input, AfterViewInit, OnChanges, OnDestroy, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IPrint } from '../../interfaces/print.interface';

@Component({
  selector: 'dashboard-stats',
  standalone: true,
  imports: [CommonModule],
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

  @ViewChild('chartCanvas', { static: false }) canvas!: ElementRef<HTMLCanvasElement>;
  private chart: any;

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['prints'] && !changes['prints'].firstChange) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    if (this.chart) {
      try { this.chart.destroy(); } catch (e) { /* ignore */ }
    }
  }

  private async renderChart() {
    if (!this.canvas) return;
    const module = await import('chart.js/auto');
    const Chart = (module as any).default ?? module;

    // prepare chronological data (oldest -> newest)
    const sorted = [...(this.prints || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const labels = sorted.map(p => p.date);
    const filamentData = sorted.map(p => Number(p.filament ?? 0));
    const costData = sorted.map(p => Number(p.cost ?? 0));

    const maxFilament = filamentData.length ? Math.max(...filamentData) : 0;
    const maxCost = costData.length ? Math.max(...costData) : 0;

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
            borderColor: '#80ffdb',
            backgroundColor: 'rgba(128,255,219,0.12)',
            yAxisID: 'y',
            tension: 0.3,
            fill: true,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
          },
          {
            label: 'Cost (€)',
            data: costData,
            borderColor: '#f29d38',
            backgroundColor: 'rgba(242,157,56,0.12)',
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
              color: '#c7d0dc',
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
                  fontColor: '#c7d0dc',
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
            backgroundColor: 'rgba(12, 18, 28, 0.96)',
            borderColor: 'rgba(255, 255, 255, 0.12)',
            borderWidth: 1,
            padding: 12,
            titleColor: '#edf2f7',
            bodyColor: '#c7d0dc',
            displayColors: true,
            boxPadding: 5
          }
        },
        scales: {
          x: { display: true, title: { display: false } },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: { display: true, text: 'Filament (g)' },
            beginAtZero: true,
            suggestedMax: Math.ceil(maxFilament * 1.2 || 10)
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: { display: true, text: 'Cost (€)' },
            grid: { drawOnChartArea: false },
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
}
