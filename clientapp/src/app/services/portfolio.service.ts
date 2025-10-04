import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export interface Holding {
  id?: number;
  symbol: string;
  companyName: string;
  quantityOwned: number;
  averagePrice: number;
  currentPrice: number;
  totalValue: number;
  gainLoss: number;
  gainLossPercentage: number;
}

export interface PortfolioSummary {
  holdings: Holding[];
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPercentage: number;
  cash: number;
}

export interface Stock {
  id: number;
  symbol: string;
  companyName: string;
  currentPrice: number;
  priceChange: number;
  priceChangePercentage: number;
}

export interface BuyOrderRequest {
  Symbol: string;
  Quantity: number;
  PricePerUnit: number;
}

export interface SellOrderRequest {
  Symbol: string;
  Quantity: number;
  PricePerUnit: number;
}

export interface OrderResponse {
  success: boolean;
  message: string;
  orderId?: number;
  newBalance?: number;
}

@Injectable({
  providedIn: 'root'
})
export class PortfolioService {
  private baseUrl = '/api';
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

  getPortfolio(): Observable<{ portfolio: PortfolioSummary }> {
    return this.http.get<{ portfolio: PortfolioSummary }>(`${this.baseUrl}/portfolio`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => console.log('Portfolio response:', response)),
      catchError(error => {
        console.error('Portfolio request failed:', error);
        return throwError(() => error);
      })
    );
  }

  getHoldings(): Observable<{ holdings: Holding[] }> {
    return this.http.get<{ holdings: Holding[] }>(`${this.baseUrl}/trading/holdings`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => console.log('Holdings response:', response)),
      catchError(error => {
        console.error('Holdings request failed:', error);
        return throwError(() => error);
      })
    );
  }

  getAvailableStocks(): Observable<{ stocks: Stock[] }> {
    return this.http.get<{ stocks: Stock[] }>(`${this.baseUrl}/trading/stocks`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => console.log('Stocks response:', response)),
      catchError(error => {
        console.error('Stocks request failed:', error);
        return throwError(() => error);
      })
    );
  }

  createBuyOrder(order: BuyOrderRequest): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(`${this.baseUrl}/trading/buy`, order, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        console.log('Buy order response:', response);
        // Update balance stream if available and order successful
        if (this.balanceStreamService && response.success && response.newBalance !== undefined) {
          this.balanceStreamService.updateBalanceLocally(response.newBalance);
        }
      }),
      catchError(error => {
        console.error('Buy order failed:', error);
        return throwError(() => error);
      })
    );
  }

  createSellOrder(order: SellOrderRequest): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(`${this.baseUrl}/trading/sell`, order, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        console.log('Sell order response:', response);
        // Update balance stream if available and order successful
        if (this.balanceStreamService && response.success && response.newBalance !== undefined) {
          this.balanceStreamService.updateBalanceLocally(response.newBalance);
        }
      }),
      catchError(error => {
        console.error('Sell order failed:', error);
        return throwError(() => error);
      })
    );
  }
}