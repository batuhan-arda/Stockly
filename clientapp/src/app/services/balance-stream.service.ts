import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom, interval, Subscription } from 'rxjs';
import { WalletService } from './wallet.service';
import { PortfolioService } from './portfolio.service';

@Injectable({
  providedIn: 'root'
})
export class BalanceStreamService implements OnDestroy {
  private balanceSubject = new BehaviorSubject<number>(0);
  public balance$: Observable<number>;
  
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoadingSubject.asObservable();
  
  private initialized = false;
  private refreshInterval: Subscription | null = null;

  constructor(private walletService: WalletService, private portfolioService: PortfolioService) {
    // Set this service on wallet service to avoid circular dependency
    this.walletService.setBalanceStreamService(this);
    // Set this service on portfolio service to avoid circular dependency
    this.portfolioService.setBalanceStreamService(this);
    
    // Create a custom observable that initializes on first subscription
    this.balance$ = new Observable(subscriber => {
      this.ensureInitialized();
      return this.balanceSubject.subscribe(subscriber);
    });
  }

  // Get current balance value and initialize if needed
  getCurrentBalance(): number {
    this.ensureInitialized();
    return this.balanceSubject.value;
  }

  // Ensure balance is initialized
  private ensureInitialized(): void {
    if (!this.initialized && this.hasValidToken()) {
      this.initialized = true;
      this.loadInitialBalance();
    }
  }

  // Check if we have a valid auth token
  private hasValidToken(): boolean {
    const token = localStorage.getItem('auth_token');
    return !!token;
  }

  // Load initial balance
  async loadInitialBalance(): Promise<void> {
    try {
      this.isLoadingSubject.next(true);
      const response = await firstValueFrom(this.walletService.getBalance());
      this.balanceSubject.next(response.balance);
      
      // Start automatic refresh after initial load
      this.startAutoRefresh();
    } catch (error) {
      console.error('Failed to load initial balance:', error);
      this.balanceSubject.next(0);
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  // Refresh balance from server
  async refreshBalance(): Promise<void> {
    try {
      this.isLoadingSubject.next(true);
      const response = await firstValueFrom(this.walletService.getBalance());
      this.balanceSubject.next(response.balance);
    } catch (error) {
      console.error('Failed to refresh balance:', error);
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  // Update balance locally (for immediate UI feedback)
  updateBalanceLocally(newBalance: number): void {
    this.balanceSubject.next(newBalance);
  }

  // Add amount to current balance (for deposits, sell orders)
  addToBalance(amount: number): void {
    const currentBalance = this.balanceSubject.value;
    this.balanceSubject.next(currentBalance + amount);
  }

  // Subtract amount from current balance (for withdrawals, buy orders)
  subtractFromBalance(amount: number): void {
    const currentBalance = this.balanceSubject.value;
    this.balanceSubject.next(Math.max(0, currentBalance - amount));
  }

  // Check if user has sufficient balance
  hasSufficientBalance(amount: number): boolean {
    return this.balanceSubject.value >= amount;
  }

  // Force refresh balance (useful after trades or wallet operations)
  async forceRefresh(): Promise<number> {
    await this.refreshBalance();
    return this.balanceSubject.value;
  }

  // Initialize balance stream (called after login)
  initializeAfterLogin(): void {
    const token = localStorage.getItem('auth_token');
    if (token) {
      this.loadInitialBalance();
      this.startAutoRefresh();
    }
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      this.refreshInterval.unsubscribe();
    }
  }

  // Start automatic balance refresh every 30 seconds (like stock prices)
  private startAutoRefresh(): void {
    if (this.refreshInterval) {
      this.refreshInterval.unsubscribe();
    }
    
    // Refresh balance every 30 seconds when user is active
    this.refreshInterval = interval(30000).subscribe(() => {
      if (this.hasValidToken()) {
        this.refreshBalance();
      } else {
        // Stop refreshing if no valid token
        if (this.refreshInterval) {
          this.refreshInterval.unsubscribe();
          this.refreshInterval = null;
        }
      }
    });
  }
}