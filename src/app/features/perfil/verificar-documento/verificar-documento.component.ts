import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { SesionService } from '../../../core/services/sesion.service';
import { ROL_PANEL, UI, mensajeAmigable } from '../../../core/utils/helpers';
import { IconComponent } from '../../../shared/components/icon.component';
import { Aviso, ToastComponent } from '../../../shared/components/toast.component';

function validarCpf(cpf: string): boolean {
  const n = cpf.replace(/\D/g, '');
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += Number(n[i]) * (10 - i);
  let d1 = (soma * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(n[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += Number(n[i]) * (11 - i);
  let d2 = (soma * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(n[10]);
}

function validarCnpj(cnpj: string): boolean {
  const n = cnpj.replace(/\D/g, '');
  if (n.length !== 14 || /^(\d)\1{13}$/.test(n)) return false;
  const calc = (base: string, pesos: number[]) => {
    const soma = base.split('').reduce((acc, ch, i) => acc + Number(ch) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = calc(n.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(n.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(n[12]) && d2 === Number(n[13]);
}

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
              <p class="opacity-90" *ngIf="p.documento">Documento registrado: <strong class="font-mono">{{ p.documento }}</strong></p>
            </div>
          </div>

          <form *ngIf="!estaVerificado()" (ngSubmit)="enviar()" class="space-y-4">
            <label [ngClass]="ui.etiqueta">
              {{ esEmpresa() ? 'Número de CNPJ (14 dígitos)' : 'Número de CPF (11 dígitos)' }}
              <input type="text" [(ngModel)]="documento" name="documento" required maxlength="18"
                     [placeholder]="esEmpresa() ? '00.000.000/0000-00' : '000.000.000-00'"
                     [ngClass]="ui.inputGrande" class="font-mono">
            </label>

            <p class="text-xs text-slate-500">
              Validamos el formato y dígitos verificadores de tu {{ tipoDoc() }} y comprobamos que no esté duplicado en otra cuenta.
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

  cargando = signal(true);
  guardando = signal(false);
  perfil = signal<any>(null);
  rutaVolver = signal('/editar-perfil');
  aviso = signal<Aviso | null>(null);
  error = signal('');
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
      .select('id, rol, documento, cnpj, verificado, estado_documento')
      .eq('id', user.id)
      .maybeSingle();

    this.perfil.set(data);
    this.documento = data?.cnpj || data?.documento || '';

    const volver = this.route.snapshot.queryParamMap.get('volver');
    this.rutaVolver.set(volver || ROL_PANEL[data?.rol ?? ''] || '/editar-perfil');
    this.cargando.set(false);
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
    const digitos = this.documento.replace(/\D/g, '');
    const esEmp = this.esEmpresa();

    if (esEmp && !validarCnpj(digitos)) {
      this.error.set('El CNPJ ingresado no es válido. Revisa los 14 dígitos.');
      return;
    }
    if (!esEmp && !validarCpf(digitos)) {
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

      const cambios: Record<string, unknown> = {
        documento: digitos,
        estado_documento: 'pendiente',
      };
      if (esEmp) cambios['cnpj'] = digitos;

      const { error } = await this.db.from('perfiles').update(cambios).eq('id', p.id);
      if (error) throw error;

      this.perfil.update(curr => ({ ...curr, ...cambios }));
      await this.sesion.recargar();
      this.notificar(`${this.tipoDoc()} registrado correctamente para verificación.`);
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
