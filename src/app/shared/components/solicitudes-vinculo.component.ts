import { Component, EventEmitter, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IconComponent } from './icon.component';
import { AvatarComponent } from './avatar.component';
import { SocialService } from '../../core/services/social.service';
import { ROL_ETIQUETA, UI, uno } from '../../core/utils/helpers';

/**
 * Lista las solicitudes de conexión que otros te enviaron.
 * No pinta nada si no hay ninguna. Uso:  <app-solicitudes-vinculo (cambio)="recargar()" />
 */
@Component({
  selector: 'app-solicitudes-vinculo',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent, AvatarComponent],
  template: `
    <section *ngIf="items().length > 0" class="mb-6">
      <h2 class="mb-2 text-sm font-bold">Solicitudes de conexión</h2>
      <ul class="space-y-2">
        <li *ngFor="let s of items()" [ngClass]="ui.card" class="flex items-center gap-3 p-3">
          <app-avatar [nombre]="s.solicitante?.nombre_completo" [verificado]="!!s.solicitante?.verificado" />
          <a [routerLink]="['/perfil-usuario', s.solicitante?.id]" class="min-w-0 flex-1">
            <p class="truncate text-sm font-bold hover:underline">{{ s.solicitante?.nombre_completo }}</p>
            <p class="text-xs text-slate-500">{{ roles[s.solicitante?.rol]?.txt }} · {{ s.solicitante?.zona_ubicacion || 'São Paulo' }}</p>
          </a>
          <button type="button" (click)="responder(s, false)" aria-label="Rechazar" [ngClass]="ui.btnPeligro" class="!px-2.5">
            <app-icon nombre="x" clase="w-4 h-4" />
          </button>
          <button type="button" (click)="responder(s, true)" [ngClass]="ui.btnPrimario">
            <app-icon nombre="check" clase="w-4 h-4" /> Aceptar
          </button>
        </li>
      </ul>
    </section>
  `,
})
export class SolicitudesVinculoComponent implements OnInit {
  readonly ui = UI;
  readonly roles = ROL_ETIQUETA;
  items = signal<any[]>([]);
  @Output() cambio = new EventEmitter<void>();

  constructor(private social: SocialService) {}

  ngOnInit() { this.cargar(); }

  async cargar() {
    try {
      const data = await this.social.solicitudesRecibidas();
      this.items.set(data.map((s: any) => ({ ...s, solicitante: uno(s.solicitante) })));
    } catch (e) { console.error(e); }
  }

  async responder(s: any, aceptar: boolean) {
    try {
      await this.social.responderVinculo(s.id, aceptar);
      this.items.update(l => l.filter(x => x.id !== s.id));
      this.cambio.emit();
    } catch (e) { console.error(e); }
  }
}
