import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from './icon.component';


export interface TabItem {
  id: string;
  txt: string;
  icono: string;
  n?: number;
  /** pinta el contador en rojo (algo requiere tu atención) */
  alerta?: boolean;
}

/**
 * <app-tabs [items]="tabs()" [activo]="seccion()" (cambio)="seccion.set($any($event))" />
 */
@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <nav class="-mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Secciones">
      <ul class="flex min-w-max gap-1 border-b border-stone-200" role="tablist">
        <li *ngFor="let t of items">
          <button type="button" role="tab" (click)="cambio.emit(t.id)" [attr.aria-selected]="activo === t.id"
                  class="-mb-px flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
                  [ngClass]="activo === t.id ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-800'">
            <app-icon [nombre]="t.icono" clase="w-4 h-4" />
            {{ t.txt }}
            <span *ngIf="t.n !== undefined" class="rounded-full px-1.5 text-[11px] font-bold"
                  [ngClass]="t.alerta && t.n > 0 ? 'bg-rose-600 text-white' : 'bg-stone-200 text-slate-600'">{{ t.n }}</span>
          </button>
        </li>
      </ul>
    </nav>
  `,
})
export class TabsComponent {
  @Input() items: TabItem[] = [];
  @Input() activo = '';
  @Output() cambio = new EventEmitter<string>();
}
