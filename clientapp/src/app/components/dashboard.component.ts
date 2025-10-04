
import { Component, AfterViewInit, ViewChild, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial';
import 'chartjs-adapter-date-fns';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WalletService } from '../services/wallet.service';
import { BalanceStreamService } from '../services/balance-stream.service';
import { AuthService } from '../services/auth.service';
import { PortfolioService, BuyOrderRequest, SellOrderRequest } from '../services/portfolio.service';
import { WalletComponent } from './wallet.component';
import { StocksService } from '../services/stocks.service';
import { Subscription } from 'rxjs';
import * as signalR from '@microsoft/signalr';
Chart.register(...registerables);
Chart.register(CandlestickController, CandlestickElement);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, WalletComponent],
  template: `
    <div class="trading-dashboard">
      <!-- Header with Search -->
      <header class="dashboard-header">
        <!-- Left side: Current Stock Info and Search -->
        <div class="left-header-section">
          <!-- Current Stock Info -->
          <div class="current-stock-info" *ngIf="currentSymbol">
            <div class="stock-details">
              <h1 class="stock-title">{{getStockName(currentSymbol)}}</h1>
              <span class="stock-symbol-badge">{{currentSymbol}}</span>
            </div>
          </div>
          
          <!-- Search Container moved next to stock info -->
          <div class="search-container">
            <div class="search-wrapper">
              <div class="search-input-container">
                <svg class="search-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                  <path d="21 21l-4.35-4.35" stroke="currentColor" stroke-width="2"/>
                </svg>
                <input 
                  type="text" 
                  class="search-input"
                  placeholder="Search stocks (e.g., AAPL, MSFT, TSLA...)"
                  [(ngModel)]="searchQuery"
                  (input)="onSearchInput($event)"
                  (focus)="showDropdown = true"
                  (blur)="onSearchBlur()"
                  autocomplete="off"
                />
                <button class="clear-search" *ngIf="searchQuery" (click)="clearSearch()">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2"/>
                    <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2"/>
                  </svg>
                </button>
              </div>
              
              <!-- Dropdown with recommendations -->
              <div class="search-dropdown" *ngIf="showDropdown && filteredStocks.length > 0">
                <div 
                  *ngFor="let stock of filteredStocks" 
                  class="search-item"
                  (mousedown)="selectStock(stock)"
                >
                  <div class="stock-info">
                    <span class="stock-symbol">{{stock.symbol}}</span>
                    <span class="stock-name">{{stock.name}}</span>
                  </div>
                  <span class="stock-category">{{stock.category}}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Balance Display -->
        <div class="balance-container">
          <!-- Removed content -->
        </div>

        <!-- Right Side: Balance, Buy/Sell Buttons, and User Menu -->
        <div class="right-header-section">
          <!-- Balance Display (simplified) -->
          <div class="balance-display" [ngClass]="balanceGlowClass">
            \${{ userBalance | number:'1.2-2' }}
          </div>
          
          <!-- Buy/Sell Action Buttons -->
          <div class="trading-actions" *ngIf="currentSymbol">
            <button class="buy-button" (click)="openBuyModal()" [disabled]="!currentSymbol">
              <span>Buy</span>
            </button>
            <button class="sell-button" (click)="openSellModal()" [disabled]="!currentSymbol">
              <span>Sell</span>
            </button>
          </div>
          
          <!-- User Menu -->
          <div class="user-menu-container">
            <button class="user-menu-button" (click)="showUserMenu = !showUserMenu; $event.stopPropagation()">
              <div class="hamburger-lines">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </button>
            
            <!-- User Dropdown Menu -->
            <div class="user-dropdown" *ngIf="showUserMenu" (click)="$event.stopPropagation()">
              <div class="user-info">
                <div class="user-name">{{ userName }}</div>
                <div class="user-email">{{ userEmail }}</div>
              </div>
              <div class="menu-divider"></div>
              <div class="menu-items">
                <button class="menu-item" (click)="navigateToWallet()">
                  <span class="menu-icon">💳</span>
                  <span>Manage Wallet</span>
                </button>
                <button class="menu-item" (click)="navigateToDashboard()">
                  <span class="menu-icon">📊</span>
                  <span>Dashboard</span>
                </button>
                <button class="menu-item" (click)="navigateToPortfolio()">
                  <span class="menu-icon">📈</span>
                  <span>Portfolio</span>
                </button>
                <button class="menu-item" (click)="navigateToTransactions()">
                  <span class="menu-icon">📋</span>
                  <span>Transactions</span>
                </button>
              </div>
              <div class="menu-divider"></div>
              <button class="menu-item logout-item" (click)="logout()">
                <span class="menu-icon">🚪</span>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <!-- Chart Container -->
      <div class="chart-container">
        <!-- Loading Overlay -->
        <div class="loading-overlay" *ngIf="isLoading">
          <div class="loading-spinner">
            <div class="spinner"></div>
            <p class="loading-text">Loading {{loadingSymbol}}...</p>
          </div>
        </div>
        
        <!-- Technical Indicators Settings Button -->
        <div class="indicators-settings">
          <button 
            class="settings-btn" 
            (click)="toggleIndicatorsMenu()"
            title="Indicators Settings">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.0113 9.77251C4.28059 9.5799 4.48572 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          
          <!-- Dropdown Menu -->
          <div class="indicators-dropdown" *ngIf="showIndicatorsMenu">
            <div class="indicators-dropdown-header">Indicators</div>
            <div class="indicators-list">
              <label class="indicator-item">
                <input 
                  type="checkbox" 
                  [checked]="indicators.sma"
                  (change)="toggleIndicator('sma')"
                />
                <span class="indicator-label">SMA</span>
                <span class="indicator-name">Simple Moving Average</span>
              </label>
              <label class="indicator-item">
                <input 
                  type="checkbox" 
                  [checked]="indicators.ema"
                  (change)="toggleIndicator('ema')"
                />
                <span class="indicator-label">EMA</span>
                <span class="indicator-name">Exponential Moving Average</span>
              </label>
              <label class="indicator-item">
                <input 
                  type="checkbox" 
                  [checked]="indicators.rsi"
                  (change)="toggleIndicator('rsi')"
                />
                <span class="indicator-label">RSI</span>
                <span class="indicator-name">Relative Strength Index</span>
              </label>
              <label class="indicator-item">
                <input 
                  type="checkbox" 
                  [checked]="indicators.macd"
                  (change)="toggleIndicator('macd')"
                />
                <span class="indicator-label">MACD</span>
                <span class="indicator-name">Moving Average Convergence Divergence</span>
              </label>
              <label class="indicator-item">
                <input 
                  type="checkbox" 
                  [checked]="indicators.bb"
                  (change)="toggleIndicator('bb')"
                />
                <span class="indicator-label">BB</span>
                <span class="indicator-name">Bollinger Bands</span>
              </label>
            </div>
          </div>
        </div>
        
        <canvas #chartCanvas 
                class="trading-chart"
                (wheel)="onWheel($event)"
                (mousedown)="onMouseDown($event)"
                (mousemove)="onMouseMove($event)"
                (mouseup)="onMouseUp($event)"
                (mouseenter)="onMouseEnter($event)"
                (mouseleave)="onMouseLeave($event)"
                (touchstart)="onTouchStart($event)"
                (touchmove)="onTouchMove($event)"
                (touchend)="onTouchEnd($event)"></canvas>
      </div>
      
      <!-- Wallet Modal -->
      <div class="modal-overlay" *ngIf="showWalletModal" (click)="closeWalletModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Wallet Management</h2>
            <button class="close-btn" (click)="closeWalletModal()">×</button>
          </div>
          <div class="modal-body">
            <app-wallet></app-wallet>
          </div>
        </div>
      </div>

      <!-- Buy Modal -->
      <div class="modal-overlay" *ngIf="showBuyModal" (click)="closeBuyModal()">
        <div class="modal-content trading-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Buy {{ currentSymbol }}</h2>
            <button class="close-btn" (click)="closeBuyModal()">×</button>
          </div>
          <div class="modal-body">
            <div class="stock-info-display">
              <div class="info-row">
                <span class="label">Symbol:</span>
                <span class="value">{{ currentSymbol }}</span>
              </div>
              <div class="info-row">
                <span class="label">Current Price:</span>
                <span class="value">\${{ getCurrentPrice() | number:'1.2-2' }}</span>
              </div>
            </div>
            
            <div class="form-group">
              <label for="buyQuantity">Quantity:</label>
              <input type="number" id="buyQuantity" [(ngModel)]="buyQuantity" min="0.00000001" step="0.00000001">
            </div>
            
            <div class="form-group">
              <label for="buyPrice">Price per share:</label>
              <input type="number" id="buyPrice" [(ngModel)]="buyPrice" min="0.01" step="0.01">
            </div>
            
            <div class="total-cost">
              <strong>Total Cost: \${{ (buyQuantity * buyPrice) | number:'1.2-2' }}</strong>
            </div>
            
            <div class="error-message" *ngIf="tradingError">{{ tradingError }}</div>
            <div class="success-message" *ngIf="tradingSuccess">{{ tradingSuccess }}</div>
            
            <div class="modal-actions">
              <button class="btn-secondary" (click)="closeBuyModal()">Cancel</button>
              <button class="btn-primary" (click)="executeBuyOrder()" [disabled]="isTrading || !buyQuantity || !buyPrice">
                {{ isTrading ? 'Processing...' : 'Buy' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Sell Modal -->
      <div class="modal-overlay" *ngIf="showSellModal" (click)="closeSellModal()">
        <div class="modal-content trading-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Sell {{ currentSymbol }}</h2>
            <button class="close-btn" (click)="closeSellModal()">×</button>
          </div>
          <div class="modal-body">
            <div class="stock-info-display">
              <div class="info-row">
                <span class="label">Symbol:</span>
                <span class="value">{{ currentSymbol }}</span>
              </div>
              <div class="info-row">
                <span class="label">Current Price:</span>
                <span class="value">\${{ getCurrentPrice() | number:'1.2-2' }}</span>
              </div>
            </div>
            
            <div class="form-group">
              <label for="sellQuantity">Quantity:</label>
              <input type="number" id="sellQuantity" [(ngModel)]="sellQuantity" min="0.00000001" step="0.00000001">
            </div>
            
            <div class="form-group">
              <label for="sellPrice">Price per share:</label>
              <input type="number" id="sellPrice" [(ngModel)]="sellPrice" min="0.01" step="0.01">
            </div>
            
            <div class="total-proceeds">
              <strong>Total Proceeds: \${{ (sellQuantity * sellPrice) | number:'1.2-2' }}</strong>
            </div>
            
            <div class="error-message" *ngIf="tradingError">{{ tradingError }}</div>
            <div class="success-message" *ngIf="tradingSuccess">{{ tradingSuccess }}</div>
            
            <div class="modal-actions">
              <button class="btn-secondary" (click)="closeSellModal()">Cancel</button>
              <button class="btn-primary sell-action" (click)="executeSellOrder()" [disabled]="isTrading || !sellQuantity || !sellPrice">
                {{ isTrading ? 'Processing...' : 'Sell' }}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Trading Error Messages -->
      <div class="error-toast" *ngIf="errorMessage" [class.show]="errorMessage">
        <div class="error-content">
          <span class="error-icon">⚠️</span>
          <span class="error-text">{{ errorMessage }}</span>
          <button class="error-close" (click)="clearError()">×</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 0;
      overflow-x: hidden;
    }

    .trading-dashboard {
      min-height: 100vh;
      background: #f8fafc;
      color: #333;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow-x: hidden;
    }

    .dashboard-header {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      padding: 0.25rem 1rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      box-shadow: 0 2px 20px rgba(0,0,0,0.1);
      border-bottom: 1px solid rgba(0,0,0,0.05);
      position: relative;
      z-index: 100;
    }

    .left-header-section, .current-stock-info, .stock-details {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .left-header-section {
      gap: 20px;
      flex: 1;
    }

    .stock-title {
      font-size: 1.3em;
      font-weight: 600;
      margin: 0;
      color: #1e293b;
    }

    .stock-symbol-badge {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.8em;
      font-weight: 500;
      border: 1px solid rgba(255, 255, 255, 0.3);
      backdrop-filter: blur(10px);
    }

    .balance-container {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
    }

    .right-header-section {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-left: auto;
    }

    .balance-display {
      font-size: 1.1em;
      font-weight: 600;
      color: #6b7280;
      transition: all 0.3s ease;
      padding: 8px 12px;
      border-radius: 8px;
      min-width: 120px;
      text-align: center;
    }

    .balance-glow-green {
      color: #10b981 !important;
      box-shadow: 0 0 20px rgba(16, 185, 129, 0.4);
      background: rgba(16, 185, 129, 0.1);
      animation: balanceGlow 2s ease-out;
    }

    .balance-glow-red {
      color: #ef4444 !important;
      box-shadow: 0 0 20px rgba(239, 68, 68, 0.4);
      background: rgba(239, 68, 68, 0.1);
      animation: balanceGlow 2s ease-out;
    }

    @keyframes balanceGlow {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }

    .trading-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .buy-button, .sell-button {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-size: 0.9em;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 70px;
      justify-content: center;
    }

    .buy-button {
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      color: white;
    }

    .buy-button:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
    }

    .sell-button {
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
      color: white;
    }

    .sell-button:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
    }

    .buy-button:disabled, .sell-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .button-icon {
      font-size: 0.9em;
    }

    .user-menu-container {
      position: relative;
    }

    .user-menu-button {
      background: none;
      border: none;
      color: #374151;
      padding: 8px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 40px;
      min-height: 40px;
    }

    .user-menu-button:hover {
      background: rgba(0, 0, 0, 0.05);
    }

    .hamburger-lines {
      display: flex;
      flex-direction: column;
      gap: 3px;
      width: 18px;
    }

    .hamburger-lines span {
      height: 2px;
      background: #374151;
      border-radius: 1px;
      transition: all 0.2s ease;
    }

    .user-dropdown {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 8px;
      background: none;
      border-radius: 12px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
      min-width: 220px;
      z-index: 1000;
      overflow: hidden;
      animation: dropdownSlideIn 0.2s ease-out;
    }

    @keyframes dropdownSlideIn {
      from { opacity: 0; transform: translateY(-10px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .user-info {
      padding: 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .user-name {
      font-weight: 600;
      font-size: 1.1em;
      margin-bottom: 4px;
    }

    .user-email {
      font-size: 0.85em;
      opacity: 0.9;
    }

    .menu-items {
      padding: 8px 0;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .menu-item {
      width: 100%;
      padding: 12px 16px;
      border: none;
      background: none;
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      transition: background-color 0.2s ease;
      font-size: 0.95em;
      color: #374151;
    }

    .menu-item:hover { background: #f3f4f6; }
    .logout-item { color: #dc2626; }
    .logout-item:hover { background: #fef2f2; }

    .menu-icon {
      font-size: 1.1em;
      width: 20px;
      display: flex;
      justify-content: center;
    }

    .menu-divider {
      height: 1px;
      background: #e5e7eb;
      margin: 0;
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(5px);
    }

    .modal-content {
      background: white;
      border-radius: 15px;
      max-width: 90vw;
      max-height: 90vh;
      overflow: auto;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
      animation: modalSlideIn 0.3s ease-out;
    }

    @keyframes modalSlideIn {
      from { opacity: 0; transform: translateY(-50px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 30px;
      border-bottom: 1px solid #e5e7eb;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 15px 15px 0 0;
    }

    .modal-header h2 {
      margin: 0;
      font-size: 1.5em;
      font-weight: bold;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 2em;
      color: white;
      cursor: pointer;
      padding: 0;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.3s ease;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: rotate(90deg);
    }

    .modal-body {
      padding: 0;
    }

    .trading-modal {
      max-width: 500px;
      width: 90%;
    }

    .trading-modal .modal-body {
      padding: 2rem;
    }

    .stock-info-display {
      background: #f8fafc;
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }

    .info-row:last-child {
      margin-bottom: 0;
    }

    .info-row .label {
      font-weight: 500;
      color: #6b7280;
    }

    .info-row .value {
      font-weight: 600;
      color: #1f2937;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: #374151;
    }

    .form-group input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 1rem;
      transition: border-color 0.2s ease;
    }

    .form-group input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .total-cost, .total-proceeds {
      background: #f0f9ff;
      padding: 1rem;
      border-radius: 8px;
      margin: 1rem 0;
      text-align: center;
      border: 1px solid #e0f2fe;
    }

    .modal-actions {
      display: flex;
      gap: 1rem;
      margin-top: 2rem;
    }

    .btn-primary, .btn-secondary {
      flex: 1;
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 6px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-primary {
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      color: white;
    }

    .btn-primary.sell-action {
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
    }

    .btn-secondary {
      background: #f3f4f6;
      color: #374151;
    }

    .btn-primary:hover:not(:disabled), .btn-secondary:hover:not(:disabled) {
      transform: translateY(-1px);
    }

    .btn-primary:disabled, .btn-secondary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .error-message {
      color: #dc2626;
      font-size: 0.875rem;
      margin: 0.5rem 0;
      padding: 0.5rem;
      background: #fef2f2;
      border-radius: 4px;
      border: 1px solid #fecaca;
    }

    .success-message {
      color: #059669;
      font-size: 0.875rem;
      margin: 0.5rem 0;
      padding: 0.5rem;
      background: #f0fdf4;
      border-radius: 4px;
      border: 1px solid #bbf7d0;
    }

    .error-toast {
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(45deg, #ef4444, #dc2626);
      color: white;
      padding: 15px 20px;
      border-radius: 10px;
      box-shadow: 0 10px 25px rgba(239, 68, 68, 0.3);
      transform: translateX(400px);
      transition: transform 0.3s ease;
      z-index: 10001;
      max-width: 400px;
    }

    .error-toast.show {
      transform: translateX(0);
    }

    .error-content {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .error-icon {
      font-size: 1.2em;
    }

    .error-text {
      flex: 1;
      font-weight: 500;
    }

    .error-close {
      background: none;
      border: none;
      color: white;
      font-size: 1.5em;
      cursor: pointer;
      padding: 0;
      margin-left: 10px;
    }

    .search-container {
      flex: 1;
      max-width: 400px;
      position: relative;
      z-index: 1000;
    }

    .search-wrapper {
      position: relative;
    }

    .search-input-container {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-input {
      width: 100%;
      padding: 8px 16px 8px 40px;
      border: 2px solid #e1e5e9;
      border-radius: 10px;
      font-size: 14px;
      background: white;
      transition: all 0.3s ease;
      outline: none;
    }

    .search-input:focus {
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .search-icon {
      position: absolute;
      left: 12px;
      width: 16px;
      height: 16px;
      color: #6b7280;
      z-index: 2;
    }

    .clear-search {
      position: absolute;
      right: 12px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s;
    }

    .clear-search:hover {
      background: #f3f4f6;
    }

    .clear-search svg {
      width: 16px;
      height: 16px;
      color: #6b7280;
    }

    .search-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.15);
      border: 1px solid #e1e5e9;
      max-height: 300px;
      overflow-y: auto;
      z-index: 9999;
      margin-top: 4px;
    }

    .search-item {
      padding: 16px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: background-color 0.2s;
      border-bottom: 1px solid #f3f4f6;
    }

    .search-item:last-child {
      border-bottom: none;
    }

    .search-item:hover {
      background: #f8fafc;
    }

    .stock-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .stock-symbol {
      font-weight: 700;
      font-size: 16px;
      color: #1f2937;
    }

    .stock-name {
      font-size: 14px;
      color: #6b7280;
    }

    .stock-category {
      font-size: 12px;
      background: #e0e7ff;
      color: #3730a3;
      padding: 4px 8px;
      border-radius: 6px;
      font-weight: 500;
    }

    .current-stock-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .stock-details {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .stock-title {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #1f2937;
    }

    .stock-symbol-badge {
      background: #667eea;
      color: white;
      padding: 4px 8px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 12px;
    }

    .chart-container {
      position: relative;
      height: calc(100vh - 50px);
      margin: 0.5rem;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }

    .indicators-settings {
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 10;
    }

    .settings-btn {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(0,0,0,0.08);
      border-radius: 8px;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      color: #64748b;
    }

    .settings-btn:hover {
      background: rgba(255, 255, 255, 1);
      border-color: rgba(0,0,0,0.12);
      color: #3b82f6;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transform: translateY(-1px);
    }

    .settings-btn:active {
      transform: translateY(0);
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
    }

    .indicators-dropdown {
      position: absolute;
      top: 44px;
      right: 0;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      border: 1px solid rgba(0,0,0,0.08);
      min-width: 280px;
      animation: slideDown 0.2s ease;
      overflow: hidden;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .indicators-dropdown-header {
      background: #f8fafc;
      padding: 10px 14px;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid rgba(0,0,0,0.06);
    }

    .indicators-list {
      padding: 6px;
    }

    .indicator-item {
      display: flex;
      align-items: center;
      padding: 10px 12px;
      cursor: pointer;
      border-radius: 6px;
      transition: background 0.15s ease;
      gap: 10px;
    }

    .indicator-item:hover {
      background: #f1f5f9;
    }

    .indicator-item input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
      accent-color: #3b82f6;
      flex-shrink: 0;
    }

    .indicator-label {
      font-weight: 600;
      color: #1e293b;
      font-size: 12px;
      min-width: 45px;
    }

    .indicator-name {
      color: #64748b;
      font-size: 11px;
      flex: 1;
    }

    .trading-chart {
      width: 100%;
      height: 100%;
      background: white;
      cursor: crosshair;
    }

    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      border-radius: 12px;
    }

    .loading-spinner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #f3f4f6;
      border-top: 3px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .loading-text {
      margin: 0;
      font-size: 14px;
      font-weight: 500;
      color: #6b7280;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .dashboard-header {
        flex-direction: column;
        gap: 1rem;
        padding: 1rem;
      }

      .right-header-section {
        width: 100%;
        justify-content: space-between;
      }

      .trading-actions {
        gap: 6px;
      }

      .buy-button, .sell-button {
        padding: 6px 12px;
        font-size: 0.8em;
        min-width: 60px;
      }

      .button-icon {
        font-size: 0.8em;
      }

      .balance-display {
        font-size: 1em;
        min-width: 100px;
      }

      .search-container {
        max-width: none;
        width: 100%;
      }

      .stock-title {
        font-size: 20px;
      }

      .chart-container {
        margin: 0.25rem;
        height: calc(100vh - 80px);
      }

      .indicators-panel {
        top: 8px;
        right: 8px;
        padding: 6px;
      }

      .indicators-title {
        font-size: 10px;
        margin-bottom: 4px;
      }

      .indicator-buttons {
        gap: 3px;
      }

      .indicator-btn {
        padding: 3px 6px;
        font-size: 9px;
        min-width: 32px;
      }

      .trading-modal {
        width: 95%;
        max-width: none;
      }

      .trading-modal .modal-body {
        padding: 1rem;
      }

      .modal-actions {
        flex-direction: column;
        gap: 0.5rem;
      }

      .btn-primary, .btn-secondary {
        width: 100%;
      }
    }
  `]
})
export class DashboardComponent implements AfterViewInit, OnDestroy, OnInit {
  @ViewChild('chartCanvas') chartCanvasRef!: ElementRef<HTMLCanvasElement>;
  chart: any;
  
  // Subscriptions for cleanup
  private subscriptions: Subscription = new Subscription();
  
  // Data properties
  allOhlcData: any[] = [];
  allLabels: string[] = [];
  allDates: Date[] = [];
  
  // Range control properties
  startIndex: number = 0;
  endIndex: number = 0;
  visibleDays: number = 90;
  maxStartIndex: number = 0;
  maxVisibleDays: number = 365;
  
  // Zoom properties
  private readonly CANDLE_WIDTH = 8;
  private readonly MIN_VISIBLE_DAYS = 30;
  private readonly MAX_VISIBLE_DAYS = 365;

  // Drag properties
  private isDragging = false;
  private lastMouseX = 0;
  private lastTouchX = 0;
  private dragStartIndex = 0;

  // Crosshair properties
  private crosshairX = 0;
  private crosshairY = 0;
  private showCrosshair = false;

  // Real-time update properties
  private lastUpdateTime = 0;

  // Technical Indicators properties
  indicators = {
    sma: false,
    ema: false,
    rsi: false,
    macd: false,
    bb: false
  };

  // Store calculated indicator data for custom drawing
  private rsiData: number[] = [];
  private macdData: { macd: number[], signal: number[], histogram: number[] } | null = null;

  // Candle glow properties
  private lastCandleGlow = false;
  private glowStartTime = 0;
  private glowDuration = 2000; // 2 seconds glow
  private lastPrice = 0;
  private priceIncreased = false; // Track if price went up or down
  
  // SignalR connection
  private hubConnection: signalR.HubConnection | null = null;
  public currentSymbol = 'AAPL'; // Track current symbol - made public for template access
  
  // Search functionality
  public searchQuery = '';
  public showDropdown = false;
  public isConnected = false;
  public filteredStocks: any[] = [];
  
  // Indicators menu
  public showIndicatorsMenu = false;
  
  // Loading state
  public isLoading = false;
  public loadingSymbol = '';
  
  // Stocks list loaded from backend
  private stockDatabase: any[] = [];

  // Wallet properties
  userBalance: number = 0;
  showWalletModal: boolean = false;
  errorMessage: string = '';

  // User menu properties
  showUserMenu: boolean = false;
  userName: string = 'Loading...';
  userEmail: string = 'Loading...';

  // Balance glow properties
  balanceGlowClass: string = '';
  private previousBalance: number = 0;

  // Trading modal properties
  showBuyModal: boolean = false;
  showSellModal: boolean = false;
  buyQuantity: number = 0.00000001;
  buyPrice: number = 0;
  sellQuantity: number = 0.00000001;
  sellPrice: number = 0;
  tradingError: string = '';
  tradingSuccess: string = '';
  isTrading: boolean = false;

  constructor(
    private http: HttpClient, 
    private walletService: WalletService, 
    private router: Router,
    private balanceStreamService: BalanceStreamService,
    private authService: AuthService,
    private portfolioService: PortfolioService,
    private stocksService: StocksService
  ) {}

  ngOnInit(): void {
    // Restore last viewed stock from localStorage
    const savedStock = localStorage.getItem('lastViewedStock');
    if (savedStock) {
      this.currentSymbol = savedStock;
    }
    
    // Load user data from AuthService
    this.loadUserData();
    
    // Load available stocks from backend
    this.loadAvailableStocks();
  }

  ngAfterViewInit(): void {
    this.loadStockData(this.currentSymbol);
    this.setupBalanceStream();
    this.setupClickOutsideListener();
    this.setupAuthStateListener();
  }

  private setupAuthStateListener(): void {
    // Listen to authentication state changes
    const authSub = this.authService.isAuthenticated$.subscribe(isAuthenticated => {
      if (!isAuthenticated) {
        // User is no longer authenticated, redirect to login
        this.router.navigate(['/login'], { replaceUrl: true });
      }
    });
    this.subscriptions.add(authSub);
  }

  private setupClickOutsideListener(): void {
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      
      // Close user menu if clicking outside
      if (this.showUserMenu) {
        this.showUserMenu = false;
      }
      
      // Close indicators menu if clicking outside
      if (this.showIndicatorsMenu) {
        const indicatorsSettings = target.closest('.indicators-settings');
        if (!indicatorsSettings) {
          this.showIndicatorsMenu = false;
        }
      }
    });
  }

  private setupBalanceStream(): void {
    // Subscribe to balance changes - initialization happens automatically
    const balanceSub = this.balanceStreamService.balance$.subscribe(balance => {
      if (this.previousBalance !== 0 && balance !== this.previousBalance) {
        // Add glow effect based on change
        if (balance > this.previousBalance) {
          this.balanceGlowClass = 'balance-glow-green';
        } else if (balance < this.previousBalance) {
          this.balanceGlowClass = 'balance-glow-red';
        }
        
        // Remove glow after 2 seconds
        setTimeout(() => {
          this.balanceGlowClass = '';
        }, 2000);
      }
      
      this.previousBalance = this.userBalance;
      this.userBalance = balance;
    });
    this.subscriptions.add(balanceSub);
  }

  private loadUserData(): void {
    // Subscribe to current user from AuthService
    const userSub = this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.userName = user.username || 'User';
        this.userEmail = user.email || 'user@example.com';
      } else {
        this.userName = 'Loading...';
        this.userEmail = 'Loading...';
      }
    });
    this.subscriptions.add(userSub);
  }

  private loadAvailableStocks(): void {
    // Load available stocks from backend service
    this.stocksService.loadAvailableStocks().subscribe({
      next: (stocks) => {
        this.stockDatabase = stocks;
        console.log(`Loaded ${stocks.length} stocks from backend`);
      },
      error: (error) => {
        console.error('Failed to load stocks:', error);
        // Keep empty array as fallback
        this.stockDatabase = [];
      }
    });
  }

  private async loadStockData(symbol: string): Promise<void> {
    this.isLoading = true;
    this.loadingSymbol = symbol;
    
    this.http.get<any>(`/api/stocks/price/${symbol}/10y`).subscribe({
      next: data => {
        this.isLoading = false;
        const result = data?.chart?.result?.[0];
        const timestamps = result?.timestamp || [];
        const quote = result?.indicators?.quote?.[0] || {};
        
        // Build complete OHLC array and labels
        this.allOhlcData = [];
        this.allLabels = [];
        this.allDates = [];
        
        for (let i = 0; i < timestamps.length; i++) {
          const t = timestamps[i];
          const o = quote.open?.[i];
          const h = quote.high?.[i];
          const l = quote.low?.[i];
          const c = quote.close?.[i];
          const date = new Date(t * 1000);
          
          // Skip if date is invalid
          if (isNaN(date.getTime())) continue;
          
          // For current/recent data, be more lenient - allow if we have at least open and close
          const isRecentData = i >= timestamps.length - 3; // Last 3 data points
          const hasMinimalData = o != null && !isNaN(o) && c != null && !isNaN(c);
          const hasCompleteData = [o, h, l, c].every(v => v != null && isFinite(v) && v > 0);
          
          if (isRecentData && hasMinimalData) {
            // For recent data, use available values or fallback to open/close
            const safeHigh = (h != null && isFinite(h) && h > 0) ? h : Math.max(o, c);
            const safeLow = (l != null && isFinite(l) && l > 0) ? l : Math.min(o, c);
            
            this.allOhlcData.push({ 
              o: o, 
              h: safeHigh, 
              l: safeLow, 
              c: c 
            });
            this.allLabels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            this.allDates.push(date);
          } else if (!isRecentData && hasCompleteData) {
            // For older data, require complete OHLC
            this.allOhlcData.push({ o, h, l, c });
            this.allLabels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            this.allDates.push(date);
          }
        }
        
        // Initialize range controls
        this.maxStartIndex = Math.max(0, this.allOhlcData.length - this.MIN_VISIBLE_DAYS);
        this.maxVisibleDays = Math.min(this.MAX_VISIBLE_DAYS, this.allOhlcData.length);
        this.visibleDays = Math.min(90, this.allOhlcData.length);
        this.startIndex = Math.max(0, this.allOhlcData.length - this.visibleDays);
        this.endIndex = this.allOhlcData.length - 1;
        
        this.initializeChart();
        this.updateChart();
        
        // Start real-time updates after initial load
        this.startSignalRConnection();
      },
      error: (error) => {
        console.error('Error loading stock data:', error);
        this.isLoading = false;
      }
    });
  }

  private initializeChart(): void {
    const ctx = this.chartCanvasRef.nativeElement.getContext('2d');
    if (ctx) {
      this.chart = new Chart(ctx, {
        type: 'candlestick',
        data: {
          labels: [],
          datasets: [{
            label: 'AAPL (1y)',
            data: [],
            color: {
              up: '#4caf50',
              down: '#f44336',
              unchanged: '#999'
            },
            borderColor: '#333',
            width: 2,
            barPercentage: 1.0,
            categoryPercentage: 1.0
          } as any]
        },
        plugins: [{
          id: 'lastCandleGlow',
          afterDatasetsDraw: (chart: any) => {
            if (!this.lastCandleGlow) return;
            
            const ctx = chart.ctx;
            const chartArea = chart.chartArea;
            const xScale = chart.scales.x;
            const yScale = chart.scales.y;
            
            // Get the final (most recent) candle data
            const datasets = chart.data.datasets[0];
            if (!datasets.data || datasets.data.length === 0) return;
            
            const finalCandle = datasets.data[datasets.data.length - 1];
            const candleIndex = datasets.data.length - 1;
            
            // Calculate glow intensity based on time elapsed
            const elapsed = Date.now() - this.glowStartTime;
            if (elapsed > this.glowDuration) {
              this.lastCandleGlow = false;
              return;
            }
            
            const intensity = 1 - (elapsed / this.glowDuration); // Fade from 1 to 0
            const glowAlpha = intensity * 0.6; // Max 60% opacity
            
            // Get candle position
            const xPosition = xScale.getPixelForValue(candleIndex);
            const yHigh = yScale.getPixelForValue(finalCandle.h);
            const yLow = yScale.getPixelForValue(finalCandle.l);
            const yOpen = yScale.getPixelForValue(finalCandle.o);
            const yClose = yScale.getPixelForValue(finalCandle.c);
            
            // Use tracked price direction instead of candle open/close comparison
            const glowColor = this.priceIncreased ? `rgba(76, 175, 80, ${glowAlpha})` : `rgba(244, 67, 54, ${glowAlpha})`;
            
            ctx.save();
            
            // Create glow effect
            ctx.shadowColor = this.priceIncreased ? '#4caf50' : '#f44336';
            ctx.shadowBlur = 15 * intensity;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            // Draw glowing background
            ctx.fillStyle = glowColor;
            const candleWidth = 8;
            ctx.fillRect(xPosition - candleWidth/2 - 5, yHigh - 5, candleWidth + 10, yLow - yHigh + 10);
            
            // Draw glowing candle body
            ctx.fillStyle = this.priceIncreased ? `rgba(76, 175, 80, ${0.8 * intensity})` : `rgba(244, 67, 54, ${0.8 * intensity})`;
            const bodyTop = Math.min(yOpen, yClose);
            const bodyBottom = Math.max(yOpen, yClose);
            ctx.fillRect(xPosition - candleWidth/2, bodyTop, candleWidth, bodyBottom - bodyTop);
            
            ctx.restore();
            
            // Continue animation
            requestAnimationFrame(() => {
              if (this.chart && this.lastCandleGlow) {
                this.chart.update('none');
              }
            });
          }
        }, {
          id: 'finalPriceHighlight',
          afterDatasetsDraw: (chart: any) => {
            const ctx = chart.ctx;
            const chartArea = chart.chartArea;
            const yScale = chart.scales.y;
            
            // Get the final (most recent) candle data
            const datasets = chart.data.datasets[0];
            if (!datasets.data || datasets.data.length === 0) return;
            
            const finalCandle = datasets.data[datasets.data.length - 1];
            const finalPrice = finalCandle.c; // closing price
            const yPosition = yScale.getPixelForValue(finalPrice);
            
            // Get previous candle to determine if price went up or down
            const prevCandle = datasets.data.length > 1 ? datasets.data[datasets.data.length - 2] : null;
            const isUp = !prevCandle || finalPrice >= prevCandle.c;
            
            ctx.save();
            
            // Static colors based on price direction
            const baseColor = isUp ? 'rgb(76, 175, 80)' : 'rgb(244, 67, 54)'; // Green or Red
            
            // Draw simple colored box
            const priceText = `$${finalPrice.toFixed(2)}`;
            ctx.font = 'bold 12px Arial';
            const textWidth = ctx.measureText(priceText).width;
            
            // Background box - static color
            ctx.fillStyle = baseColor;
            ctx.fillRect(chartArea.left - textWidth - 20, yPosition - 10, textWidth + 15, 20);
            
            // Text
            ctx.fillStyle = '#ffffff';
            ctx.fillText(priceText, chartArea.left - textWidth - 12, yPosition + 4);
            
            ctx.restore();
          }
        }, {
          id: 'crosshair',
          afterDatasetsDraw: (chart: any) => {
            if (!this.showCrosshair) return;
            
            const ctx = chart.ctx;
            const chartArea = chart.chartArea;
            
            ctx.save();
            ctx.strokeStyle = 'rgba(102, 102, 102, 0.4)'; // More transparent
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            
            // Draw vertical line
            ctx.beginPath();
            ctx.moveTo(this.crosshairX, chartArea.top);
            ctx.lineTo(this.crosshairX, chartArea.bottom);
            ctx.stroke();
            
            // Draw horizontal line
            ctx.beginPath();
            ctx.moveTo(chartArea.left, this.crosshairY);
            ctx.lineTo(chartArea.right, this.crosshairY);
            ctx.stroke();
            
            // Get values at crosshair position
            const xScale = chart.scales.x;
            const yScale = chart.scales.y;
            
            // Calculate date label
            const dataIndex = Math.round(xScale.getValueForPixel(this.crosshairX));
            const actualIndex = this.startIndex + dataIndex;
            const dateLabel = this.allDates[actualIndex]?.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            }) || '';
            
            // Calculate price value
            const priceValue = yScale.getValueForPixel(this.crosshairY);
            
            // Draw value labels
            ctx.setLineDash([]);
            ctx.fillStyle = '#666';
            ctx.font = '12px Arial';
            
            // X-axis label (date)
            if (dateLabel) {
              const textWidth = ctx.measureText(dateLabel).width;
              ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
              ctx.fillRect(this.crosshairX - textWidth/2 - 4, chartArea.bottom + 2, textWidth + 8, 16);
              ctx.fillStyle = '#333';
              ctx.fillText(dateLabel, this.crosshairX - textWidth/2, chartArea.bottom + 14);
            }
            
            // Y-axis label (price) - moved to left side
            const priceText = `$${priceValue.toFixed(2)}`;
            const priceWidth = ctx.measureText(priceText).width;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(chartArea.left - priceWidth - 10, this.crosshairY - 8, priceWidth + 8, 16);
            ctx.fillStyle = '#333';
            ctx.fillText(priceText, chartArea.left - priceWidth - 6, this.crosshairY + 4);
            
            ctx.restore();
          }
        }, {
          id: 'indicatorPanels',
          afterDraw: (chart: any) => {
            const ctx = chart.ctx;
            const chartArea = chart.chartArea;
            
            if (!chartArea) return;
            
            const padding = (chart.options.layout?.padding as any)?.bottom || 0;
            if (padding === 0) return;
            
            const indicatorHeight = 160;
            let currentBottom = chartArea.bottom + 35; // Increased space for x-axis labels to avoid overlap
            
            const xScale = chart.scales.x;
            const canvasWidth = chartArea.right - chartArea.left;
            const visibleDataCount = this.endIndex - this.startIndex + 1;
            
            ctx.save();
            
            // Draw RSI panel if active
            if (this.indicators.rsi && this.rsiData.length > 0) {
              const rsiTop = currentBottom;
              const rsiBottom = rsiTop + indicatorHeight;
              const rsiHeight = indicatorHeight - 20; // Leave space for label and padding
              
              // Background
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(chartArea.left, rsiTop, canvasWidth, indicatorHeight);
              
              // Border
              ctx.strokeStyle = '#e2e8f0';
              ctx.lineWidth = 1;
              ctx.strokeRect(chartArea.left, rsiTop, canvasWidth, indicatorHeight);
              
              // Label
              ctx.fillStyle = '#64748b';
              ctx.font = 'bold 11px Arial';
              ctx.fillText('RSI (14)', chartArea.left + 8, rsiTop + 15);
              
              // Grid lines and labels (horizontal dotted lines)
              ctx.lineWidth = 0.5;
              ctx.font = '10px Arial';
              const rsiLevels = [100, 70, 50, 30, 0];
              rsiLevels.forEach(level => {
                const y = rsiTop + 20 + ((100 - level) / 100) * rsiHeight;
                
                // Set line style based on level
                if (level === 70) {
                  ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
                  ctx.setLineDash([5, 5]);
                  ctx.lineWidth = 1;
                } else if (level === 30) {
                  ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)';
                  ctx.setLineDash([5, 5]);
                  ctx.lineWidth = 1;
                } else {
                  ctx.strokeStyle = '#e2e8f0';
                  ctx.setLineDash([2, 2]);
                  ctx.lineWidth = 0.5;
                }
                
                ctx.beginPath();
                ctx.moveTo(chartArea.left, y);
                ctx.lineTo(chartArea.right, y);
                ctx.stroke();
                
                // Draw level label on the LEFT side (y-axis style)
                ctx.setLineDash([]);
                const labelText = level.toString();
                
                // Label text on the left like main chart y-axis
                ctx.fillStyle = '#64748b';
                ctx.font = '10px Arial';
                ctx.textAlign = 'right';
                ctx.fillText(labelText, chartArea.left - 5, y + 3);
              });
              ctx.setLineDash([]);
              ctx.textAlign = 'left'; // Reset text align
              
              // Draw RSI line
              const visibleRsi = this.rsiData.slice(this.startIndex, this.endIndex + 1);
              ctx.beginPath();
              ctx.strokeStyle = '#ffcd56';
              ctx.lineWidth = 2;
              
              let firstPoint = true;
              for (let i = 0; i < visibleRsi.length; i++) {
                const value = visibleRsi[i];
                if (!isNaN(value)) {
                  const x = chartArea.left + (i / (visibleDataCount - 1)) * canvasWidth;
                  const y = rsiTop + 20 + ((100 - value) / 100) * rsiHeight;
                  
                  if (firstPoint) {
                    ctx.moveTo(x, y);
                    firstPoint = false;
                  } else {
                    ctx.lineTo(x, y);
                  }
                }
              }
              ctx.stroke();
              
              currentBottom = rsiBottom;
            }
            
            // Draw MACD panel if active
            if (this.indicators.macd && this.macdData) {
              const macdTop = currentBottom;
              const macdBottom = macdTop + indicatorHeight;
              const macdHeight = indicatorHeight - 20;
              
              // Background
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(chartArea.left, macdTop, canvasWidth, indicatorHeight);
              
              // Border
              ctx.strokeStyle = '#e2e8f0';
              ctx.lineWidth = 1;
              ctx.strokeRect(chartArea.left, macdTop, canvasWidth, indicatorHeight);
              
              // Label
              ctx.fillStyle = '#64748b';
              ctx.font = 'bold 11px Arial';
              ctx.fillText('MACD (12, 26, 9)', chartArea.left + 8, macdTop + 15);
              
              const visibleHistogram = this.macdData.histogram.slice(this.startIndex, this.endIndex + 1);
              const visibleMacdLine = this.macdData.macd.slice(this.startIndex, this.endIndex + 1);
              const visibleSignalLine = this.macdData.signal.slice(this.startIndex, this.endIndex + 1);
              
              // Find min/max for scaling
              const allValues = [...visibleHistogram, ...visibleMacdLine, ...visibleSignalLine].filter(v => !isNaN(v));
              if (allValues.length > 0) {
                const maxVal = Math.max(...allValues);
                const minVal = Math.min(...allValues);
                const range = maxVal - minVal;
                const zeroY = macdTop + 20 + ((maxVal) / range) * macdHeight;
                
                // Draw horizontal grid lines (dotted)
                ctx.strokeStyle = '#e2e8f0';
                ctx.lineWidth = 0.5;
                ctx.setLineDash([2, 2]);
                
                // Draw 5 horizontal grid lines
                for (let i = 0; i <= 4; i++) {
                  const y = macdTop + 20 + (i / 4) * macdHeight;
                  ctx.beginPath();
                  ctx.moveTo(chartArea.left, y);
                  ctx.lineTo(chartArea.right, y);
                  ctx.stroke();
                }
                ctx.setLineDash([]);
                
                // Draw value labels on the LEFT side (y-axis style)
                ctx.font = '10px Arial';
                ctx.textAlign = 'right';
                
                // Max value label
                const maxY = macdTop + 20;
                const maxText = maxVal.toFixed(1);
                ctx.fillStyle = '#64748b';
                ctx.fillText(maxText, chartArea.left - 5, maxY + 3);
                
                // Zero line label
                const zeroText = '0';
                ctx.fillStyle = '#64748b';
                ctx.fillText(zeroText, chartArea.left - 5, zeroY + 3);
                
                // Min value label
                const minY = macdTop + 20 + macdHeight;
                const minText = minVal.toFixed(1);
                ctx.fillStyle = '#64748b';
                ctx.fillText(minText, chartArea.left - 5, minY + 3);
                
                ctx.textAlign = 'left'; // Reset text align
                
                // Draw zero line (emphasized)
                ctx.strokeStyle = 'rgba(156, 163, 175, 0.7)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(chartArea.left, zeroY);
                ctx.lineTo(chartArea.right, zeroY);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // Draw histogram bars (skip first bar)
                const barWidth = canvasWidth / visibleDataCount;
                for (let i = 1; i < visibleHistogram.length; i++) { // Start from 1 to skip first bar
                  const value = visibleHistogram[i];
                  if (!isNaN(value)) {
                    const x = chartArea.left + (i / (visibleDataCount - 1)) * canvasWidth;
                    const barHeight = (value / range) * macdHeight;
                    const y = zeroY - barHeight;
                    
                    ctx.fillStyle = value >= 0 ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)';
                    ctx.fillRect(x - barWidth/2, Math.min(zeroY, y), barWidth * 0.8, Math.abs(barHeight));
                  }
                }
                
                // Draw MACD line
                ctx.beginPath();
                ctx.strokeStyle = '#ff9f40';
                ctx.lineWidth = 2;
                let firstPoint = true;
                for (let i = 0; i < visibleMacdLine.length; i++) {
                  const value = visibleMacdLine[i];
                  if (!isNaN(value)) {
                    const x = chartArea.left + (i / (visibleDataCount - 1)) * canvasWidth;
                    const y = macdTop + 20 + ((maxVal - value) / range) * macdHeight;
                    
                    if (firstPoint) {
                      ctx.moveTo(x, y);
                      firstPoint = false;
                    } else {
                      ctx.lineTo(x, y);
                    }
                  }
                }
                ctx.stroke();
                
                // Draw Signal line
                ctx.beginPath();
                ctx.strokeStyle = '#ff6384';
                ctx.lineWidth = 1.5;
                firstPoint = true;
                for (let i = 0; i < visibleSignalLine.length; i++) {
                  const value = visibleSignalLine[i];
                  if (!isNaN(value)) {
                    const x = chartArea.left + (i / (visibleDataCount - 1)) * canvasWidth;
                    const y = macdTop + 20 + ((maxVal - value) / range) * macdHeight;
                    
                    if (firstPoint) {
                      ctx.moveTo(x, y);
                      firstPoint = false;
                    } else {
                      ctx.lineTo(x, y);
                    }
                  }
                }
                ctx.stroke();
              }
              
              currentBottom = macdBottom;
            }
            
            ctx.restore();
          }
        }],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: {
              left: 0,
              right: 0,
              top: 0,
              bottom: 0
            }
          },
          onHover: (event: any, elements: any) => {
            if (this.showCrosshair) {
              const canvas = this.chartCanvasRef.nativeElement;
              const rect = canvas.getBoundingClientRect();
              this.crosshairX = event.native.clientX - rect.left;
              this.crosshairY = event.native.clientY - rect.top;
              this.chart.update('none');
            }
          },
          interaction: {
            intersect: true,
            mode: 'point'
          },
          plugins: {
            legend: { display: false },
            title: { 
              display: false
            },
            tooltip: {
              filter: function(tooltipItem: any) {
                // Only show tooltip when directly over a candle
                return tooltipItem.datasetIndex === 0;
              },
              callbacks: {
                title: (context: any) => {
                  const index = this.startIndex + context[0].dataIndex;
                  return this.allDates[index]?.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  }) || '';
                },
                label: (context: any) => {
                  const data = context.raw;
                  return [
                    `Open: $${data.o.toFixed(2)}`,
                    `High: $${data.h.toFixed(2)}`,
                    `Low: $${data.l.toFixed(2)}`,
                    `Close: $${data.c.toFixed(2)}`
                  ];
                }
              }
            }
          },
          scales: {
            x: { 
              type: 'category',
              grid: { color: '#eee' },
              offset: false,
              ticks: {
                maxTicksLimit: 20,
                padding: 12,
                callback: function(value: any, index: number) {
                  const actualIndex = (this as any).chart.data.labels[index];
                  return actualIndex;
                }
              }
            },
            y: { 
              beginAtZero: false, 
              grid: { color: '#eee' },
              grace: '10%',
              position: 'left',
              ticks: {
                stepSize: undefined,
                maxTicksLimit: 16,
                count: 16,
                callback: function(value: any) {
                  return `$${value.toFixed(2)}`;
                }
              }
            }
          }
        }
      });
    }
  }

  private updateChart(): void {
    if (!this.chart || this.allOhlcData.length === 0) return;

    // Calculate visible range
    const visibleData = this.allOhlcData.slice(this.startIndex, this.endIndex + 1);
    const visibleLabels = this.allLabels.slice(this.startIndex, this.endIndex + 1);
    
    // Create indexed data for category scale
    const chartData = visibleData.map((item, index) => ({
      x: index,
      o: item.o,
      h: item.h,
      l: item.l,
      c: item.c
    }));

    // Dynamic spacing based on visible days
    const canvasWidth = this.chartCanvasRef.nativeElement.clientWidth || 800;
    const availableWidth = canvasWidth - 60; // Account for y-axis labels only
    const dataCount = visibleData.length;
    
    // Calculate optimal candle width based on available space
    let optimalCandleWidth: number;
    let categoryPercentage: number;
    
    if (dataCount <= 50) {
      // For small datasets, use wider candles with minimal spacing
      optimalCandleWidth = Math.min(15, availableWidth / dataCount * 0.8);
      categoryPercentage = 1.0; // Use full width for few candles
    } else if (dataCount <= 100) {
      // Medium datasets
      optimalCandleWidth = Math.min(10, availableWidth / dataCount * 0.75);
      categoryPercentage = 0.98;
    } else if (dataCount <= 200) {
      // Large datasets
      optimalCandleWidth = Math.max(3, Math.min(7, availableWidth / dataCount * 0.8));
      categoryPercentage = 0.95;
    } else {
      // Very large datasets (255 days), use thinner candles with slightly more spacing
      optimalCandleWidth = Math.max(2, Math.min(5, availableWidth / dataCount * 0.75));
      categoryPercentage = 0.92; // Still leave minimal spacing for readability
    }
    
    // Ensure minimum and maximum limits
    optimalCandleWidth = Math.max(2, Math.min(15, optimalCandleWidth));

    // Update chart data
    this.chart.data.labels = visibleLabels;
    this.chart.data.datasets[0].data = chartData;
    
    // Update candle spacing dynamically
    this.chart.data.datasets[0].barThickness = optimalCandleWidth;
    this.chart.data.datasets[0].categoryPercentage = categoryPercentage;
    
    // Add technical indicators
    this.addIndicatorsToChart();
    
    this.chart.update('none');
  }

  onVisibleDaysChange(): void {
    this.visibleDays = Math.max(this.MIN_VISIBLE_DAYS, Math.min(this.visibleDays, this.maxVisibleDays));
    this.endIndex = Math.min(this.startIndex + this.visibleDays - 1, this.allOhlcData.length - 1);
    this.maxStartIndex = Math.max(0, this.allOhlcData.length - this.visibleDays);
    this.startIndex = Math.min(this.startIndex, this.maxStartIndex);
    this.updateChart();
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    
    const delta = event.deltaY > 0 ? 10 : -10;
    const newVisibleDays = Math.max(this.MIN_VISIBLE_DAYS, 
                                   Math.min(this.maxVisibleDays, this.visibleDays + delta));
    
    if (newVisibleDays !== this.visibleDays) {
      this.visibleDays = newVisibleDays;
      this.onVisibleDaysChange();
    }
  }

  getDateLabel(index: number): string {
    return this.allDates[index]?.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: '2-digit'
    }) || '';
  }

  // Mouse drag handlers
  onMouseDown(event: MouseEvent): void {
    this.isDragging = true;
    this.lastMouseX = event.clientX;
    this.dragStartIndex = this.startIndex;
    this.chartCanvasRef.nativeElement.style.cursor = 'move';
    event.preventDefault();
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.isDragging) return;
    
    const deltaX = event.clientX - this.lastMouseX;
    this.handleDrag(deltaX);
    event.preventDefault();
  }

  onMouseUp(event: MouseEvent): void {
    this.isDragging = false;
    this.chartCanvasRef.nativeElement.style.cursor = 'crosshair';
    event.preventDefault();
  }

  onMouseEnter(event: MouseEvent): void {
    // Enable crosshair when mouse enters the chart
    this.showCrosshair = true;
    event.preventDefault();
  }

  onMouseLeave(event: MouseEvent): void {
    this.isDragging = false;
    this.showCrosshair = false;
    this.chartCanvasRef.nativeElement.style.cursor = 'crosshair';
    if (this.chart) {
      this.chart.update('none');
    }
    event.preventDefault();
  }

  // Touch drag handlers
  onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      this.isDragging = true;
      this.lastTouchX = event.touches[0].clientX;
      this.dragStartIndex = this.startIndex;
      event.preventDefault();
    }
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.isDragging || event.touches.length !== 1) return;
    
    const deltaX = event.touches[0].clientX - this.lastTouchX;
    this.handleDrag(deltaX);
    this.lastTouchX = event.touches[0].clientX;
    event.preventDefault();
  }

  onTouchEnd(event: TouchEvent): void {
    this.isDragging = false;
    event.preventDefault();
  }

  // Common drag logic
  private handleDrag(deltaX: number): void {
    const canvasWidth = this.chartCanvasRef.nativeElement.clientWidth || 800;
    const sensitivity = this.visibleDays / canvasWidth; // pixels to days ratio
    const daysDelta = Math.round(-deltaX * sensitivity);
    
    const newStartIndex = Math.max(0, Math.min(this.maxStartIndex, this.dragStartIndex + daysDelta));
    
    if (newStartIndex !== this.startIndex) {
      this.startIndex = newStartIndex;
      this.endIndex = Math.min(this.startIndex + this.visibleDays - 1, this.allOhlcData.length - 1);
      this.updateChart();
    }
  }

  // Real-time SignalR methods
  private async startSignalRConnection(): Promise<void> {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl('http://localhost:5117/stockHub')
      .build();

    this.hubConnection.start()
      .then(() => {
        console.log('SignalR Connected');
        this.isConnected = true;
        // Join the stock group for the symbol we're tracking
        this.joinStockGroup(this.currentSymbol);
        
        // Listen for price updates
        this.hubConnection?.on('ReceiveStockUpdate', (priceUpdate) => {
          console.log('Received stock update:', priceUpdate);
          if (priceUpdate.symbol === this.currentSymbol) {
            this.updateCurrentCandle(priceUpdate);
          }
        });
      })
      .catch(err => {
        console.log('Error while starting connection: ' + err);
        this.isConnected = false;
      });

    this.hubConnection.onclose(() => {
      this.isConnected = false;
      console.log('SignalR connection closed');
    });
  }

  private async joinStockGroup(symbol: string): Promise<void> {
    if (this.hubConnection) {
      try {
        await this.hubConnection.invoke('JoinStockGroup', symbol);
        console.log(`Joined group for ${symbol}`);
      } catch (err) {
        console.error(`Error joining group for ${symbol}:`, err);
      }
    }
  }

  private async leaveStockGroup(symbol: string): Promise<void> {
    if (this.hubConnection) {
      try {
        await this.hubConnection.invoke('LeaveStockGroup', symbol);
        console.log(`Left group for ${symbol}`);
      } catch (err) {
        console.error(`Error leaving group for ${symbol}:`, err);
      }
    }
  }

  public async switchSymbol(newSymbol: string): Promise<void> {
    if (newSymbol !== this.currentSymbol) {
      // Leave current symbol group
      await this.leaveStockGroup(this.currentSymbol);
      
      // Update current symbol
      this.currentSymbol = newSymbol;
      
      // Save to localStorage for persistence
      localStorage.setItem('lastViewedStock', newSymbol);
      
      // Join new symbol group
      await this.joinStockGroup(newSymbol);
      
      // Reset price tracking
      this.lastPrice = 0;
      this.lastCandleGlow = false;
      
      // Load new chart data for the new symbol
      await this.loadStockData(newSymbol);
    }
  }

  public onSymbolChange(event: any): void {
    const selectedSymbol = event.target.value;
    this.switchSymbol(selectedSymbol);
  }

  // Search functionality methods
  public onSearchInput(event: any): void {
    const query = event.target.value.toLowerCase();
    this.searchQuery = query;
    
    if (query.length > 0) {
      this.filteredStocks = this.stockDatabase.filter(stock => 
        stock.symbol.toLowerCase().includes(query) ||
        stock.name.toLowerCase().includes(query) ||
        stock.category.toLowerCase().includes(query)
      ).slice(0, 8); // Limit to 8 results
      this.showDropdown = true;
    } else {
      this.filteredStocks = [];
      this.showDropdown = false;
    }
  }

  public onSearchBlur(): void {
    // Delay hiding to allow click events
    setTimeout(() => {
      this.showDropdown = false;
    }, 200);
  }

  public selectStock(stock: any): void {
    this.searchQuery = `${stock.symbol} - ${stock.name}`;
    this.showDropdown = false;
    this.switchSymbol(stock.symbol);
  }

  public clearSearch(): void {
    this.searchQuery = '';
    this.filteredStocks = [];
    this.showDropdown = false;
  }

  public getStockName(symbol: string): string {
    const stock = this.stockDatabase.find(s => s.symbol === symbol);
    return stock ? stock.name : symbol;
  }

  // Chart control methods
  public zoomIn(): void {
    const newVisibleDays = Math.max(this.MIN_VISIBLE_DAYS, this.visibleDays - 20);
    if (newVisibleDays !== this.visibleDays) {
      this.visibleDays = newVisibleDays;
      this.onVisibleDaysChange();
    }
  }

  public zoomOut(): void {
    const newVisibleDays = Math.min(this.maxVisibleDays, this.visibleDays + 20);
    if (newVisibleDays !== this.visibleDays) {
      this.visibleDays = newVisibleDays;
      this.onVisibleDaysChange();
    }
  }

  public resetZoom(): void {
    this.visibleDays = Math.min(90, this.allOhlcData.length);
    this.startIndex = Math.max(0, this.allOhlcData.length - this.visibleDays);
    this.endIndex = this.allOhlcData.length - 1;
    this.updateChart();
  }

  private stopSignalRConnection(): void {
    if (this.hubConnection) {
      this.leaveStockGroup(this.currentSymbol);
      this.hubConnection.stop();
    }
  }

  private updateCurrentCandle(priceData: any): void {
    if (this.allOhlcData.length === 0) return;

    const now = new Date();
    const lastDate = this.allDates[this.allDates.length - 1];
    const isSameDay = lastDate && 
      now.toDateString() === lastDate.toDateString();

    // Check if price changed to trigger glow
    const priceChanged = this.lastPrice !== 0 && this.lastPrice !== priceData.price;
    
    if (isSameDay) {
      // Update existing current day candle
      const lastIndex = this.allOhlcData.length - 1;
      const currentCandle = this.allOhlcData[lastIndex];
      
      // Update only high, low, and close - keep original open
      currentCandle.h = Math.max(currentCandle.h, priceData.price);
      currentCandle.l = Math.min(currentCandle.l, priceData.price);
      currentCandle.c = priceData.price;
      
      // Trigger glow effect if price changed
      if (priceChanged) {
        this.lastCandleGlow = true;
        this.glowStartTime = Date.now();
        this.priceIncreased = priceData.price > this.lastPrice; // Track direction
      }
      
      // Only update chart if this candle is visible
      if (lastIndex >= this.startIndex && lastIndex <= this.endIndex) {
        this.updateChartDataOnly();
      }
    } else {
      // Add new candle for new day
      this.allOhlcData.push({
        o: priceData.price,
        h: priceData.price,
        l: priceData.price,
        c: priceData.price
      });
      this.allLabels.push(now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      this.allDates.push(now);
      
      // Update ranges
      this.maxStartIndex = Math.max(0, this.allOhlcData.length - this.MIN_VISIBLE_DAYS);
      
      // If we're viewing the end of data, scroll to include new candle
      if (this.endIndex === this.allOhlcData.length - 2) {
        this.endIndex = this.allOhlcData.length - 1;
        this.startIndex = Math.max(0, this.endIndex - this.visibleDays + 1);
      }
      
      // Trigger glow for new candle (compare with previous day's close)
      if (this.lastPrice !== 0) {
        this.lastCandleGlow = true;
        this.glowStartTime = Date.now();
        this.priceIncreased = priceData.price > this.lastPrice;
      }
      
      this.updateChart();
    }
    
    // Update last price for next comparison
    this.lastPrice = priceData.price;
  }

  private updateChartDataOnly(): void {
    if (!this.chart) return;
    
    // Efficiently update only the visible data without full chart rebuild
    const visibleData = this.allOhlcData.slice(this.startIndex, this.endIndex + 1);
    const chartData = visibleData.map((item, index) => ({
      x: index,
      o: item.o,
      h: item.h,
      l: item.l,
      c: item.c
    }));
    
    this.chart.data.datasets[0].data = chartData;
    this.chart.update('none'); // Fast update without animations
  }

  // Wallet management methods
  loadUserBalance(): void {
    this.walletService.getBalance().subscribe({
      next: (response) => {
        this.userBalance = response.balance;
      },
      error: (error) => {
        console.error('Error loading balance:', error);
        this.showError('Error loading balance');
      }
    });
  }

  closeWalletModal(): void {
    this.showWalletModal = false;
    // Refresh balance when closing modal
    this.loadUserBalance();
  }

  showError(message: string): void {
    this.errorMessage = message;
    setTimeout(() => {
      this.errorMessage = '';
    }, 5000);
  }

  clearError(): void {
    this.errorMessage = '';
  }

  navigateToPortfolio(): void {
    this.router.navigate(['/portfolio']);
    this.showUserMenu = false;
  }

  navigateToDashboard(): void {
    // Already on dashboard, just close the menu
    this.showUserMenu = false;
  }

  navigateToWallet(): void {
    this.router.navigate(['/wallet']);
    this.showUserMenu = false;
  }

  navigateToTransactions(): void {
    this.router.navigate(['/transactions']);
    this.showUserMenu = false;
  }

  logout(): void {
    // Use AuthService logout which properly clears authentication state
    this.authService.logout();
    
    // Close user menu
    this.showUserMenu = false;
    
    // Stop SignalR connection
    this.stopSignalRConnection();
    
    // Navigate to login page with replaceUrl to prevent going back
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  // Trading methods
  openBuyModal(): void {
    if (!this.currentSymbol) return;
    
    this.buyPrice = this.getCurrentPrice();
    this.buyQuantity = 1;
    this.tradingError = '';
    this.tradingSuccess = '';
    this.showBuyModal = true;
  }

  openSellModal(): void {
    if (!this.currentSymbol) return;
    
    this.sellPrice = this.getCurrentPrice();
    this.sellQuantity = 1;
    this.tradingError = '';
    this.tradingSuccess = '';
    this.showSellModal = true;
  }

  closeBuyModal(): void {
    this.showBuyModal = false;
    this.tradingError = '';
    this.tradingSuccess = '';
  }

  closeSellModal(): void {
    this.showSellModal = false;
    this.tradingError = '';
    this.tradingSuccess = '';
  }

  getCurrentPrice(): number {
    // Get the current price from the latest chart data
    if (this.allOhlcData && this.allOhlcData.length > 0) {
      const latestData = this.allOhlcData[this.allOhlcData.length - 1];
      return latestData.c; // Close price
    }
    return 0;
  }

  async executeBuyOrder(): Promise<void> {
    if (!this.currentSymbol || this.buyQuantity <= 0 || this.buyPrice <= 0) {
      this.tradingError = 'Please enter valid quantity and price';
      return;
    }

    const totalCost = this.buyQuantity * this.buyPrice;
    if (totalCost > this.userBalance) {
      this.tradingError = 'Insufficient balance';
      return;
    }

    try {
      this.isTrading = true;
      this.tradingError = '';

      const order: BuyOrderRequest = {
        Symbol: this.currentSymbol,
        Quantity: Number(this.buyQuantity.toFixed(8)), // Ensure proper decimal format
        PricePerUnit: Number(this.buyPrice.toFixed(2))
      };

      const response = await this.portfolioService.createBuyOrder(order).toPromise();
      
      if (response!.success) {
        this.tradingSuccess = response!.message;
        
        // Update balance immediately for instant feedback
        this.balanceStreamService.subtractFromBalance(totalCost);
        
        // Close modal after short delay
        setTimeout(() => {
          this.closeBuyModal();
        }, 2000);
        
        // Refresh balance from server to ensure accuracy
        await this.balanceStreamService.forceRefresh();
      } else {
        this.tradingError = response!.message;
      }
    } catch (error: any) {
      this.tradingError = 'Failed to execute buy order: ' + (error.message || 'Unknown error');
    } finally {
      this.isTrading = false;
    }
  }

  async executeSellOrder(): Promise<void> {
    if (!this.currentSymbol || this.sellQuantity <= 0 || this.sellPrice <= 0) {
      this.tradingError = 'Please enter valid quantity and price';
      return;
    }

    try {
      this.isTrading = true;
      this.tradingError = '';

      const order: SellOrderRequest = {
        Symbol: this.currentSymbol,
        Quantity: Number(this.sellQuantity.toFixed(8)), // Ensure proper decimal format
        PricePerUnit: Number(this.sellPrice.toFixed(2))
      };

      const response = await this.portfolioService.createSellOrder(order).toPromise();
      
      if (response!.success) {
        this.tradingSuccess = response!.message;
        
        // Update balance immediately for instant feedback
        const totalProceeds = this.sellQuantity * this.sellPrice;
        this.balanceStreamService.addToBalance(totalProceeds);
        
        // Close modal after short delay
        setTimeout(() => {
          this.closeSellModal();
        }, 2000);
        
        // Refresh balance from server to ensure accuracy
        await this.balanceStreamService.forceRefresh();
      } else {
        this.tradingError = response!.message;
      }
    } catch (error: any) {
      this.tradingError = 'Failed to execute sell order: ' + (error.message || 'Unknown error');
    } finally {
      this.isTrading = false;
    }
  }

  // Technical Indicators Methods
  toggleIndicatorsMenu(): void {
    this.showIndicatorsMenu = !this.showIndicatorsMenu;
  }

  toggleIndicator(indicator: string): void {
    this.indicators = {
      ...this.indicators,
      [indicator]: !this.indicators[indicator as keyof typeof this.indicators]
    };
    this.updateChart();
  }

  private calculateSMA(data: number[], period: number = 20): number[] {
    const sma: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        sma.push(NaN);
      } else {
        const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        sma.push(sum / period);
      }
    }
    return sma;
  }

  private calculateEMA(data: number[], period: number = 20): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        ema.push(data[i]);
      } else {
        ema.push((data[i] * multiplier) + (ema[i - 1] * (1 - multiplier)));
      }
    }
    return ema;
  }

  private calculateRSI(data: number[], period: number = 14): number[] {
    const rsi: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i < data.length; i++) {
      const change = data[i] - data[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    for (let i = 0; i < data.length; i++) {
      if (i < period) {
        rsi.push(NaN);
      } else {
        const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
        const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
        const rs = avgGain / (avgLoss || 1);
        rsi.push(100 - (100 / (1 + rs)));
      }
    }
    return rsi;
  }

  private calculateBollingerBands(data: number[], period: number = 20, stdDev: number = 2): { upper: number[], middle: number[], lower: number[] } {
    const sma = this.calculateSMA(data, period);
    const upper: number[] = [];
    const lower: number[] = [];

    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        upper.push(NaN);
        lower.push(NaN);
      } else {
        const slice = data.slice(i - period + 1, i + 1);
        const mean = sma[i];
        const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
        const std = Math.sqrt(variance);
        
        upper.push(mean + (stdDev * std));
        lower.push(mean - (stdDev * std));
      }
    }

    return { upper, middle: sma, lower };
  }

  private calculateMACD(data: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): { macd: number[], signal: number[], histogram: number[] } {
    const fastEMA = this.calculateEMA(data, fastPeriod);
    const slowEMA = this.calculateEMA(data, slowPeriod);
    
    const macd: number[] = [];
    for (let i = 0; i < data.length; i++) {
      macd.push(fastEMA[i] - slowEMA[i]);
    }
    
    const signal = this.calculateEMA(macd, signalPeriod);
    const histogram: number[] = [];
    for (let i = 0; i < macd.length; i++) {
      histogram.push(macd[i] - signal[i]);
    }
    
    return { macd, signal, histogram };
  }

  private addIndicatorsToChart(): void {
    if (!this.chart || !this.allOhlcData.length) return;

    // Calculate indicators on ALL data, then slice for visibility
    const allClosePrices = this.allOhlcData.map(d => d.c);

    // Calculate dynamic bottom padding based on active indicators
    let bottomPadding = 0;
    const indicatorHeight = 160; // Height for each indicator panel
    const xAxisSpace = 35; // Space for x-axis labels (increased to avoid overlap)
    
    if (this.indicators.rsi) bottomPadding += indicatorHeight;
    if (this.indicators.macd) bottomPadding += indicatorHeight;
    
    // Add space for x-axis labels if any indicators are active
    if (bottomPadding > 0) bottomPadding += xAxisSpace;
    
    // Update layout padding
    if (this.chart.options.layout?.padding) {
      (this.chart.options.layout.padding as any).bottom = bottomPadding;
    }
    
    // Update y-axis scales visibility
    if (this.chart.options.scales) {
      // Configure RSI axis
      if (this.chart.options.scales.yRSI) {
        (this.chart.options.scales.yRSI as any).display = this.indicators.rsi;
      }
      
      // Configure MACD axis
      if (this.chart.options.scales.yMACD) {
        (this.chart.options.scales.yMACD as any).display = this.indicators.macd;
      }
    }

    // Remove existing indicator datasets (keep the main candlestick dataset)
    this.chart.data.datasets = this.chart.data.datasets.filter((dataset: any) => {
      const label = dataset.label || '';
      const type = dataset.type;
      
      // Keep only candlestick data (remove all indicator lines and bars)
      if (type === 'line' || type === 'bar') {
        // Check if this is an indicator
        return !label.includes('SMA') && 
               !label.includes('EMA') && 
               !label.includes('BB') && 
               !label.includes('RSI') && 
               !label.includes('MACD') &&
               !label.includes('Histogram');
      }
      
      // Keep candlestick dataset
      return true;
    });

    // Add SMA
    if (this.indicators.sma) {
      const allSma = this.calculateSMA(allClosePrices);
      const visibleSma = allSma.slice(this.startIndex, this.endIndex + 1);
      const smaData = visibleSma.map((value, index) => ({
        x: index,
        y: isNaN(value) ? null : value
      }));
      
      this.chart.data.datasets.push({
        label: 'SMA (20)',
        data: smaData,
        type: 'line',
        borderColor: '#ff6384',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1,
        spanGaps: true
      });
    }

    // Add EMA
    if (this.indicators.ema) {
      const allEma = this.calculateEMA(allClosePrices);
      const visibleEma = allEma.slice(this.startIndex, this.endIndex + 1);
      const emaData = visibleEma.map((value, index) => ({
        x: index,
        y: isNaN(value) ? null : value
      }));
      
      this.chart.data.datasets.push({
        label: 'EMA (20)',
        data: emaData,
        type: 'line',
        borderColor: '#36a2eb',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1,
        spanGaps: true
      });
    }

    // Add RSI (store data for custom panel drawing)
    if (this.indicators.rsi) {
      this.rsiData = this.calculateRSI(allClosePrices);
    } else {
      this.rsiData = [];
    }

    // Add MACD (store data for custom panel drawing)
    if (this.indicators.macd) {
      this.macdData = this.calculateMACD(allClosePrices);
    } else {
      this.macdData = null;
    }

    // Add Bollinger Bands
    if (this.indicators.bb) {
      const allBb = this.calculateBollingerBands(allClosePrices);
      const visibleUpper = allBb.upper.slice(this.startIndex, this.endIndex + 1);
      const visibleLower = allBb.lower.slice(this.startIndex, this.endIndex + 1);
      
      const upperData = visibleUpper.map((value, index) => ({
        x: index,
        y: isNaN(value) ? null : value
      }));
      
      const lowerData = visibleLower.map((value, index) => ({
        x: index,
        y: isNaN(value) ? null : value
      }));
      
      this.chart.data.datasets.push(
        {
          label: 'BB Upper',
          data: upperData,
          type: 'line',
          borderColor: '#9966ff',
          backgroundColor: 'rgba(153, 102, 255, 0.1)',
          borderWidth: 1,
          pointRadius: 0,
          fill: false,
          spanGaps: true
        },
        {
          label: 'BB Lower',
          data: lowerData,
          type: 'line',
          borderColor: '#9966ff',
          backgroundColor: 'rgba(153, 102, 255, 0.1)',
          borderWidth: 1,
          pointRadius: 0,
          fill: '+1',
          spanGaps: true
        }
      );
    }
  }

  ngOnDestroy(): void {
    this.stopSignalRConnection();
    this.subscriptions.unsubscribe();
  }
}
