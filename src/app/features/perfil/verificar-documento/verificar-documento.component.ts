import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { SesionService } from '../../../core/services/sesion.service';

import { ROL_PANEL, UI, mensajeAmigable } from '../../../core/utils/helpers';
import { IconComponent } from '../../../shared/components/icon.component';
import { Aviso, ToastComponent } from '../../../shared/components/toast.component';
import { BrasilApi } from '../../../core/services/brasil-api';

@Component({
  selector: 'app-verificar-documento',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent, ToastComponent],
  template: `
    <div class="min-h-[calc(100dvh-var(--header-h,4rem))] bg-stone-50 px-4 py-8 text-slate-900">
      <app-toast [aviso]="aviso()" />

      <div class="mx-auto max-w-lg space-y-5">
        <header class="flex items-center justify-between gap-3">
          <div>
            <h1 class="text-xl font-bold">Verificar {{ tipoDoc() }}</h1>
            <p class="text-sm text-slate-500">Valida tu documento para generar mayor confianza en la comunidad.</p>
          </div>
          <a [routerLink]="rutaVolver()" [ngClass]="ui.btnSecundario" class="!px-3 !py-1.5 !text-xs">
            <app-icon nombre="arrow-left" clase="w-3.5 h-3.5" /> Volver
          </a>
        </header>

        <div *ngIf="cargando()" class="h-52 animate-pulse rounded-2xl bg-stone-200/70" aria-busy="true"></div>

        <section *ngIf="!cargando() && perfil() as p" [ngClass]="ui.card" class="space-y-5 p-6">
          <div class="flex items-start gap-3 rounded-xl border p-4"
               [ngClass]="estaVerificado() ? 'border-teal-200 bg-teal-50/70 text-teal-900' : 'border-amber-200 bg-amber-50/70 text-amber-900'">
            <app-icon [nombre]="estaVerificado() ? 'verified' : 'shield'" clase="w-5 h-5 shrink-0 mt-0.5" />
            <div class="text-xs space-y-1">
              <p class="font-bold">
                {{ estaVerificado() ? 'Tu ' + tipoDoc() + ' está verificado' : 'Estado actual: ' + etiquetaEstado(p.estado_documento) }}
              </p>
              <p class="opacity-90" *ngIf="p.documento">
                Documento registrado: <strong class="font-mono">{{ brasilApi.formatearDocumento(p.documento) }}</strong>
              </p>
              <p class="opacity-90" *ngIf="infoEmpresa()">
                {{ infoEmpresa() }}
              </p>
            </div>
          </div>

          <form *ngIf="!estaVerificado()" (ngSubmit)="enviar()" class="space-y-4">
            <label [ngClass]="ui.etiqueta">
              {{ esEmpresa() ? 'Número de CNPJ (14 dígitos)' : 'Número de CPF (11 dígitos)' }}
              <input type="text" [(ngModel)]="documento" name="documento" required maxlength="18"
                     (blur)="formatearEnInput()"
                     [placeholder]="esEmpresa() ? '00.000.000/0000-00' : '000.000.000-00'"
                     [ngClass]="ui.inputGrande" class="font-mono">
            </label>

            <p class="text-xs text-slate-500">
              {{
                esEmpresa()
                  ? 'Validamos el CNPJ, comprobamos que no esté duplicado y consultamos su situación en BrasilAPI.'
                  : 'Validamos el formato y dígitos verificadores de tu CPF y comprobamos que no esté duplicado en otra cuenta.'
              }}
            </p>

            <p *ngIf="error()" role="alert" class="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
              <app-icon nombre="alert" clase="w-4 h-4 shrink-0 mt-0.5" /> {{ error() }}
            </p>

            <div class="flex gap-2">
              <a [routerLink]="rutaVolver()" [ngClass]="ui.btnSecundario" class="flex-1">Cancelar</a>
              <button type="submit" [disabled]="guardando()" [ngClass]="ui.btnPrimario" class="flex-1">
                {{ guardando() ? 'Validando...' : 'Validar y guardar' }}
              </button>
            </div>
          </form>

          <div *ngIf="estaVerificado()" class="pt-1">
            <a [routerLink]="rutaVolver()" [ngClass]="ui.btnPrimario" class="w-full">Continuar</a>
          </div>
        </section>
      </div>
    </div>
  `,
})
export class VerificarDocumentoComponent implements OnInit {
  readonly ui = UI;
  readonly brasilApi = inject(BrasilApi);

  cargando = signal(true);
  guardando = signal(false);
  perfil = signal<any>(null);
  rutaVolver = signal('/editar-perfil');
  aviso = signal<Aviso | null>(null);
  error = signal('');
  infoEmpresa = signal('');
  documento = '';

  esEmpresa = computed(() => ['tienda', 'oficina'].includes(this.perfil()?.rol));
  tipoDoc = computed(() => (this.esEmpresa() ? 'CNPJ' : 'CPF'));
  estaVerificado = computed(() => !!this.perfil()?.verificado || !!this.perfil()?.documento_verificado);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabaseService: SupabaseService,
    private sesion: SesionService,
  ) {}

  private get db() { return this.supabaseService.supabase; }

  async ngOnInit() {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) { this.router.navigate(['/login']); return; }

    const { data } = await this.db
      .from('perfiles')
      .select('id, rol, documento, cnpj, verificado, documento_verificado, documento_tipo, estado_documento')
      .eq('id', user.id)
      .maybeSingle();

    this.perfil.set(data);
    const docInicial = data?.cnpj || data?.documento || '';
    this.documento = docInicial ? this.brasilApi.formatearDocumento(docInicial) : '';

    const volver = this.route.snapshot.queryParamMap.get('volver');
    this.rutaVolver.set(volver || ROL_PANEL[data?.rol ?? ''] || '/editar-perfil');
    this.cargando.set(false);
  }

  formatearEnInput() {
    const limpio = this.brasilApi.limpiarDocumento(this.documento);
    if (limpio.length === 11 || limpio.length === 14) {
      this.documento = this.brasilApi.formatearDocumento(limpio);
    }
  }

  etiquetaEstado(estado: string | null | undefined): string {
    switch (estado) {
      case 'verificado': return 'Verificado';
      case 'pendiente': return 'Pendiente de revisión';
      case 'rechazado': return 'Requiere corrección';
      default: return 'Sin documento verificado';
    }
  }

  async enviar() {
    this.error.set('');
    this.infoEmpresa.set('');

    const digitos = this.brasilApi.limpiarDocumento(this.documento);
    const esEmp = this.esEmpresa();

    if (esEmp && !this.brasilApi.validarCnpj(digitos)) {
      this.error.set('El CNPJ ingresado no es válido. Revisa los 14 dígitos.');
      return;
    }
    if (!esEmp && !this.brasilApi.validarCpf(digitos)) {
      this.error.set('El CPF ingresado no es válido. Revisa los 11 dígitos.');
      return;
    }

    const p = this.perfil();
    if (!p) return;

    this.guardando.set(true);
    try {
      const { data: dup } = await this.db
        .from('perfiles')
        .select('id')
        .eq('documento', digitos)
        .neq('id', p.id)
        .limit(1);

      if ((dup?.length ?? 0) > 0) {
        this.error.set(`Este ${this.tipoDoc()} ya se encuentra registrado en otra cuenta.`);
        return;
      }

      let verificadoCnpj = false;
      let estadoDoc: 'verificado' | 'pendiente' = 'pendiente';
      let mensajeExito = `${this.tipoDoc()} registrado correctamente para verificación.`;

      if (esEmp) {
        const consulta = await this.brasilApi.consultarDocumento(digitos);
        const situacion = (consulta.situacion ?? '').toUpperCase();

        if (situacion && situacion !== 'ATIVA' && !situacion.includes('SIN CONSULTA')) {
          this.error.set(`El CNPJ figura con situación "${consulta.situacion}". No puede verificarse como activo.`);
          return;
        }

        if (consulta.razonSocial) {
          this.infoEmpresa.set(
            `${consulta.razonSocial}${consulta.situacion ? ` · ${consulta.situacion}` : ''}`
          );
        }

        if (situacion === 'ATIVA') {
          verificadoCnpj = true;
          estadoDoc = 'verificado';
          mensajeExito = 'CNPJ verificado en la base pública.';
        }
      }

      const cambios: Record<string, unknown> = {
        documento: digitos,
        documento_tipo: esEmp ? 'cnpj' : 'cpf',
        documento_verificado: verificadoCnpj,
        verificado: verificadoCnpj ? true : !!p.verificado,
        estado_documento: estadoDoc,
      };
      if (esEmp) cambios['cnpj'] = digitos;

      const { error } = await this.db.from('perfiles').update(cambios).eq('id', p.id);
      if (error) throw error;

      this.documento = this.brasilApi.formatearDocumento(digitos);
      this.perfil.update(curr => ({ ...curr, ...cambios }));
      await this.sesion.recargar();
      this.notificar(mensajeExito);
      setTimeout(() => this.router.navigate([this.rutaVolver()]), 1000);
    } catch (e: any) {
      this.error.set(mensajeAmigable(e, `No pudimos guardar tu ${this.tipoDoc()}. Intenta nuevamente.`));
    } finally {
      this.guardando.set(false);
    }
  }

  private notificar(texto: string, tipo: 'ok' | 'error' = 'ok') {
    this.aviso.set({ texto, tipo });
    setTimeout(() => this.aviso.set(null), 3500);
  }
}