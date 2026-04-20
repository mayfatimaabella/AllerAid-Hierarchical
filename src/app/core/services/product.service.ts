import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  constructor(private http: HttpClient) {}

  getProduct(barcode: string): Observable<any> {
    return this.http.get(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
  }
}

