import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-badge-verificado',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span *ngIf="verificado" class="inline-flex items-center text-green-600 ml-1" title="Cuenta Verificada">
      <svg class="w-4 h-4 fill-current" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
      </svg>
      <span *ngIf="mostrarTexto" class="text-xs font-bold ml-1">Verificado</span>
    </span>
  `
})
export class BadgeVerificadoComponent {
  @Input() verificado: boolean = false;
  @Input() mostrarTexto: boolean = false;
}