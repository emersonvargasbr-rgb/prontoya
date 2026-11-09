import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from './icon.component';

export interface Aviso { texto: string; tipo: 'ok' | 'error'; }

/** <app-toast [aviso]="aviso()" /> */
@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div *ngIf="aviso" role="status" aria-live="polite"
         class="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-md items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg"
         [ngClass]="aviso.tipo === 'ok' ? 'bg-slate-900' : 'bg-rose-600'">
      <app-icon [nombre]="aviso.tipo === 'ok' ? 'check' : 'alert'" clase="w-4 h-4 shrink-0" />
      {{ aviso.texto }}
    </div>
  `,
})
export class ToastComponent {
  @Input() aviso: Aviso | null = null;
}
