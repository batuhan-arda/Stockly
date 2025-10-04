import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { PortfolioService, PortfolioSummary, Holding, Stock, BuyOrderRequest, SellOrderRequest } from '../services/portfolio.service';
import { WalletService } from '../services/wallet.service';
import { BalanceStreamService } from '../services/balance-stream.service';
import { AuthService } from '../services/auth.service';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="portfolio-container">
      <!-- Dashboard Header -->
      <header class="dashboard-header">
        <!-- Left side: Portfolio Title and Summary -->
        <div class="left-header-section">
          <div class="current-stock-info">
            <div class="stock-details">
              <div class="portfolio-title-row">
                <h1 class="stock-title">Portfolio</h1>
                <div class="portfolio-summary-inline" *ngIf="portfolioSummary">
                  <span class="total-value">\${{ portfolioSummary.totalValue | number:'1.2-2' }}</span>
                  <span class="gain-loss-info" [ngClass]="portfolioSummary.totalGainLoss >= 0 ? 'positive' : 'negative'">
                    (\${{ portfolioSummary.totalGainLoss | number:'1.2-2' }} / {{ portfolioSummary.totalGainLossPercentage | number:'1.2-2' }}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Side: Balance and User Menu -->
        <div class="right-header-section">
          <!-- Balance Display -->
          <div class="balance-display" [ngClass]="balanceGlowClass">
            \${{ balance | number:'1.2-2' }}
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

      <!-- Portfolio Distribution Chart -->
      <div class="chart-section" *ngIf="portfolioSummary && portfolioSummary.holdings && portfolioSummary.holdings.length > 0">
        <h2>Portfolio Distribution</h2>
        <div class="chart-container">
          <canvas #portfolioChart></canvas>
        </div>
      </div>

      <!-- Holdings List -->
      <div class="holdings-section" *ngIf="portfolioSummary && portfolioSummary.holdings && portfolioSummary.holdings.length > 0">
        <div class="holdings-table">
          <div class="table-header">
            <div class="col header-center">Symbol</div>
            <div class="col header-right">Quantity</div>
            <div class="col header-right">Avg Price</div>
            <div class="col header-right">Current Price</div>
            <div class="col header-right">Total Value</div>
            <div class="col header-right">Total Profit/Loss</div>
            <div class="col header-center">Actions</div>
          </div>
          <div class="table-row" *ngFor="let holding of portfolioSummary!.holdings">
            <div class="col symbol">{{ holding.symbol }}</div>
            <div class="col numeric">{{ holding.quantityOwned }}</div>
            <div class="col numeric">\${{ holding.averagePrice | number:'1.2-2' }}</div>
            <div class="col numeric">\${{ holding.currentPrice | number:'1.2-2' }}</div>
            <div class="col numeric">\${{ holding.totalValue | number:'1.2-2' }}</div>
            <div class="col gain-loss" [ngClass]="holding.gainLoss >= 0 ? 'positive' : 'negative'">
              \${{ holding.gainLoss | number:'1.2-2' }} 
              ({{ holding.gainLossPercentage | number:'1.2-2' }}%)
            </div>
            <div class="col actions">
              <button class="btn btn-sell" (click)="openGeneralSellModalForHolding(holding)">Sell</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Buy Modal -->
      <div class="modal" *ngIf="showBuyModal" (click)="closeBuyModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h3>Buy {{ selectedStock?.symbol }}</h3>
          <div class="form-group">
            <label>Quantity:</label>
            <input type="number" [(ngModel)]="buyQuantity" min="1" class="form-input">
          </div>
          <div class="form-group">
            <label>Price per share:</label>
            <input type="number" [(ngModel)]="buyPrice" step="0.01" min="0.01" class="form-input">
          </div>
          <div class="form-group">
            <label>Total Cost: \${{ (buyQuantity * buyPrice) | number:'1.2-2' }}</label>
          </div>
          <div class="modal-actions">
            <button class="btn btn-cancel" (click)="closeBuyModal()">Cancel</button>
            <button class="btn btn-buy" (click)="executeBuyOrder()" [disabled]="isProcessing">
              {{ isProcessing ? 'Processing...' : 'Buy' }}
            </button>
          </div>
        </div>
      </div>

      <!-- General Sell Modal -->
      <div class="modal-overlay" *ngIf="showGeneralSellModal" (click)="closeGeneralSellModal()">
        <div class="modal-content trading-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Sell {{ selectedHoldingForSale?.symbol || 'Holdings' }}</h2>
            <button class="close-btn" (click)="closeGeneralSellModal()">×</button>
          </div>
          <div class="modal-body">
            <div class="stock-info-display" *ngIf="selectedHoldingForSale">
              <div class="info-row">
                <span class="label">Current Price:</span>
                <span class="value">\${{ selectedHoldingForSale.currentPrice | number:'1.2-2' }}</span>
              </div>
              <div class="info-row">
                <span class="label">Quantity Owned:</span>
                <span class="value">{{ selectedHoldingForSale.quantityOwned }}</span>
              </div>
            </div>
            
            <div class="form-group" *ngIf="selectedHoldingForSale">
              <label for="generalSellQuantity">Quantity:</label>
              <input type="number" id="generalSellQuantity" [(ngModel)]="generalSellQuantity" 
                     [max]="selectedHoldingForSale.quantityOwned" min="0.00000001" step="0.00000001" class="form-input">
            </div>
            
            <div class="form-group" *ngIf="selectedHoldingForSale">
              <label for="generalSellPrice">Price per share:</label>
              <input type="number" id="generalSellPrice" [(ngModel)]="generalSellPrice" min="0.01" step="0.01" class="form-input">
            </div>
            
            <div class="total-proceeds" *ngIf="selectedHoldingForSale">
              <strong>Total Proceeds: \${{ (generalSellQuantity * generalSellPrice) | number:'1.2-2' }}</strong>
            </div>
            
            <div class="error-message" *ngIf="error">{{ error }}</div>
            <div class="success-message" *ngIf="successMessage">{{ successMessage }}</div>
            
            <div class="modal-actions">
              <button class="btn-secondary" (click)="closeGeneralSellModal()">Cancel</button>
              <button class="btn-primary sell-action" (click)="executeGeneralSellOrder()" 
                      [disabled]="isProcessing || !selectedHoldingForSale || !generalSellQuantity || !generalSellPrice">
                {{ isProcessing ? 'Processing...' : 'Sell' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div class="loading" *ngIf="isLoading">
        <div class="spinner-container">
          <div class="spinner"></div>
          <p>Loading portfolio...</p>
        </div>
      </div>

      <!-- Error State -->
      <div class="error" *ngIf="error">
        <p>{{ error }}</p>
        <button class="btn btn-primary" (click)="loadPortfolio()">Retry</button>
      </div>

      <!-- Success Message -->
      <div class="success-message" *ngIf="successMessage">
        {{ successMessage }}
      </div>
    </div>
  `,
  styles: [`
    * {
      box-sizing: border-box;
    }

    .portfolio-container {
      min-height: 100vh;
      max-height: 100vh;
      overflow-y: auto;
      background: #f8fafc;
      color: #333;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    /* Dashboard Header Styles */
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

    .stock-details {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }

    .portfolio-title-row {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .portfolio-summary-inline {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.95rem;
    }

    .portfolio-summary-inline .total-value {
      color: #1e293b;
      font-weight: 600;
    }

    .portfolio-summary-inline .gain-loss-info {
      font-weight: 500;
      font-size: 0.9rem;
    }

    .portfolio-summary-inline .gain-loss-info.positive {
      color: #059669;
    }

    .portfolio-summary-inline .gain-loss-info.negative {
      color: #dc2626;
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

    /* Chart Section */
    .chart-section {
      margin: 0.5rem;
      background: white;
      border-radius: 8px;
      padding: 1rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .chart-section h2 {
      margin: 0 0 0.75rem 0;
      color: #1e293b;
      font-size: 1.2rem;
    }

    .chart-container {
      position: relative;
      height: 500px;
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }

    .chart-container canvas {
      max-width: 500px !important;
      max-height: 500px !important;
      width: 500px !important;
      height: 500px !important;
      margin: 0 auto;
    }

    /* Holdings Section */
    .holdings-section {
      margin: 0.5rem;
      background: white;
      border-radius: 8px;
      padding: 1rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .holdings-section h2 {
      margin: 0 0 0.75rem 0;
      color: #1e293b;
      font-size: 1.2rem;
    }

    .holdings-table {
      overflow-x: auto;
      width: 100%;
      /* Define shared MIN widths; columns expand to fill via fr */
      --col-symbol-min: 80px;
      --col-qty-min: 70px;
      --col-avg-min: 110px;
      --col-current-min: 110px;
      --col-total-min: 120px;
      --col-gain-min: 140px;
      --col-actions-min: 70px;
    }

    .table-header {
      display: grid;
      /* 7 equal columns that fill available width, with sensible minimums */
      grid-template-columns:
        minmax(var(--col-symbol-min), 1fr)
        minmax(var(--col-qty-min), 1fr)
        minmax(var(--col-avg-min), 1fr)
        minmax(var(--col-current-min), 1fr)
        minmax(var(--col-total-min), 1fr)
        minmax(var(--col-gain-min), 1fr)
        minmax(var(--col-actions-min), 1fr);
      gap: 0.75rem;
      padding: 0.75rem;
      background: #f8fafc;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.875rem;
      color: #374151;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .table-row {
      display: grid;
      /* Match header: equal distribution with minimums */
      grid-template-columns:
        minmax(var(--col-symbol-min), 1fr)
        minmax(var(--col-qty-min), 1fr)
        minmax(var(--col-avg-min), 1fr)
        minmax(var(--col-current-min), 1fr)
        minmax(var(--col-total-min), 1fr)
        minmax(var(--col-gain-min), 1fr)
        minmax(var(--col-actions-min), 1fr);
      gap: 0.75rem;
      padding: 1rem 0.75rem;
      border-bottom: 1px solid #f1f5f9;
      align-items: center;
    }

    .table-row:hover {
      background: #f8fafc;
    }

    .col {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      text-align: left;
      min-width: 70px; /* avoids columns collapsing too tight */
    }

    /* Prevent header labels like "CURRENT PRICE" from wrapping */
    .table-header .col { white-space: nowrap; }

    .col.symbol {
      font-weight: 600;
      color: #1e293b;
      justify-content: center;
    }

    .col.company {
      font-size: 0.875rem;
      color: #64748b;
    }

    .col.actions {
      justify-content: center;
    }

    .col.numeric {
      justify-content: flex-end;
      font-weight: 500;
      min-width: 100px;
      font-variant-numeric: tabular-nums; /* stable number widths */
    }

    .col.gain-loss {
      justify-content: flex-end;
      font-weight: 500;
      font-size: 0.875rem;
      min-width: 140px;
      font-variant-numeric: tabular-nums;
    }

    .col.positive {
      color: #059669;
    }

    .col.negative {
      color: #dc2626;
    }

    .header-left {
      justify-content: flex-start !important;
    }

    .header-center {
      justify-content: center !important;
    }

    .header-right {
      justify-content: flex-end !important;
    }

    .btn {
      border: none;
      padding: 0.4rem 0.8rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 500;
      transition: all 0.2s ease;
      white-space: nowrap;
    }

    .btn-sell {
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
      color: white;
      min-width: 50px;
    }

    .btn-sell:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(220, 38, 38, 0.3);
    }

    /* Stock Search Section */
    .stock-search-section {
      margin: 1rem;
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .stock-search-section h2 {
      margin: 0 0 1rem 0;
      color: #1e293b;
    }

    .search-input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 1rem;
      margin-bottom: 1rem;
    }

    .search-input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .stock-list {
      display: grid;
      gap: 0.75rem;
    }

    .stock-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }

    .stock-item:hover {
      background: #f1f5f9;
    }

    .buy-button {
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .buy-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
    }

    /* Modal Styles */
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
      border-radius: 12px;
      padding: 2rem;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
    }

    .modal-content h3 {
      margin: 0 0 1rem 0;
      color: #1e293b;
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
    }

    .form-group input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .modal-actions {
      display: flex;
      gap: 1rem;
      margin-top: 1.5rem;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      flex: 1;
    }

    .btn-secondary {
      background: #f3f4f6;
      color: #374151;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      flex: 1;
    }

    .btn-primary:hover, .btn-secondary:hover {
      transform: translateY(-1px);
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .trading-modal {
      max-width: 500px;
      width: 90%;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .modal-header h2 {
      margin: 0;
      color: #1e293b;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #6b7280;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .close-btn:hover {
      color: #374151;
    }

    .stock-info-display {
      background: #f8fafc;
      padding: 1rem;
      border-radius: 6px;
      margin-bottom: 1rem;
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
      color: #6b7280;
      font-weight: 500;
    }

    .info-row .value {
      color: #1e293b;
      font-weight: 600;
    }

    .total-proceeds {
      background: #f0f9ff;
      border: 1px solid #0ea5e9;
      border-radius: 6px;
      padding: 1rem;
      margin: 1rem 0;
      text-align: center;
      color: #0c4a6e;
    }

    .sell-action {
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%) !important;
    }

    .sell-action:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
    }

    .error-message {
      color: #dc2626;
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }

    .success-message {
      color: #059669;
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }

    .loading-message {
      text-align: center;
      padding: 2rem;
      color: #6b7280;
    }

    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 3rem;
      flex-direction: column;
    }

    .spinner-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f4f6;
      border-top: 4px solid #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .loading p {
      margin: 0;
      color: #6b7280;
      font-size: 1rem;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .dashboard-header {
        padding: 0.5rem;
        gap: 0.5rem;
      }

      .stock-title {
        font-size: 1.1em;
      }

      .stock-symbol-badge {
        font-size: 0.7em;
        padding: 3px 8px;
      }

      .balance-display {
        font-size: 1em;
        min-width: 100px;
      }

      .summary-cards {
        grid-template-columns: 1fr;
      }

      .table-header, .holding-row {
        grid-template-columns: 1fr;
        gap: 0.5rem;
      }

      .holding-row {
        padding: 1rem;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        margin-bottom: 0.5rem;
      }

      .modal-content {
        padding: 1.5rem;
        width: 95%;
      }
    }
  `]
})
export class PortfolioComponent implements OnInit, OnDestroy {
  @ViewChild('portfolioChart', { static: false }) chartRef!: ElementRef<HTMLCanvasElement>;

  portfolioSummary: PortfolioSummary | null = null;
  availableStocks: Stock[] = [];
  filteredStocks: Stock[] = [];
  balance: number = 0;
  searchTerm: string = '';
  
  // Modal states
  showBuyModal: boolean = false;
  showGeneralSellModal: boolean = false;
  selectedStock: Stock | null = null;
  selectedHoldingForSale: Holding | null = null;
  
  // Form data
  buyQuantity: number = 1;
  buyPrice: number = 0;
  generalSellQuantity: number = 1;
  generalSellPrice: number = 0;
  
  // UI states
  isLoading: boolean = false;
  isProcessing: boolean = false;
  error: string = '';
  successMessage: string = '';
  
  // Header properties
  showUserMenu: boolean = false;
  userName: string = 'Loading...';
  userEmail: string = 'Loading...';
  balanceGlowClass: string = '';
  previousBalance: number = 0;
  
  // Chart
  chart: Chart | null = null;

  constructor(
    private portfolioService: PortfolioService,
    private walletService: WalletService,
    private balanceStreamService: BalanceStreamService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.setupBalanceStream();
    this.loadPortfolio();
    this.loadAvailableStocks();
    this.loadUserInfo();
    this.setupClickHandler();
  }

  private setupBalanceStream() {
    // Subscribe to real-time balance updates - initialization happens automatically
    this.balanceStreamService.balance$.subscribe(balance => {
      // Handle balance glow effect
      if (this.balance > 0) {
        if (balance > this.previousBalance) {
          this.balanceGlowClass = 'balance-glow-green';
        } else if (balance < this.previousBalance) {
          this.balanceGlowClass = 'balance-glow-red';
        }
        
        setTimeout(() => {
          this.balanceGlowClass = '';
        }, 2000);
      }
      
      this.previousBalance = this.balance;
      this.balance = balance;
    });
  }

  private setupClickHandler() {
    // Close user menu when clicking outside
    document.addEventListener('click', () => {
      if (this.showUserMenu) {
        this.showUserMenu = false;
      }
    });
  }

  private async loadUserInfo() {
    try {
      this.authService.currentUser$.subscribe(user => {
        if (user) {
          this.userName = user.username || 'User';
          this.userEmail = user.email || 'user@example.com';
        } else {
          this.userName = 'User';
          this.userEmail = 'user@example.com';
        }
      });
    } catch (error) {
      console.error('Failed to load user info:', error);
      this.userName = 'User';
      this.userEmail = 'user@example.com';
    }
  }

  ngOnDestroy() {
    if (this.chart) {
      this.chart.destroy();
    }
  }

  async loadPortfolio() {
    try {
      this.isLoading = true;
      this.error = '';
      
      const response = await this.portfolioService.getPortfolio().toPromise();
      this.portfolioSummary = response!.portfolio;
      
      // Create chart after data is loaded
      setTimeout(() => this.createChart(), 100);
      
    } catch (error: any) {
      this.error = 'Failed to load portfolio: ' + (error.message || 'Unknown error');
    } finally {
      this.isLoading = false;
    }
  }

  async loadAvailableStocks() {
    try {
      const response = await this.portfolioService.getAvailableStocks().toPromise();
      this.availableStocks = response!.stocks;
      this.filteredStocks = this.availableStocks;
    } catch (error: any) {
      console.error('Failed to load stocks:', error);
    }
  }

  async loadBalance() {
    try {
      const response = await this.walletService.getBalance().toPromise();
      this.balance = response!.balance;
    } catch (error: any) {
      console.error('Failed to load balance:', error);
    }
  }

  filterStocks() {
    if (!this.searchTerm) {
      this.filteredStocks = this.availableStocks;
    } else {
      this.filteredStocks = this.availableStocks.filter(stock =>
        stock.symbol.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        stock.companyName.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }
  }

  createChart() {
    if (!this.chartRef?.nativeElement || !this.portfolioSummary?.holdings.length) {
      return;
    }

    if (this.chart) {
      this.chart.destroy();
    }

    // Set canvas size explicitly
    const canvas = this.chartRef.nativeElement;
    canvas.width = 500;
    canvas.height = 500;
    canvas.style.width = '500px';
    canvas.style.height = '500px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const holdings = this.portfolioSummary.holdings;
    const labels = holdings.map(h => h.symbol);
    const data = holdings.map(h => h.totalValue);
    const colors = this.generateColors(holdings.length);

    const config: ChartConfiguration = {
      type: 'doughnut' as ChartType,
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderWidth: 3,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: 20
        },
        elements: {
          arc: {
            borderWidth: 3
          }
        },
        plugins: {
          legend: {
            position: 'right',
            labels: {
              usePointStyle: true,
              padding: 20,
              font: {
                size: 13,
                weight: 500
              }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.parsed;
                const total = data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: $${value.toFixed(2)} (${percentage}%)`;
              }
            }
          }
        },
        onHover: (event, elements) => {
          const canvas = event.native?.target as HTMLCanvasElement;
          if (canvas) {
            canvas.style.cursor = elements.length > 0 ? 'pointer' : 'default';
          }
        }
      },
      plugins: [{
        id: 'percentageLabels',
        afterDatasetsDraw: (chart) => {
          const ctx = chart.ctx;
          const dataset = chart.data.datasets[0];
          const total = data.reduce((a, b) => a + b, 0);

          chart.getDatasetMeta(0).data.forEach((arc: any, index: number) => {
            const value = dataset.data[index] as number;
            const percentage = ((value / total) * 100);
            
            // Only show percentage if slice is larger than 8%
            if (percentage > 8) {
              const { x, y } = arc.getCenterPoint();
              
              ctx.save();
              ctx.fillStyle = '#fff';
              ctx.font = 'bold 12px Arial';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(`${percentage.toFixed(1)}%`, x, y);
              ctx.restore();
            }
          });
        }
      }]
    };

    this.chart = new Chart(ctx, config);
  }

  generateColors(count: number): string[] {
    const colors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
      '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
    ];
    
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(colors[i % colors.length]);
    }
    return result;
  }

  openBuyModal(stock: Stock) {
    this.selectedStock = stock;
    this.buyPrice = stock.currentPrice;
    this.buyQuantity = 1;
    this.showBuyModal = true;
  }

  closeBuyModal() {
    this.showBuyModal = false;
    this.selectedStock = null;
    this.clearMessages();
  }

  async executeBuyOrder() {
    if (!this.selectedStock || this.buyQuantity <= 0 || this.buyPrice <= 0) {
      this.error = 'Please enter valid quantity and price';
      return;
    }

    const totalCost = this.buyQuantity * this.buyPrice;
    if (totalCost > this.balance) {
      this.error = 'Insufficient balance';
      return;
    }

    try {
      this.isProcessing = true;
      this.clearMessages();

      const order: BuyOrderRequest = {
        Symbol: this.selectedStock.symbol,
        Quantity: this.buyQuantity,
        PricePerUnit: this.buyPrice
      };

      const response = await this.portfolioService.createBuyOrder(order).toPromise();
      
      if (response!.success) {
        this.successMessage = response!.message;
        
        // Update balance immediately for instant feedback
        this.balanceStreamService.subtractFromBalance(totalCost);
        
        this.closeBuyModal();
        await this.loadPortfolio();
        
        // Refresh balance from server to ensure accuracy
        await this.balanceStreamService.forceRefresh();
      } else {
        this.error = response!.message;
      }
    } catch (error: any) {
      this.error = 'Failed to execute buy order: ' + (error.message || 'Unknown error');
    } finally {
      this.isProcessing = false;
    }
  }

  clearMessages() {
    this.error = '';
    this.successMessage = '';
    setTimeout(() => {
      this.successMessage = '';
    }, 5000);
  }

  // General sell modal methods
  openGeneralSellModal(): void {
    this.clearMessages();
    this.selectedHoldingForSale = null;
    this.generalSellQuantity = 1;
    this.generalSellPrice = 0;
    this.showGeneralSellModal = true;
  }

  openGeneralSellModalForHolding(holding: Holding): void {
    this.clearMessages();
    this.selectedHoldingForSale = holding;
    this.generalSellQuantity = 1;
    this.generalSellPrice = holding.currentPrice;
    this.showGeneralSellModal = true;
  }

  closeGeneralSellModal(): void {
    this.showGeneralSellModal = false;
    this.selectedHoldingForSale = null;
  }

  async executeGeneralSellOrder(): Promise<void> {
    if (!this.selectedHoldingForSale || this.generalSellQuantity <= 0 || this.generalSellPrice <= 0) {
      this.error = 'Please enter valid quantity and price';
      return;
    }

    if (this.generalSellQuantity > this.selectedHoldingForSale.quantityOwned) {
      this.error = 'Cannot sell more than you own';
      return;
    }

    try {
      this.isProcessing = true;
      this.clearMessages();

      const order: SellOrderRequest = {
        Symbol: this.selectedHoldingForSale.symbol,
        Quantity: this.generalSellQuantity,
        PricePerUnit: this.generalSellPrice
      };

      const response = await this.portfolioService.createSellOrder(order).toPromise();
      
      if (response && response.success) {
        this.successMessage = `Sell order placed successfully for ${this.generalSellQuantity} shares of ${this.selectedHoldingForSale.symbol}`;
        
        // Add estimated proceeds to balance immediately for responsiveness
        const totalProceeds = this.generalSellQuantity * this.generalSellPrice;
        this.balanceStreamService.addToBalance(totalProceeds);
        
        this.closeGeneralSellModal();
        await this.loadPortfolio();
        
        // Refresh balance from server to ensure accuracy
        await this.balanceStreamService.forceRefresh();
      } else {
        this.error = response!.message;
      }
    } catch (error: any) {
      this.error = 'Failed to execute sell order: ' + (error.message || 'Unknown error');
    } finally {
      this.isProcessing = false;
    }
  }

  // Header navigation methods
  navigateToDashboard(): void {
    this.showUserMenu = false;
    this.router.navigate(['/dashboard']);
  }

  navigateToWallet(): void {
    this.showUserMenu = false;
    this.router.navigate(['/wallet']);
  }

  navigateToTransactions(): void {
    this.showUserMenu = false;
    this.router.navigate(['/transactions']);
  }

  navigateToPortfolio(): void {
    // Already on portfolio, just close the menu
    this.showUserMenu = false;
  }

  logout(): void {
    this.showUserMenu = false;
    this.authService.logout();
  }
}