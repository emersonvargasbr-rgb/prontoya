import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from './icon.component';

const PALETAS = [
  'bg-teal-100 text-teal-800',
  'bg-amber-100 text-amber-800',
  'bg-sky-100 text-sky-800',
  'bg-rose-100 text-rose-800',
  'bg-violet-100 text-violet-800',
  'bg-lime-100 text-lime-800',
];

const TAMANOS = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-20 h-20 text-2xl',
};

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <span class="relative inline-flex shrink-0" [ngClass]="anillo">
      <span [ngClass]="!color ? paleta : ''"
            [style.backgroundColor]="color || null"
            [style.color]="color ? '#ffffff' : null"
            [class]="tamanoClase + ' inline-flex items-center justify-center rounded-full font-semibold select-none overflow-hidden'">
        <!-- Si hay icono, lo muestra; si no, muestra las iniciales -->
        <app-icon *ngIf="icono" [nombre]="icono" clase="w-1/2 h-1/2" />
        <span *ngIf="!icono">{{ iniciales }}</span>
      </span>
      <span *ngIf="verificado"
            class="absolute -bottom-0.5 -right-0.5 rounded-full bg-white p-px text-teal-600 shadow-sm">
        <app-icon nombre="verified" clase="w-4 h-4" [relleno]="false" />
      </span>
    </span>
  `,
})
export class AvatarComponent {
  @Input() nombre: string | null | undefined = '';
  @Input() tamano: keyof typeof TAMANOS = 'md';
  @Input() verificado = false;
  @Input() color?: string | null;
  @Input() icono?: string | null;
  @Input() anillo?: string | null;

  get tamanoClase() { return TAMANOS[this.tamano]; }

  get iniciales(): string {
    const partes = (this.nombre ?? '').trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '?';
    return (partes[0][0] + (partes[1]?.[0] ?? '')).toUpperCase();
  }

  get paleta(): string {
    if (this.color) return '';
    let h = 0;
    for (const c of this.nombre ?? '') h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return PALETAS[h % PALETAS.length];
  }
}