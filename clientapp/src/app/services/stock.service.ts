import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class StockService {
  constructor(private http: HttpClient) {}

  getStock(symbol: string, range: string = '1mo'): Observable<any> {
    return this.http.get(`/api/stocks/price/${symbol}/${range}`);
  }
}
