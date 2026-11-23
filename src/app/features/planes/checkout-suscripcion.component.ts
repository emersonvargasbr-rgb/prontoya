import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { UI, moneda } from '../../core/utils/helpers';
import { IconComponent } from '../../shared/components/icon.component';

interface Cotizacion {
  plan: string; nombre: string; ciclo: string;
  monto_brl_centavos: number; monto_usdt: number; tasa: number;
  receptor_binance_id: string | null; receptor_nombre: string | null;
}

const TIPOS_OK = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Checkout de suscripción por Binance Pay.
 *  - El precio y el receptor los calcula el SERVIDOR (cotizar_suscripcion): el navegador ya no decide cuánto se paga.
 *  - La solicitud entra por solicitar_suscripcion(): el usuario no escribe en la tabla `suscripciones`.
 *  - El comprobante se sube a la carpeta privada <tu-id>/ del bucket "comprobantes".
 */
@Component({
  selector: 'app-checkout-suscripcion',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent],
  template: `
    <div class="min-h-[calc(100dvh-var(--header-h,4rem))] bg-stone-50 px-4 py-8 text-slate-900">
      <div class="mx-auto max-w-xl space-y-5">

        <header class="flex items-center justify-between gap-3">
          <h1 class="text-xl font-bold">Finalizar suscripción</h1>
          <a routerLink="/planes" class="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline">
            <app-icon nombre="arrow-left" clase="w-3.5 h-3.5" /> Volver a planes
          </a>
        </header>

        <div *ngIf="cargando()" class="h-72 animate-pulse rounded-2xl bg-stone-200/70" aria-busy="true"></div>

        <p *ngIf="!cargando() && errorCotizacion()" role="alert" class="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
          <app-icon nombre="alert" clase="w-4 h-4 shrink-0 mt-0.5" /> {{ errorCotizacion() }}
        </p>

        <!-- ================================================== ENVIADO -->
        <section *ngIf="enviado()" [ngClass]="ui.card" class="space-y-3 p-6 text-center" role="status">
          <span class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700"><app-icon nombre="check" clase="w-6 h-6" /></span>
          <h2 class="text-base font-bold">Pago enviado para revisión</h2>
          <p class="text-sm text-slate-600">Revisaremos tu código y activaremos el plan {{ cot()?.nombre }} en cuanto lo confirmemos. Normalmente tarda pocas horas.</p>
          <a routerLink="/planes" [ngClass]="ui.btnPrimario" class="w-full">Volver a planes</a>
        </section>

        <!-- ================================================== FORMULARIO -->
        <div *ngIf="!cargando() && !enviado() && cot() as c" [ngClass]="ui.card" class="space-y-6 p-6">

          <div class="border-b border-stone-100 pb-4">
            <p class="text-xs font-semibold text-amber-700">Plan seleccionado · pago en cripto</p>
            <h2 class="mt-1 text-lg font-bold">{{ c.nombre }} <span class="text-sm font-normal text-slate-500">({{ c.ciclo }})</span></h2>
            <p class="mt-2 text-3xl font-bold">{{ c.monto_usdt | number:'1.2-2' }} <span class="text-sm font-normal text-slate-500">USDT</span></p>
            <p class="mt-0.5 text-xs text-slate-500">Equivale a {{ moneda(c.monto_brl_centavos) }} (1 USDT = R$ {{ c.tasa | number:'1.2-2' }})</p>
            <p *ngIf="c.ciclo === 'anual'" class="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-teal-700"><app-icon nombre="check" clase="w-3.5 h-3.5" /> Incluye el descuento por pago anual</p>
          </div>

          <div class="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <h3 class="flex items-center gap-2 text-sm font-bold text-amber-900"><app-icon nombre="coin" clase="w-4 h-4 text-amber-600" /> Paga con Binance Pay</h3>
            <p class="text-xs text-slate-600">Envía exactamente <strong>{{ c.monto_usdt | number:'1.2-2' }} USDT</strong> (o USDC) a este destinatario:</p>
            <div class="flex items-center justify-between gap-2 rounded-lg border border-amber-300 bg-white p-3">
              <p class="break-all font-mono text-sm font-semibold">{{ c.receptor_binance_id || 'Destinatario no configurado' }}</p>
              <button *ngIf="c.receptor_binance_id" type="button" (click)="copiar(c.receptor_binance_id!)" [ngClass]="ui.btnSecundario" class="!px-2.5 !py-1 !text-xs">{{ copiado() ? 'Copiado' : 'Copiar' }}</button>
            </div>
            <details class="text-xs text-slate-600">
              <summary class="cursor-pointer font-semibold">Cómo hacerlo paso a paso</summary>
              <ol class="mt-2 list-decimal space-y-1 pl-5">
                <li>En la app de Binance entra a <strong>Pay</strong> y elige <strong>Enviar</strong>.</li>
                <li>Selecciona el envío por ID de Binance Pay o correo y pega el destinatario.</li>
                <li>Escribe el monto exacto en USDT y confirma.</li>
                <li>Abre el detalle de la operación y copia el <strong>ID de la orden</strong>. Es el código que pedimos abajo.</li>
              </ol>
            </details>
          </div>

          <div class="space-y-4">
            <label [ngClass]="ui.etiqueta">ID de orden / código de transacción de Binance
              <input type="text" [(ngModel)]="codigo" name="codigo" autocomplete="off" spellcheck="false" placeholder="Lo ves en el recibo de Binance" [ngClass]="ui.inputGrande" class="font-mono"></label>

            <label [ngClass]="ui.etiqueta">Tu Binance ID o correo de Binance <span class="font-normal text-slate-400">(recomendado)</span>
              <input type="text" [(ngModel)]="pagador" name="pagador" autocomplete="off" placeholder="Nos permite comprobar que el pago es tuyo" [ngClass]="ui.inputGrande"></label>

            <div>
              <label [ngClass]="ui.etiqueta" for="comprobante">Captura del comprobante <span class="font-normal text-slate-400">(imagen o PDF, máx. 5 MB)</span></label>
              <input id="comprobante" type="file" (change)="alElegirArchivo($event)" accept="image/png,image/jpeg,image/webp,application/pdf"
                     class="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-amber-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-amber-800 hover:file:bg-amber-100">
              <p *ngIf="archivo()" class="mt-1 text-xs text-slate-500">{{ archivo()!.name }} · {{ archivo()!.size / 1024 | number:'1.0-0' }} KB</p>
            </div>

            <p *ngIf="error()" role="alert" class="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
              <app-icon nombre="alert" clase="w-4 h-4 shrink-0 mt-0.5" /> {{ error() }}
            </p>

            <button type="button" (click)="enviar()" [disabled]="enviando()" [ngClass]="ui.btnOscuro" class="w-full !py-3">
              {{ enviando() ? 'Enviando...' : 'Enviar pago de ' + (c.monto_usdt | number:'1.2-2') + ' USDT' }}
            </button>
            <p class="text-center text-[11px] text-slate-400">Tu comprobante es privado: sólo lo ve el equipo de CosturaPronta.</p>
          </div>
        </div>

        <!-- Tus solicitudes -->
        <section *ngIf="!cargando() && misSolicitudes().length" class="space-y-2">
          <h2 class="text-sm font-bold">Tus solicitudes</h2>
          <ul [ngClass]="ui.card" class="divide-y divide-stone-100">
            <li *ngFor="let s of misSolicitudes()" class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div class="min-w-0">
                <p class="font-semibold">{{ s.plan_id }} · {{ s.ciclo }}</p>
                <p class="text-xs text-slate-500">{{ s.created_at | date:'dd/MM/yyyy HH:mm' }}<span *ngIf="s.estado === 'Rechazada' && s.motivo_rechazo"> · {{ s.motivo_rechazo }}</span></p>
              </div>
              <span class="rounded-md px-2 py-0.5 text-[11px] font-semibold"
                    [ngClass]="s.estado === 'Activa' ? 'bg-teal-50 text-teal-800' : (s.estado === 'Pendiente' ? 'bg-amber-50 text-amber-800' : (s.estado === 'Rechazada' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'))">{{ s.estado }}</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  `,
})
export class CheckoutSuscripcionComponent implements OnInit {
  readonly ui = UI;
  readonly moneda = moneda;

  planId = signal('');
  ciclo = signal<'mensual' | 'anual'>('mensual');

  cargando = signal(true);
  enviando = signal(false);
  enviado = signal(false);
  error = signal('');
  errorCotizacion = signal('');
  copiado = signal(false);

  cot = signal<Cotizacion | null>(null);
  misSolicitudes = signal<any[]>([]);
  archivo = signal<File | null>(null);

  codigo = '';
  pagador = '';

  constructor(private route: ActivatedRoute, private router: Router, private supabaseService: SupabaseService) {}

  private get db() { return this.supabaseService.supabase; }

  async ngOnInit() {
    const { data: { session } } = await this.db.auth.getSession();
    if (!session?.user) { this.router.navigate(['/login']); return; }

    const q = this.route.snapshot.queryParamMap;
    this.planId.set(q.get('plan') ?? '');
    this.ciclo.set(q.get('ciclo') === 'anual' ? 'anual' : 'mensual');

    await Promise.all([this.cotizar(), this.cargarSolicitudes()]);
    this.cargando.set(false);
  }

  /** El precio sale del servidor. Lo que llegue por la URL (monto) se ignora a propósito. */
  private async cotizar() {
    const { data, error } = await this.db.rpc('cotizar_suscripcion', { p_plan: this.planId(), p_ciclo: this.ciclo() });
    if (error) { this.errorCotizacion.set(error.message || 'No se pudo calcular el precio del plan.'); return; }
    this.cot.set(data as Cotizacion);
  }

  private async cargarSolicitudes() {
    const { data } = await this.db.from('suscripciones')
      .select('id, plan_id, ciclo, estado, created_at, motivo_rechazo')
      .order('created_at', { ascending: false }).limit(5);
    this.misSolicitudes.set(data ?? []);
  }

  alElegirArchivo(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this.error.set('');
    if (f && !TIPOS_OK.includes(f.type)) { this.error.set('El comprobante debe ser una imagen (PNG, JPG, WEBP) o un PDF.'); this.archivo.set(null); return; }
    if (f && f.size > MAX_BYTES) { this.error.set('El archivo supera los 5 MB.'); this.archivo.set(null); return; }
    this.archivo.set(f);
  }

  async copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 1800);
    } catch { /* sin permiso de portapapeles */ }
  }

  async enviar() {
    this.error.set('');
    const codigo = this.codigo.trim();
    if (codigo.length < 6) { this.error.set('Ingresa el código de transacción de Binance.'); return; }

    this.enviando.set(true);
    try {
      const { data: { user } } = await this.db.auth.getUser();
      if (!user) throw new Error('Debes iniciar sesión.');

      // 1) comprobante a TU carpeta privada (<id>/archivo)
      let ruta: string | null = null;
      const f = this.archivo();
      if (f) {
        const limpio = f.name.normalize('NFD').replace(/[^\w.\-]+/g, '_').slice(-60);
        ruta = `${user.id}/${Date.now()}_${limpio}`;
        const { error: errSubida } = await this.db.storage.from('comprobantes').upload(ruta, f, { contentType: f.type });
        if (errSubida) throw new Error('No se pudo subir el comprobante: ' + errSubida.message);
      }

      // 2) solicitud: el servidor valida plan, rol, formato y código repetido, y fija el monto
      const { error } = await this.db.rpc('solicitar_suscripcion', {
        p_plan: this.planId(), p_ciclo: this.ciclo(), p_referencia: codigo, p_comprobante: ruta, p_pagador: this.pagador.trim() || null,
      });
      if (error) {
        if (ruta) await this.db.storage.from('comprobantes').remove([ruta]);   // no dejar archivos huérfanos
        throw new Error(error.message);
      }

      this.enviado.set(true);
      await this.cargarSolicitudes();
    } catch (e: any) {
      this.error.set(e?.message ?? 'Ocurrió un error al registrar el pago.');
    } finally {
      this.enviando.set(false);
    }
  }
}