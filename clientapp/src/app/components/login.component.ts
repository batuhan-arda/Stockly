import { Component, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-container">
      <div class="background-blur">
        <div class="chart-container">
          <canvas #stockChart></canvas>
        </div>
        <div class="stats-grid">
          <div class="stat-card" *ngFor="let stat of mockStats">
            <div class="stat-label">{{ stat.label }}</div>
            <div class="stat-value" [class.positive]="stat.change > 0" [class.negative]="stat.change < 0">
              {{ stat.value }}
            </div>
            <div class="stat-change" [class.positive]="stat.change > 0" [class.negative]="stat.change < 0">
              {{ stat.change > 0 ? '+' : '' }}{{ stat.change }}%
            </div>
          </div>
        </div>
        <div class="ticker-tape">
          <div class="ticker-item" *ngFor="let item of tickerData">
            <span class="ticker-symbol">{{ item.symbol }}</span>
            <span class="ticker-price">{{ '$' + item.price }}</span>
            <span class="ticker-change" [class.positive]="item.change > 0" [class.negative]="item.change < 0">
              {{ item.change > 0 ? '▲' : '▼' }} {{ Math.abs(item.change) }}%
            </span>
          </div>
        </div>
      </div>
      <div class="auth-card">
        <div class="auth-header">
          <div class="logo">
            <div class="logo-icon"></div>
            <h1>Sign In</h1>
          </div>
        </div>

        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="auth-form">
          <div class="form-group">
            <label for="email">Email Address</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              class="form-control"
              [class.error]="loginForm.get('email')?.invalid && loginForm.get('email')?.touched"
              placeholder="Enter your email"
            />
            <div *ngIf="loginForm.get('email')?.invalid && loginForm.get('email')?.touched" class="error-message">
              <span *ngIf="loginForm.get('email')?.errors?.['required']">Email is required</span>
              <span *ngIf="loginForm.get('email')?.errors?.['email']">Please enter a valid email</span>
            </div>
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              class="form-control"
              [class.error]="loginForm.get('password')?.invalid && loginForm.get('password')?.touched"
              placeholder="Enter your password"
            />
            <div *ngIf="loginForm.get('password')?.invalid && loginForm.get('password')?.touched" class="error-message">
              <span *ngIf="loginForm.get('password')?.errors?.['required']">Password is required</span>
              <span *ngIf="loginForm.get('password')?.errors?.['minlength']">Password must be at least 3 characters</span>
            </div>
          </div>

          <div *ngIf="errorMessage" class="alert alert-error">
            {{ errorMessage }}
          </div>

          <button
            type="submit"
            class="btn btn-primary"
            [disabled]="loginForm.invalid || isLoading"
          >
            <span *ngIf="isLoading" class="loading-spinner"></span>
            {{ isLoading ? 'Signing In...' : 'Sign In' }}
          </button>
        </form>

        <div class="auth-footer">
          <p>Don't have an account? <a routerLink="/register" class="link">Sign up here</a></p>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./auth.component.scss']
})
export class LoginComponent implements OnInit, AfterViewInit {
  @ViewChild('stockChart') stockChartRef!: ElementRef<HTMLCanvasElement>;
  
  loginForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  Math = Math;

  mockStats = [
    { label: 'Market Cap', value: '$2.4T', change: 2.3 },
    { label: 'Volume', value: '847M', change: -1.2 },
    { label: 'P/E Ratio', value: '28.5', change: 0.8 },
    { label: 'Dividend', value: '3.2%', change: 1.5 }
  ];

  tickerData = [
    { symbol: 'AAPL', price: '178.25', change: 2.34 },
    { symbol: 'GOOGL', price: '142.50', change: -0.87 },
    { symbol: 'MSFT', price: '415.30', change: 1.56 },
    { symbol: 'AMZN', price: '178.90', change: 3.21 },
    { symbol: 'TSLA', price: '242.80', change: -2.15 },
    { symbol: 'META', price: '512.45', change: 1.92 }
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(3)]]
    });
  }

  ngOnInit(): void {
    this.authService.isAuthenticated$.subscribe(isAuth => {
      if (isAuth) {
        this.router.navigate(['/dashboard']);
      }
    });
  }

  ngAfterViewInit(): void {
    this.createStockChart();
  }

  createStockChart(): void {
    const ctx = this.stockChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const labels = Array.from({ length: 50 }, (_, i) => i);
    const data1 = this.generateStockData(50, 100, 150);
    const data2 = this.generateStockData(50, 80, 120);
    const data3 = this.generateStockData(50, 60, 100);

    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'AAPL',
            data: data1,
            borderColor: 'rgba(59, 130, 246, 1)',
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 0
          },
          {
            label: 'GOOGL',
            data: data2,
            borderColor: 'rgba(168, 85, 247, 1)',
            backgroundColor: 'rgba(168, 85, 247, 0.2)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 0
          },
          {
            label: 'MSFT',
            data: data3,
            borderColor: 'rgba(236, 72, 153, 1)',
            backgroundColor: 'rgba(236, 72, 153, 0.2)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: false
          }
        },
        scales: {
          x: {
            display: false
          },
          y: {
            display: false
          }
        },
        animation: {
          duration: 2000
        }
      }
    });
  }

  generateStockData(count: number, min: number, max: number): number[] {
    const data = [];
    let current = (min + max) / 2;
    for (let i = 0; i < count; i++) {
      const change = (Math.random() - 0.5) * ((max - min) / 10);
      current = Math.max(min, Math.min(max, current + change));
      data.push(current);
    }
    return data;
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';

      const credentials = this.loginForm.value;
      
      this.authService.login(credentials).subscribe({
        next: (response) => {
          this.isLoading = false;
          this.router.navigate(['/dashboard']);
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = error;
        }
      });
    } else {
      Object.keys(this.loginForm.controls).forEach(key => {
        this.loginForm.get(key)?.markAsTouched();
      });
    }
  }
}
