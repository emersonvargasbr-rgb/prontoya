import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-star-rating',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center">
      <!-- Generamos 5 estrellas con un bucle -->
      <div class="flex text-yellow-400">
        <ng-container *ngFor="let estrella of [1, 2, 3, 4, 5]">
          <!-- Estrella Llena -->
          <svg *ngIf="promedio >= estrella" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
          </svg>
          <!-- Estrella Vacía (Gris) -->
          <svg *ngIf="promedio < estrella" class="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
          </svg>
        </ng-container>
      </div>
      
      <!-- Contador de reseñas (Opcional) -->
      <span *ngIf="mostrarTotal && total > 0" class="ml-2 text-sm text-gray-500">
        ({{ total }})
      </span>
      <span *ngIf="mostrarTotal && total === 0" class="ml-2 text-xs text-gray-400">
        Sin reseñas
      </span>
    </div>
  `
})
export class StarRatingComponent {
  @Input() promedio: number = 0;
  @Input() total: number = 0;
  @Input() mostrarTotal: boolean = true;
}