import { Component, EventEmitter, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IconComponent } from './icon.component';
import { AvatarComponent } from './avatar.component';
import { SocialService } from '../../core/services/social.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ROL_ETIQUETA, UI, uno } from '../../core/utils/helpers';

@Component({
  selector: 'app-solicitudes-vinculo',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent, AvatarComponent],
  template: `
    <div *ngIf="items().length > 0" class="space-y-6 mb-6">
      <!-- 1. Solicitudes de empleo / vacante -->
      <section *ngIf="solicitudesEmpleo().length > 0">
        <h2 class="mb-2 text-sm font-bold">Postulaciones y solicitudes de equipo</h2>
        <ul class="space-y-2">
          <li *ngFor="let s of solicitudesEmpleo()" [ngClass]="ui.card" class="flex flex-wrap items-center gap-3 p-3">
            <app-avatar [nombre]="s.solicitante?.nombre_completo" [verificado]="!!s.solicitante?.verificado" />
            <a [routerLink]="['/perfil-usuario', s.solicitante?.id]" class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p class="truncate text-sm font-bold hover:underline">{{ s.solicitante?.nombre_completo }}</p>
                <span class="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                  Empleo / Equipo
                </span>
              </div>
              <p class="text-xs text-slate-500">
                {{ roles[s.solicitante?.rol]?.txt }} · {{ s.solicitante?.zona_ubicacion || 'São Paulo' }}
                <span *ngIf="s.solicitante?.especialidad_principal"> · {{ s.solicitante.especialidad_principal }}</span>
              </p>
            </a>
            <button type="button" (click)="responder(s, false)" aria-label="Rechazar" [ngClass]="ui.btnPeligro" class="!px-2.5">
              <app-icon nombre="x" clase="w-4 h-4" />
            </button>
            <button type="button" (click)="aceptarYAgregarEquipo(s)" [ngClass]="ui.btnPrimario">
              <app-icon nombre="check" clase="w-4 h-4" /> Incorporar
            </button>
          </li>
        </ul>
      </section>

      <!-- 2. Conexiones directas / contactos externos (sin postulación previa) -->
      <section *ngIf="conexionesDirectas().length > 0">
        <h2 class="mb-2 text-sm font-bold">Conexiones directas y contactos externos</h2>
        <ul class="space-y-2">
          <li *ngFor="let s of conexionesDirectas()" [ngClass]="ui.card" class="flex flex-wrap items-center gap-3 p-3">
            <app-avatar [nombre]="s.solicitante?.nombre_completo" [verificado]="!!s.solicitante?.verificado" />
            <a [routerLink]="['/perfil-usuario', s.solicitante?.id]" class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p class="truncate text-sm font-bold hover:underline">{{ s.solicitante?.nombre_completo }}</p>
                <span class="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                  Contacto directo
                </span>
              </div>
              <p class="text-xs text-slate-500">
                {{ roles[s.solicitante?.rol]?.txt }} · {{ s.solicitante?.zona_ubicacion || 'São Paulo' }}
                <span *ngIf="s.solicitante?.telefono"> · {{ s.solicitante.telefono }}</span>
              </p>
            </a>
            <button type="button" (click)="responder(s, false)" aria-label="Rechazar" [ngClass]="ui.btnPeligro" class="!px-2.5">
              <app-icon nombre="x" clase="w-4 h-4" />
            </button>
            <button type="button" (click)="responder(s, true)" [ngClass]="ui.btnSecundario" class="!px-3">
              Conectar
            </button>
            <button *ngIf="s.solicitante?.rol === 'funcionario'" type="button" (click)="aceptarYAgregarEquipo(s)" [ngClass]="ui.btnPrimario">
              <app-icon nombre="user-plus" clase="w-4 h-4" /> Al equipo
            </button>
          </li>
        </ul>
      </section>
    </div>
  `,
})
export class SolicitudesVinculoComponent implements OnInit {
  readonly ui = UI;
  readonly roles = ROL_ETIQUETA;
  items = signal<any[]>([]);
  @Output() cambio = new EventEmitter<void>();

  solicitudesEmpleo = () =>
    this.items().filter(s => Boolean(s.publicacion_id || s.es_empleo || s.tipo_solicitud === 'empleo'));

  conexionesDirectas = () =>
    this.items().filter(s => !Boolean(s.publicacion_id || s.es_empleo || s.tipo_solicitud === 'empleo'));

  constructor(
    private social: SocialService,
    private supabaseService: SupabaseService,
  ) {}

  private get db() { return this.supabaseService.supabase; }

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

  async aceptarYAgregarEquipo(s: any) {
    try {
      await this.social.responderVinculo(s.id, true);
      const { data: { user } } = await this.db.auth.getUser();
      const funcionarioId = s.solicitante?.id ?? s.solicitante_id;

      if (user?.id && funcionarioId) {
        const { error } = await this.db.from('empleados').upsert({
          empleador_id: user.id,
          funcionario_id: funcionarioId,
          estado: 'Activo',
          fecha_salida: null,
        }, { onConflict: 'empleador_id,funcionario_id' });
        if (error) throw error;
      }

      this.items.update(l => l.filter(x => x.id !== s.id));
      this.cambio.emit();
    } catch (e) { console.error(e); }
  }
}