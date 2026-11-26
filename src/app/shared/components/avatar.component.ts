import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICONOS_DISPONIBLES, IconComponent } from './icon.component';

export const AVATAR_PALETAS = [
  { id: 'teal',   nombre: 'Verde',    clase: 'bg-teal-100 text-teal-800' },
  { id: 'amber',  nombre: 'Ámbar',    clase: 'bg-amber-100 text-amber-800' },
  { id: 'sky',    nombre: 'Celeste',  clase: 'bg-sky-100 text-sky-800' },
  { id: 'rose',   nombre: 'Rosa',     clase: 'bg-rose-100 text-rose-800' },
  { id: 'violet', nombre: 'Violeta',  clase: 'bg-violet-100 text-violet-800' },
  { id: 'lime',   nombre: 'Lima',     clase: 'bg-lime-100 text-lime-800' },
];

const TAMANOS = {
  sm: { caja: 'w-8 h-8 text-xs',    icono: 'w-4 h-4' },
  md: { caja: 'w-10 h-10 text-sm',  icono: 'w-5 h-5' },
  lg: { caja: 'w-16 h-16 text-xl',  icono: 'w-8 h-8' },
  xl: { caja: 'w-20 h-20 text-2xl', icono: 'w-10 h-10' },
};

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <span class="relative inline-flex shrink-0">
      <span [ngClass]="[tam.caja, paletaFondo, aro]"
            [style.backgroundColor]="colorHex || null"
            [style.color]="colorHex ? '#ffffff' : null"
            class="inline-flex items-center justify-center overflow-hidden rounded-full font-semibold select-none relative">

        <!-- Si es imagen ilustrada por archivo SVG externo -->
        <img *ngIf="esImagen; else renderIconoOIniciales" [src]="rutaImagen" alt="" class="h-full w-full object-cover">

        <!-- Si usa el diccionario de iconos SVG o fallback a iniciales -->
        <ng-template #renderIconoOIniciales>
          <app-icon *ngIf="iconoValido; else renderIniciales"
                    [nombre]="iconoEfectivo!"
                    [clase]="claseSvgInterior" />
          <ng-template #renderIniciales>
            <span class="font-bold tracking-tight uppercase">{{ iniciales }}</span>
          </ng-template>
        </ng-template>

      </span>

      <!-- Insignia de Verificado -->
      <span *ngIf="verificado" class="absolute -bottom-0.5 -right-0.5 rounded-full bg-white p-px text-teal-600 shadow-sm">
        <app-icon nombre="verified" clase="w-4 h-4" />
      </span>
    </span>
  `,
})
export class AvatarComponent {
  @Input() nombre: string | null | undefined = '';
  @Input() tamano: keyof typeof TAMANOS = 'md';
  @Input() verificado = false;
  @Input() icono?: string | null;
  @Input() svgId?: string | null;     // Compatibilidad con `avatar_svg_id`
  @Input() color?: string | null;     // Puede ser ID de paleta o un HEX plano
  @Input() anillo?: string | null;    // Clase ring-* del nivel
  @Input() marco?: string | null;     // 'gold' para marco dorado animado de planes élite

  get tam() { return TAMANOS[this.tamano] || TAMANOS.md; }

  get iconoEfectivo(): string | null {
    const val = (this.icono || this.svgId || '').trim();
    return val || null;
  }

  /** Los avatares ilustrados (100x100) ocupan el 82% del círculo; los íconos de línea (24x24) el 60% */
  get claseSvgInterior(): string {
    const esIlustracion = !!this.iconoEfectivo && this.iconoEfectivo.startsWith('avatar-');
    return esIlustracion
      ? 'absolute inset-0 m-auto w-[82%] h-[82%]'
      : 'absolute inset-0 m-auto w-3/5 h-3/5';
  }

  get esImagen(): boolean { return !!this.iconoEfectivo && this.iconoEfectivo.startsWith('img:'); }
  get rutaImagen(): string { return `assets/avatars/${(this.iconoEfectivo ?? '').slice(4)}.svg`; }
  get iconoValido(): boolean {
    const id = this.iconoEfectivo;
    return !!id && !id.startsWith('img:') && id in ICONOS_DISPONIBLES;
  }

  get iniciales(): string {
    const partes = (this.nombre ?? '').trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return 'CP';
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + partes[1][0]).toUpperCase();
  }

  get colorHex(): string | null {
    if (this.color && this.color.startsWith('#')) return this.color;
    return null;
  }

  get paletaFondo(): string {
    if (this.colorHex) return '';
    const elegida = AVATAR_PALETAS.find(p => p.id === this.color);
    if (elegida) return elegida.clase;

    let h = 0;
    for (const c of this.nombre ?? '') h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return AVATAR_PALETAS[h % AVATAR_PALETAS.length].clase;
  }

  get aro(): string {
    if (this.marco === 'gold') return 'marco-gold';
    return this.anillo ? 'ring-2 ring-offset-2 ' + this.anillo : '';
  }
}