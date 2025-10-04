import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

export interface WalletBalance {
  balance: number;
}

export interface WalletTransaction {
  amount: number;
}

export interface WalletTransactionResponse {
  message: string;
  amount: number;
  newBalance: number;
}

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private baseUrl = '/api/wallet';
  private balanceStreamService: any; // Late injection to avoid circular dependency

  constructor(private http: HttpClient) {}

  // Set balance stream service to avoid circular dependency
  setBalanceStreamService(balanceStreamService: any): void {
    this.balanceStreamService = balanceStreamService;
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  getBalance(): Observable<WalletBalance> {
    console.log('WalletService: Getting balance...');
    const token = localStorage.getItem('auth_token');
    console.log('Token available:', !!token);
    
    return this.http.get<WalletBalance>(`${this.baseUrl}/balance`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => console.log('Balance response:', response)),
      catchError(error => {
        console.error('Balance request failed:', error);
        console.error('Error status:', error.status);
        console.error('Error message:', error.message);
        throw error;
      })
    );
  }

  deposit(amount: number): Observable<WalletTransactionResponse> {
    const transaction: WalletTransaction = { amount };
    return this.http.post<WalletTransactionResponse>(`${this.baseUrl}/deposit`, transaction, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        // Update balance stream with new balance
        if (this.balanceStreamService) {
          this.balanceStreamService.updateBalanceLocally(response.newBalance);
        }
      })
    );
  }

  withdraw(amount: number): Observable<WalletTransactionResponse> {
    const transaction: WalletTransaction = { amount };
    return this.http.post<WalletTransactionResponse>(`${this.baseUrl}/withdraw`, transaction, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        // Update balance stream with new balance
        if (this.balanceStreamService) {
          this.balanceStreamService.updateBalanceLocally(response.newBalance);
        }
      })
    );
  }
}