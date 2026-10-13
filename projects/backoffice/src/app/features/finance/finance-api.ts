import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Movement, MovementRequest, MOVEMENTS_URL } from './finance.models';

/** Operaciones de escritura y descargas. Las lecturas se hacen con `httpResource` en la página. */
@Injectable({ providedIn: 'root' })
export class FinanceApi {
  private readonly http = inject(HttpClient);

  create(request: MovementRequest): Observable<Movement> {
    return this.http.post<Movement>(MOVEMENTS_URL, request);
  }

  update(id: string, request: MovementRequest): Observable<Movement> {
    return this.http.put<Movement>(`${MOVEMENTS_URL}/${id}`, request);
  }

  /** Elimina el movimiento y su soporte. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${MOVEMENTS_URL}/${id}`);
  }

  /** Sube el soporte; reemplaza el anterior si lo había. */
  attach(id: string, file: File): Observable<Movement> {
    const form = new FormData();
    form.append('file', file);
    return this.http.put<Movement>(`${MOVEMENTS_URL}/${id}/attachment`, form);
  }

  removeAttachment(id: string): Observable<Movement> {
    return this.http.delete<Movement>(`${MOVEMENTS_URL}/${id}/attachment`);
  }

  attachment(id: string): Observable<Blob> {
    return this.http.get(`${MOVEMENTS_URL}/${id}/attachment`, { responseType: 'blob' });
  }

  /** Ingresos y gastos del rango en CSV para Excel. */
  export(from: string, to: string): Observable<Blob> {
    return this.http.get(`${MOVEMENTS_URL}/export`, {
      params: { from, to },
      responseType: 'blob',
    });
  }
}
