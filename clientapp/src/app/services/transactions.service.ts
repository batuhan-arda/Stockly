import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AuthService } from './auth.service';

// Backend response interfaces
export interface TransactionResponse {
  transactionId: number;
  transactionType: string; // "Buy" or "Sell"
  symbol: string;
  companyName: string;
  quantity: number;
  pricePerUnit: number;
  totalValue: number;
  timestamp: string;
  status: string; // "Completed", "Pending", "Cancelled"
}

// Backend order response interface (matches backend OrderResponse model)
export interface OrderResponse {
  orderId: number;
  orderType: string; // "Buy" or "Sell"
  symbol: string;
  companyName: string;
  quantity: number;
  pricePerUnit: number;
  totalValue: number;
  createdAt: string;
  status: string; // "OPEN", "FILLED", "CANCELLED", "Active"
}

// Frontend display interface
export interface Transaction {
  id: number;
  userId?: number;
  stockSymbol: string;
  type: 'Buy' | 'Sell';
  quantity: number;
  price: number;
  totalAmount: number;
  status: 'Pending' | 'Completed' | 'Cancelled';
  createdAt: string;
  executedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TransactionsService {
  private baseUrl = '/api';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private mapTransactionResponse(response: TransactionResponse): Transaction {
    return {
      id: response.transactionId,
      stockSymbol: response.symbol,
      type: response.transactionType as 'Buy' | 'Sell',
      quantity: response.quantity,
      price: response.pricePerUnit,
      totalAmount: response.totalValue,
      status: response.status as 'Completed' | 'Pending' | 'Cancelled',
      createdAt: response.timestamp,
      executedAt: response.status === 'Completed' ? response.timestamp : undefined
    };
  }

  private mapOrderResponse(response: OrderResponse): Transaction {
    return {
      id: response.orderId,
      stockSymbol: response.symbol,
      type: response.orderType as 'Buy' | 'Sell',
      quantity: response.quantity,
      price: response.pricePerUnit,
      totalAmount: response.totalValue,
      status: response.status === 'OPEN' || response.status === 'Active' ? 'Pending' : 'Cancelled',
      createdAt: response.createdAt,
      // No executedAt for pending orders
    };
  }

  getUserTransactions(): Observable<Transaction[]> {
    const headers = this.getAuthHeaders();
    
    // Get all transactions and orders from unified endpoint
    return this.http.get<{success: boolean, transactions: TransactionResponse[], pagination?: any}>(`${this.baseUrl}/transactions`, { headers })
      .pipe(
        map(response => {
          if (response.success && response.transactions) {
            return response.transactions.map(t => this.mapTransactionResponse(t))
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          }
          return [];
        })
      );
  }

  cancelOrder(orderId: number, orderType: 'Buy' | 'Sell'): Observable<any> {
    const headers = this.getAuthHeaders();
    const cancelRequest = {
      orderId: orderId,
      orderType: orderType
    };
    return this.http.delete(`${this.baseUrl}/trading/orders`, { 
      headers, 
      body: cancelRequest 
    });
  }

  getTransactionById(transactionId: number): Observable<Transaction> {
    const headers = this.getAuthHeaders();
    return this.http.get<{success: boolean, transaction: TransactionResponse}>(`${this.baseUrl}/transactions/${transactionId}`, { headers })
      .pipe(
        map(response => this.mapTransactionResponse(response.transaction))
      );
  }
}