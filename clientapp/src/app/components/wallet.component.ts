import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WalletService, WalletTransactionResponse } from '../services/wallet.service';
import { BalanceStreamService } from '../services/balance-stream.service';

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="wallet-container">
      <div class="wallet-header">
        <div class="balance-display">
          <span class="balance-label">Available Balance</span>
          <span class="balance-amount">\${{ balance | number:'1.2-2' }}</span>
        </div>
      </div>

      <div class="wallet-actions">
        <div class="action-section deposit-section">
          <h3>Deposit Funds</h3>
          <div class="transaction-form">
            <input 
              type="number" 
              [(ngModel)]="depositAmount" 
              placeholder="Enter amount" 
              min="0.01" 
              step="0.01"
              class="amount-input">
            <button 
              (click)="deposit()" 
              [disabled]="!depositAmount || depositAmount <= 0 || isLoading"
              class="action-btn deposit-btn">
              {{ isLoading ? 'Processing...' : 'Deposit' }}
            </button>
          </div>
        </div>

        <div class="action-section withdraw-section">
          <h3>Withdraw Funds</h3>
          <div class="transaction-form">
            <input 
              type="number" 
              [(ngModel)]="withdrawAmount" 
              placeholder="Enter amount" 
              min="0.01" 
              step="0.01"
              [max]="balance"
              class="amount-input">
            <button 
              (click)="withdraw()" 
              [disabled]="!withdrawAmount || withdrawAmount <= 0 || withdrawAmount > balance || isLoading"
              class="action-btn withdraw-btn">
              {{ isLoading ? 'Processing...' : 'Withdraw' }}
            </button>
          </div>
        </div>
      </div>

      <div class="message-area" *ngIf="message">
        <div class="alert" [ngClass]="messageType">
          {{ message }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .wallet-container {
      max-width: 380px;
      margin: 0 auto;
      padding: 12px 12px 16px 12px;
      background: #fff;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      color: #222;
    }

    .wallet-header {
      text-align: center;
      margin-bottom: 16px;
      padding-bottom: 8px;
    }
    .wallet-header h2 {
      margin: 0 0 8px 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: #222;
    }
    .balance-display {
      background: #f6f7f9;
      padding: 8px 0;
      border-radius: 6px;
      border: none;
      box-shadow: none;
    }
    .balance-label {
      display: block;
      font-size: 0.82rem;
      color: #6b7280;
      margin-bottom: 2px;
    }
    .balance-amount {
      font-size: 1.1rem;
      font-weight: 600;
      color: #222;
    }

    .wallet-actions {
      display: flex;
      gap: 10px;
      margin-bottom: 12px;
    }
    .action-section {
      background: #f8f9fb;
      padding: 12px 8px 16px 8px;
      border-radius: 7px;
      border: 1px solid #ececec;
      flex: 1 1 0;
      min-width: 0;
      min-height: 120px;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }

    .action-section h3 {
      margin: 0 0 10px 0;
      font-size: 0.98rem;
      font-weight: 500;
      color: #222;
    }

    .transaction-form {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;
      justify-content: flex-end;
    }

    .amount-input {
      padding: 8px 10px;
      border: 1px solid #d1d5db;
      border-radius: 5px;
      font-size: 0.92rem;
      background: #fff;
      color: #222;
      outline: none;
      transition: all 0.2s ease;
    }

    .amount-input:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .action-btn {
      padding: 8px 0;
      border: none;
      border-radius: 5px;
      font-size: 0.97rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      text-transform: uppercase;
      letter-spacing: 0.01em;
      width: 100%;
    }
    .deposit-btn {
      background: #93dbc7;
      color: #1a3a2b;
    }
    .deposit-btn:hover:not(:disabled) {
      background: #7ccab2;
    }
    .withdraw-btn {
      background: #f2b3b3;
      color: #6b2222;
    }
    .withdraw-btn:hover:not(:disabled) {
      background: #e48a8a;
    }

    .action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .message-area {
      margin-top: 10px;
    }

    .alert {
      padding: 8px 12px;
      border-radius: 5px;
      font-size: 0.85rem;
    }

    .alert.success {
      background: #e6f7ef;
      color: #1a3a2b;
      border: 1px solid #b7e4d8;
    }
    .alert.error {
      background: #fbeaea;
      color: #6b2222;
      border: 1px solid #f2b3b3;
    }

    @media (max-width: 640px) {
      .wallet-actions {
        flex-direction: column;
        gap: 8px;
      }
      .wallet-container {
        margin: 0 8px;
        padding: 8px;
      }
      .action-section {
        min-height: 80px;
        padding: 8px 4px 12px 4px;
      }
    }
  `]
})
export class WalletComponent implements OnInit {
  balance: number = 0;
  depositAmount: number | null = null;
  withdrawAmount: number | null = null;
  isLoading: boolean = false;
  message: string = '';
  messageType: 'success' | 'error' = 'success';

  constructor(
    private walletService: WalletService,
    private balanceStreamService: BalanceStreamService
  ) {}

  ngOnInit() {
    // Subscribe to balance stream for real-time updates
    this.balanceStreamService.balance$.subscribe({
      next: (balance) => {
        this.balance = balance;
      },
      error: (error) => {
        console.error('Error in balance stream:', error);
      }
    });
    
    // Initialize balance stream
    this.balanceStreamService.refreshBalance();
  }

  loadBalance() {
    this.walletService.getBalance().subscribe({
      next: (response) => {
        this.balance = response.balance;
      },
      error: (error) => {
        console.error('Error loading balance:', error);
        this.showMessage('Error loading balance', 'error');
      }
    });
  }

  deposit() {
    if (!this.depositAmount || this.depositAmount <= 0) return;

    this.isLoading = true;
    
    // Optimistically update balance for immediate feedback
    this.balanceStreamService.updateBalanceLocally(this.balance + this.depositAmount);
    
    this.walletService.deposit(this.depositAmount).subscribe({
      next: (response: WalletTransactionResponse) => {
        // Update balance stream with server response
        this.balanceStreamService.updateBalanceLocally(response.newBalance);
        this.showMessage(`Successfully deposited $${response.amount.toFixed(2)}`, 'success');
        this.depositAmount = null;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Deposit error:', error);
        // Revert optimistic update on error
        this.balanceStreamService.refreshBalance();
        this.showMessage(error.error?.message || 'Deposit failed', 'error');
        this.isLoading = false;
      }
    });
  }

  withdraw() {
    if (!this.withdrawAmount || this.withdrawAmount <= 0 || this.withdrawAmount > this.balance) return;

    this.isLoading = true;
    
    // Optimistically update balance for immediate feedback
    this.balanceStreamService.updateBalanceLocally(this.balance - this.withdrawAmount);
    
    this.walletService.withdraw(this.withdrawAmount).subscribe({
      next: (response: WalletTransactionResponse) => {
        // Update balance stream with server response
        this.balanceStreamService.updateBalanceLocally(response.newBalance);
        this.showMessage(`Successfully withdrew $${response.amount.toFixed(2)}`, 'success');
        this.withdrawAmount = null;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Withdraw error:', error);
        // Revert optimistic update on error
        this.balanceStreamService.refreshBalance();
        this.showMessage(error.error?.message || 'Withdrawal failed', 'error');
        this.isLoading = false;
      }
    });
  }

  private showMessage(message: string, type: 'success' | 'error') {
    this.message = message;
    this.messageType = type;
    setTimeout(() => {
      this.message = '';
    }, 5000);
  }
}