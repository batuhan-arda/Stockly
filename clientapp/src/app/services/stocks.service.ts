import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface StockInfo {
  symbol: string;
  name: string;
  category: string;
}

@Injectable({
  providedIn: 'root'
})
export class StocksService {
  private apiUrl = '/api/stocks';
  private stocksCache$ = new BehaviorSubject<StockInfo[]>([]);
  
  public availableStocks$ = this.stocksCache$.asObservable();

  constructor(private http: HttpClient) {
    // Preload stocks on service initialization
    this.loadAvailableStocks();
  }

  /**
   * Load all available stocks from the backend
   */
  public loadAvailableStocks(): Observable<StockInfo[]> {
    return this.http.get<StockInfo[]>(`${this.apiUrl}/available`).pipe(
      tap(stocks => this.stocksCache$.next(stocks))
    );
  }

  /**
   * Search stocks by query (optional - filters on frontend from cached data)
   */
  public searchStocks(query: string): StockInfo[] {
    const stocks = this.stocksCache$.value;
    if (!query) return stocks;

    const searchLower = query.toLowerCase();
    return stocks.filter(stock =>
      stock.symbol.toLowerCase().includes(searchLower) ||
      stock.name.toLowerCase().includes(searchLower) ||
      stock.category.toLowerCase().includes(searchLower)
    );
  }

  /**
   * Get stock info by symbol
   */
  public getStockBySymbol(symbol: string): StockInfo | undefined {
    return this.stocksCache$.value.find(s => s.symbol === symbol);
  }
}
