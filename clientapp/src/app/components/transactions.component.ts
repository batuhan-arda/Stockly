import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TransactionsService, Transaction } from '../services/transactions.service';
import { WalletService } from '../services/wallet.service';
import { BalanceStreamService } from '../services/balance-stream.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="transactions-container">
      <!-- Dashboard Header -->
      <header class="dashboard-header">
        <!-- Left side: Transactions Title -->
        <div class="left-header-section">
          <div class="current-stock-info">
            <div class="stock-details">
              <div class="portfolio-title-row">
                <h1 class="stock-title">Transactions</h1>
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

      <!-- Content -->
      <div class="page-content">
        <!-- Loading State -->
        <div *ngIf="isLoading" class="loading-state">
          <div class="loading-spinner"></div>
          <p>Loading transactions...</p>
        </div>

        <!-- Error State -->
        <div *ngIf="errorMessage && !isLoading" class="error-state">
          <div class="error-icon">⚠️</div>
          <h3>Unable to load transactions</h3>
          <p>{{ errorMessage }}</p>
          <button class="retry-button" (click)="loadTransactions()">Try Again</button>
        </div>

        <!-- Transactions List -->
        <div *ngIf="!isLoading && !errorMessage" class="transactions-section">
          <!-- Filter Tabs -->
          <div class="filter-tabs">
            <button 
              class="filter-tab" 
              [class.active]="selectedFilter === 'all'"
              (click)="setFilter('all')">
              All
            </button>
            <button 
              class="filter-tab" 
              [class.active]="selectedFilter === 'completed'"
              (click)="setFilter('completed')">
              Completed
            </button>
            <button 
              class="filter-tab" 
              [class.active]="selectedFilter === 'pending'"
              (click)="setFilter('pending')">
              Pending
            </button>
            <button 
              class="filter-tab" 
              [class.active]="selectedFilter === 'cancelled'"
              (click)="setFilter('cancelled')">
              Cancelled
            </button>
          </div>

          <!-- Empty State -->
          <div *ngIf="filteredTransactions.length === 0" class="empty-state">
            <div class="empty-icon">📊</div>
            <h3>No transactions found</h3>
            <p *ngIf="selectedFilter === 'all'">You haven't made any transactions yet.</p>
            <p *ngIf="selectedFilter !== 'all'">No {{ selectedFilter }} transactions found.</p>
          </div>

          <!-- Transaction Cards -->
          <div *ngIf="filteredTransactions.length > 0" class="transactions-grid">
            <div 
              *ngFor="let transaction of filteredTransactions" 
              class="transaction-card"
              [class.completed]="transaction.status === 'Completed'"
              [class.pending]="transaction.status === 'Pending'"
              [class.cancelled]="transaction.status === 'Cancelled'">
              
              <!-- Transaction Header -->
              <div class="card-header">
                <div class="transaction-type">
                  <span class="type-badge" [class.buy]="transaction.type === 'Buy'" [class.sell]="transaction.type === 'Sell'">
                    {{ transaction.type }}
                  </span>
                  <span class="stock-symbol">{{ transaction.stockSymbol }}</span>
                </div>
                <div class="status-container">
                  <span class="status-badge" [class]="transaction.status.toLowerCase()">
                    {{ transaction.status }}
                  </span>
                  <!-- Cancel button for pending orders -->
                  <button 
                    *ngIf="transaction.status === 'Pending'" 
                    class="cancel-btn"
                    (click)="showCancelConfirmation(transaction)"
                    [disabled]="isCancelling === transaction.id"
                    title="Cancel Order">
                    <span *ngIf="isCancelling !== transaction.id">✕</span>
                    <span *ngIf="isCancelling === transaction.id" class="loading-spinner">⟳</span>
                  </button>
                </div>
              </div>

              <!-- Transaction Details -->
              <div class="card-body">
                <div class="detail-grid">
                  <div class="detail-item">
                    <span class="label">Quantity</span>
                    <span class="value">{{ transaction.quantity }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">Price</span>
                    <span class="value">\${{ transaction.price | number:'1.2-2' }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">Total</span>
                    <span class="value total">\${{ transaction.totalAmount | number:'1.2-2' }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">Date</span>
                    <span class="value">{{ transaction.createdAt | date:'MMM d, y' }}</span>
                  </div>
                  <div *ngIf="transaction.executedAt" class="detail-item executed">
                    <span class="label">Executed</span>
                    <span class="value">{{ transaction.executedAt | date:'MMM d, y' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Cancel Confirmation Modal -->
      <div *ngIf="showCancelModal" class="modal-overlay" (click)="closeCancelModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Cancel Order</h3>
            <button class="close-btn" (click)="closeCancelModal()">×</button>
          </div>
          <div class="modal-body">
            <p>Are you sure you want to cancel this order?</p>
            <div *ngIf="transactionToCancel" class="order-summary">
              <div class="summary-row">
                <strong>{{ transactionToCancel.type }} {{ transactionToCancel.quantity }} shares of {{ transactionToCancel.stockSymbol }}</strong>
              </div>
              <div class="summary-row">
                At \${{ transactionToCancel.price | number:'1.2-2' }} per share
              </div>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" (click)="closeCancelModal()">Keep Order</button>
            <button 
              class="btn-primary cancel-action" 
              (click)="confirmCancelOrder()" 
              [disabled]="isCancelling">
              <span *ngIf="!isCancelling">Cancel Order</span>
              <span *ngIf="isCancelling">Cancelling...</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    * {
      box-sizing: border-box;
    }

    .transactions-container {
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

    /* Content Styles */
    .page-content {
      padding: 2rem 1rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    /* Transactions Section */
    .transactions-section {
      background: white;
      border-radius: 12px;
      padding: 0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    /* Filter Tabs */
    .filter-tabs {
      display: flex;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 0;
    }

    .filter-tab {
      flex: 1;
      background: none;
      border: none;
      padding: 1rem;
      font-size: 0.9rem;
      font-weight: 500;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s ease;
      border-bottom: 2px solid transparent;
      position: relative;
    }

    .filter-tab:hover {
      background: #f1f5f9;
      color: #475569;
    }

    .filter-tab.active {
      background: white;
      color: #1e293b;
      border-bottom-color: #3b82f6;
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      color: #64748b;
    }

    .empty-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    .empty-state h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: #374151;
    }

    /* Transactions Grid */
    .transactions-grid {
      display: grid;
      gap: 1px;
      background: #e5e7eb;
    }

    .transaction-card {
      background: white;
      transition: all 0.2s ease;
      position: relative;
    }

    .transaction-card:hover {
      background: #fefefe;
    }

    .transaction-card.pending {
      border-left: 4px solid #f59e0b;
    }

    .transaction-card.completed {
      border-left: 4px solid #10b981;
    }

    .transaction-card.cancelled {
      border-left: 4px solid #ef4444;
      opacity: 0.7;
    }

    /* Card Header */
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem 0.5rem;
    }

    .transaction-type {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .type-badge {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .type-badge.buy {
      background: #ecfdf5;
      color: #059669;
    }

    .type-badge.sell {
      background: #fef2f2;
      color: #dc2626;
    }

    .stock-symbol {
      font-weight: 700;
      font-size: 1.1rem;
      color: #1e293b;
    }

    .status-container {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .status-badge {
      font-size: 0.75rem;
      font-weight: 500;
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      text-transform: capitalize;
    }

    .status-badge.pending {
      background: #fef3c7;
      color: #b45309;
    }

    .status-badge.completed {
      background: #d1fae5;
      color: #065f46;
    }

    .status-badge.cancelled {
      background: #fee2e2;
      color: #991b1b;
    }

    /* Cancel Button */
    .cancel-btn {
      background: none;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      color: #6b7280;
      font-size: 0.8rem;
      padding: 0;
    }

    .cancel-btn:hover:not(:disabled) {
      background: #fef2f2;
      border-color: #fca5a5;
      color: #dc2626;
    }

    .cancel-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .loading-spinner {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Card Body */
    .card-body {
      padding: 0.5rem 1.5rem 1rem;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 0.75rem;
    }

    .detail-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .detail-item .label {
      font-size: 0.75rem;
      font-weight: 500;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .detail-item .value {
      font-size: 0.9rem;
      font-weight: 600;
      color: #374151;
    }

    .detail-item.executed .value {
      color: #059669;
    }

    .detail-item .total {
      font-size: 1rem;
      font-weight: 700;
      color: #1e293b;
    }

    /* Loading and Error States */
    .loading-state, .error-state {
      text-align: center;
      padding: 3rem 1rem;
      color: #6b7280;
    }

    .loading-spinner-icon, .error-icon {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }

    .retry-button {
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 0.75rem 1.5rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s ease;
      margin-top: 1rem;
    }

    .retry-button:hover {
      background: #2563eb;
    }

    /* Modal Styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(2px);
    }

    .modal-content {
      background: white;
      border-radius: 12px;
      max-width: 420px;
      width: 90%;
      max-height: 80vh;
      overflow: hidden;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
      animation: modalSlideIn 0.3s ease-out;
    }

    @keyframes modalSlideIn {
      from {
        opacity: 0;
        transform: scale(0.9) translateY(-20px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    .modal-header {
      padding: 1.5rem 1.5rem 1rem;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-header h3 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: #1e293b;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #6b7280;
      padding: 0.25rem;
      border-radius: 4px;
      transition: all 0.2s ease;
      line-height: 1;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .close-btn:hover {
      background: #f3f4f6;
      color: #374151;
    }

    .modal-body {
      padding: 1.5rem;
    }

    .modal-body p {
      margin: 0 0 1rem 0;
      color: #374151;
      line-height: 1.6;
    }

    .order-summary {
      background: #f8fafc;
      border-radius: 8px;
      padding: 1rem;
      border: 1px solid #e2e8f0;
    }

    .summary-row {
      margin-bottom: 0.5rem;
      color: #475569;
    }

    .summary-row:last-child {
      margin-bottom: 0;
    }

    .modal-actions {
      padding: 1rem 1.5rem 1.5rem;
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
    }

    .btn-secondary, .btn-primary {
      border: none;
      border-radius: 8px;
      padding: 0.75rem 1.25rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 0.9rem;
    }

    .btn-secondary {
      background: #f3f4f6;
      color: #374151;
    }

    .btn-secondary:hover {
      background: #e5e7eb;
    }

    .btn-primary {
      background: #dc2626;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #b91c1c;
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .transactions-grid .transaction-card {
        margin: 0 -1px;
      }

      .detail-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .card-header {
        padding: 0.75rem 1rem 0.5rem;
      }

      .card-body {
        padding: 0.5rem 1rem 0.75rem;
      }

      .modal-content {
        margin: 1rem;
        width: calc(100% - 2rem);
      }

      .modal-actions {
        flex-direction: column-reverse;
      }

      .btn-secondary, .btn-primary {
        width: 100%;
      }
    }
  `]
})
export class TransactionsComponent implements OnInit, OnDestroy {
  transactions: Transaction[] = [];
  filteredTransactions: Transaction[] = [];
  selectedFilter: 'all' | 'completed' | 'pending' | 'cancelled' = 'all';
  isLoading = false;
  errorMessage = '';
  
  // Cancel modal state
  showCancelModal = false;
  transactionToCancel: Transaction | null = null;
  isCancelling: number | null = null;

  // Dashboard header properties
  balance: number = 0;
  balanceGlowClass: string = '';
  showUserMenu: boolean = false;
  userName: string = '';
  userEmail: string = '';
  
  // Subscriptions
  private balanceSubscription?: Subscription;
  private subscriptions: Subscription = new Subscription();

  constructor(
    private router: Router,
    private transactionsService: TransactionsService,
    private walletService: WalletService,
    private balanceStreamService: BalanceStreamService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.loadTransactions();
    this.initializeUserData();
    this.subscribeToBalanceUpdates();
    
    // Hide user menu when clicking outside
    document.addEventListener('click', this.hideUserMenu.bind(this));
  }

  ngOnDestroy() {
    this.balanceSubscription?.unsubscribe();
    this.subscriptions.unsubscribe();
    document.removeEventListener('click', this.hideUserMenu.bind(this));
  }

  initializeUserData() {
    // Subscribe to current user from AuthService (like dashboard and portfolio)
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

  subscribeToBalanceUpdates() {
    // Subscribe to balance changes
    this.balanceSubscription = this.balanceStreamService.balance$.subscribe(balance => {
      const previousBalance = this.balance;
      this.balance = balance;
      
      // Add glow effect for balance changes
      if (previousBalance > 0) {
        if (balance > previousBalance) {
          this.balanceGlowClass = 'balance-glow-green';
        } else if (balance < previousBalance) {
          this.balanceGlowClass = 'balance-glow-red';
        }
        
        // Remove glow effect after animation
        setTimeout(() => {
          this.balanceGlowClass = '';
        }, 2000);
      }
    });

    // Initial balance load
    this.loadBalance();
  }

  async loadBalance() {
    try {
      const response = await this.walletService.getBalance().toPromise();
      this.balance = response!.balance;
    } catch (error: any) {
      console.error('Failed to load balance:', error);
    }
  }

  hideUserMenu() {
    this.showUserMenu = false;
  }

  // Navigation methods
  navigateToWallet() {
    this.showUserMenu = false;
    this.router.navigate(['/wallet']);
  }

  navigateToDashboard() {
    this.showUserMenu = false;
    this.router.navigate(['/dashboard']);
  }

  navigateToPortfolio() {
    this.showUserMenu = false;
    this.router.navigate(['/portfolio']);
  }

  navigateToTransactions() {
    this.showUserMenu = false;
    // Already on transactions page, just close the menu
  }

  logout() {
    this.showUserMenu = false;
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  loadTransactions() {
    this.isLoading = true;
    this.errorMessage = '';
    
    this.transactionsService.getUserTransactions().subscribe({
      next: (transactions: Transaction[]) => {
        this.transactions = transactions;
        this.applyFilter();
        this.isLoading = false;
      },
      error: (error: any) => {
        this.errorMessage = 'Failed to load transactions. Please try again.';
        this.isLoading = false;
        console.error('Error loading transactions:', error);
      }
    });
  }

  setFilter(filter: 'all' | 'completed' | 'pending' | 'cancelled') {
    this.selectedFilter = filter;
    this.applyFilter();
  }

  applyFilter() {
    switch (this.selectedFilter) {
      case 'all':
        this.filteredTransactions = this.transactions;
        break;
      case 'completed':
        this.filteredTransactions = this.transactions.filter(t => t.status === 'Completed');
        break;
      case 'pending':
        this.filteredTransactions = this.transactions.filter(t => t.status === 'Pending');
        break;
      case 'cancelled':
        this.filteredTransactions = this.transactions.filter(t => t.status === 'Cancelled');
        break;
    }
  }

  showCancelConfirmation(transaction: Transaction) {
    this.transactionToCancel = transaction;
    this.showCancelModal = true;
  }

  closeCancelModal() {
    this.showCancelModal = false;
    this.transactionToCancel = null;
  }

  confirmCancelOrder() {
    if (!this.transactionToCancel) return;

    this.isCancelling = this.transactionToCancel.id;
    
    this.transactionsService.cancelOrder(this.transactionToCancel.id, this.transactionToCancel.type).subscribe({
      next: () => {
        // Update the transaction status locally
        const transaction = this.transactions.find(t => t.id === this.transactionToCancel!.id);
        if (transaction) {
          transaction.status = 'Cancelled';
        }
        this.applyFilter();
        this.closeCancelModal();
        this.isCancelling = null;
      },
      error: (error: any) => {
        console.error('Error cancelling order:', error);
        this.errorMessage = 'Failed to cancel order. Please try again.';
        this.isCancelling = null;
      }
    });
  }
}