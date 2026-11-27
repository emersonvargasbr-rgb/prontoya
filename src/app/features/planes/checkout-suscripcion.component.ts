import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { CotizacionSuscripcion, PlanService } from '../../core/services/plan.service';
import { UI, mensajeAmigable } from '../../core/utils/helpers';
import { Ciclo, ETIQUETA_CICLO, PLANES, PlanId, nombreDePlan } from '../../core/utils/planes';
import { IconComponent } from '../../shared/components/icon.component';

const TIPOS_OK = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const MAX_BYTES = 5 * 1024 * 1024;
const CICLOS_VALIDOS: Ciclo[] = ['mensual', 'trimestral', 'anual'];
const QR_BINANCE_URL = '/pagospronto.png';

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
          <span class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700">
            <app-icon nombre="check" clase="w-6 h-6" />
          </span>
          <h2 class="text-base font-bold">Pago enviado para revisión</h2>
          <p class="text-sm text-slate-600">
            Revisaremos tu código y activaremos el plan <strong>{{ cot()?.nombre }}</strong> ({{ etiquetaCiclo[ciclo()] }}) en cuanto lo confirmemos.
          </p>
          <a routerLink="/planes" [ngClass]="ui.btnPrimario" class="w-full">Volver a planes</a>
        </section>

        <!-- ================================================== FORMULARIO -->
        <div *ngIf="!cargando() && !enviado() && cot() as c" [ngClass]="ui.card" class="space-y-6 p-6">

          <!-- Selector rápido de ciclo -->
          <div class="grid grid-cols-3 gap-1.5 rounded-xl bg-stone-100 p-1" role="group" aria-label="Ciclo de pago">
            <button *ngFor="let op of ciclosDisponibles" type="button" (click)="cambiarCiclo(op)"
                    class="rounded-lg py-1.5 text-xs font-semibold transition"
                    [ngClass]="ciclo() === op ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'">
              {{ op === 'mensual' ? '1 mes' : (op === 'trimestral' ? '3 meses (-5%)' : '12 meses (-7%)') }}
            </button>
          </div>

          <div class="border-b border-stone-100 pb-4">
            <p class="text-xs font-semibold text-amber-700">Plan seleccionado · solo USDT / USDC</p>
            <h2 class="mt-1 text-lg font-bold">{{ c.nombre }} <span class="text-sm font-normal text-slate-500">({{ etiquetaCiclo[c.ciclo] }})</span></h2>
            <p class="mt-2 text-3xl font-bold">{{ c.monto_usdt | number:'1.2-2' }} <span class="text-sm font-normal text-slate-500">USDT / USDC</span></p>
            <p *ngIf="c.descuento_pct > 0" class="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-teal-700">
              <app-icon nombre="check" clase="w-3.5 h-3.5" /> Incluye {{ c.descuento_pct }}% de descuento por pago {{ c.ciclo }}
            </p>
          </div>

          <div class="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <h3 class="flex items-center gap-2 text-sm font-bold text-amber-900">
              <app-icon nombre="coin" clase="w-4 h-4 text-amber-600" /> Paga con Binance Pay (USDT o USDC)
            </h3>
            <p class="text-xs text-slate-600">Envía exactamente <strong>{{ c.monto_usdt | number:'1.2-2' }} USDT</strong> o <strong>USDC</strong> a este destinatario:</p>

            <div class="flex items-center justify-between gap-2 rounded-lg border border-amber-300 bg-white p-3">
              <p class="break-all font-mono text-sm font-semibold">
                {{ c.receptor_binance_id || 'Configura receptor_binance_id en config_cobro o contacta a soporte' }}
              </p>
              <button *ngIf="c.receptor_binance_id" type="button" (click)="copiar(c.receptor_binance_id!)" [ngClass]="ui.btnSecundario" class="!px-2.5 !py-1 !text-xs">
                {{ copiado() ? 'Copiado' : 'Copiar' }}
              </button>
            </div>

            <div *ngIf="qrVisible()" class="flex flex-col items-center gap-1.5 rounded-lg border border-amber-200/80 bg-white p-3 text-center">
              <img [src]="qrUrl" (error)="qrVisible.set(false)" alt="Código QR de cobro Binance Pay"
                   class="h-40 w-40 rounded-lg object-contain" />
              <p class="text-[11px] text-slate-500">Escanea el código QR desde Binance Pay o envía al ID indicado.</p>
            </div>

            <details class="text-xs text-slate-600">
              <summary class="cursor-pointer font-semibold">Cómo hacerlo paso a paso</summary>
              <ol class="mt-2 list-decimal space-y-1 pl-5">
                <li>En la app de Binance entra a <strong>Pay</strong> y elige <strong>Enviar</strong> o escanea el <strong>QR</strong>.</li>
                <li>Verifica que el destinatario coincida y envía el monto exacto en <strong>USDT</strong> o <strong>USDC</strong>.</li>
                <li>Abre el detalle de la operación y copia el <strong>ID de la orden</strong>.</li>
                <li>Pégalo abajo junto con tu comprobante para confirmar tu suscripción.</li>
              </ol>
            </details>
          </div>

          <div class="space-y-4">
            <label [ngClass]="ui.etiqueta">ID de orden / código de transacción de Binance
              <input type="text" [(ngModel)]="codigo" name="codigo" autocomplete="off" spellcheck="false"
                     placeholder="Lo ves en el recibo de Binance" [ngClass]="ui.inputGrande" class="font-mono">
            </label>

            <label [ngClass]="ui.etiqueta">Tu Binance ID o correo de Binance <span class="font-normal text-slate-400">(recomendado)</span>
              <input type="text" [(ngModel)]="pagador" name="pagador" autocomplete="off"
                     placeholder="Nos permite comprobar que el pago es tuyo" [ngClass]="ui.inputGrande">
            </label>

            <div>
              <label [ngClass]="ui.etiqueta" for="comprobante">Captura del comprobante <span class="font-normal text-slate-400">(imagen o PDF, máx. 5 MB)</span></label>
              <input id="comprobante" type="file" (change)="alElegirArchivo($event)" accept="image/png,image/jpeg,image/webp,application/pdf"
                     class="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-amber-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-amber-800 hover:file:bg-amber-100">
              <p *ngIf="archivo()" class="mt-1 text-xs text-slate-500">{{ archivo()!.name }} · {{ archivo()!.size / 1024 | number:'1.0-0' }} KB</p>
            </div>

            <p *ngIf="error()" role="alert" class="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
              <app-icon nombre="alert" clase="w-4 h-4 shrink-0 mt-0.5" /> {{ error() }}
            </p>

            <button type="button" (click)="abrirConfirmacion()" [disabled]="enviando()" [ngClass]="ui.btnOscuro" class="w-full !py-3">
              {{ enviando() ? 'Enviando...' : 'Revisar y confirmar pago de ' + (c.monto_usdt | number:'1.2-2') + ' USDT / USDC' }}
            </button>
            <p class="text-center text-[11px] text-slate-400">Tu comprobante es privado: sólo lo ve el equipo de administración.</p>
          </div>
        </div>

        <!-- Tus solicitudes -->
        <section *ngIf="!cargando() && misSolicitudes().length" class="space-y-2">
          <h2 class="text-sm font-bold">Tus solicitudes</h2>
          <ul [ngClass]="ui.card" class="divide-y divide-stone-100">
            <li *ngFor="let s of misSolicitudes()" class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div class="min-w-0">
                <p class="font-semibold">{{ nombrePlan(s.plan_id) }} · {{ s.ciclo }}</p>
                <p class="text-xs text-slate-500">{{ s.created_at | date:'dd/MM/yyyy HH:mm' }}<span *ngIf="s.referencia_pago"> · <span class="font-mono">{{ s.referencia_pago }}</span></span></p>
              </div>
              <span class="rounded-md px-2 py-0.5 text-[11px] font-semibold"
                    [ngClass]="estadoClase(s.estado)">{{ s.estado }}</span>
            </li>
          </ul>
        </section>
      </div>

      <!-- MODAL DE CONFIRMACIÓN DE PAGO -->
      <div *ngIf="mostrarConfirmacion() && cot() as c"
           class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
           role="dialog" aria-modal="true" aria-labelledby="titulo-conf-pago">
        <div class="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
          <div class="flex items-start justify-between gap-3">
            <h3 id="titulo-conf-pago" class="text-base font-bold text-slate-900">Confirmar envío de pago</h3>
            <button type="button" (click)="mostrarConfirmacion.set(false)" aria-label="Cerrar" [ngClass]="ui.btnSecundario" class="!px-2 !py-1.5">
              <app-icon nombre="x" clase="w-4 h-4" />
            </button>
          </div>
          <dl class="space-y-2 rounded-xl bg-stone-50 p-4 text-xs">
            <div class="flex justify-between"><dt class="text-slate-500">Plan</dt><dd class="font-bold">{{ c.nombre }}</dd></div>
            <div class="flex justify-between"><dt class="text-slate-500">Ciclo</dt><dd class="font-bold">{{ etiquetaCiclo[c.ciclo] }}</dd></div>
            <div class="flex justify-between"><dt class="text-slate-500">Monto</dt><dd class="font-bold text-teal-800">{{ c.monto_usdt | number:'1.2-2' }} USDT / USDC</dd></div>
            <div class="flex justify-between"><dt class="text-slate-500">Referencia</dt><dd class="font-mono font-bold">{{ codigo.trim() }}</dd></div>
            <div class="flex justify-between" *ngIf="archivo()"><dt class="text-slate-500">Comprobante</dt><dd class="truncate max-w-[12rem] font-semibold">{{ archivo()!.name }}</dd></div>
          </dl>
          <div class="flex gap-2">
            <button type="button" (click)="mostrarConfirmacion.set(false)" [ngClass]="ui.btnSecundario" class="flex-1">Revisar</button>
            <button type="button" (click)="enviar()" [disabled]="enviando()" [ngClass]="ui.btnPrimario" class="flex-1">
              {{ enviando() ? 'Confirmando...' : 'Confirmar y enviar' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class CheckoutSuscripcionComponent implements OnInit {
  readonly ui = UI;
  readonly nombrePlan = nombreDePlan;
  readonly etiquetaCiclo = ETIQUETA_CICLO;
  readonly ciclosDisponibles = CICLOS_VALIDOS;
  readonly qrUrl = QR_BINANCE_URL;

  planId = signal<PlanId>('pro');
  ciclo = signal<Ciclo>('trimestral');

  cargando = signal(true);
  enviando = signal(false);
  enviado = signal(false);
  mostrarConfirmacion = signal(false);
  error = signal('');
  errorCotizacion = signal('');
  copiado = signal(false);
  qrVisible = signal(true);

  cot = signal<CotizacionSuscripcion | null>(null);
  misSolicitudes = signal<any[]>([]);
  archivo = signal<File | null>(null);

  codigo = '';
  pagador = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabaseService: SupabaseService,
    private planService: PlanService,
  ) {}

  private get db() { return this.supabaseService.supabase; }

  estadoClase(estado: unknown): string {
    const e = (typeof estado === 'string' ? estado : '').trim().toLowerCase();
    if (e === 'activa' || e === 'aprobada') return 'bg-teal-50 text-teal-800';
    if (e === 'pendiente') return 'bg-amber-50 text-amber-800';
    if (e === 'rechazada') return 'bg-rose-50 text-rose-700';
    return 'bg-slate-100 text-slate-600';
  }

  async ngOnInit() {
    const { data: { session } } = await this.db.auth.getSession();
    if (!session?.user) { this.router.navigate(['/login']); return; }

    const q = this.route.snapshot.queryParamMap;
    const planParam = (q.get('plan') ?? '').toLowerCase().trim() as PlanId;
    const planValido = PLANES.some(p => p.id === planParam) ? planParam : 'pro';
    const cicloParam = (q.get('ciclo') ?? '').toLowerCase().trim() as Ciclo;
    const cicloValido = CICLOS_VALIDOS.includes(cicloParam) ? cicloParam : 'trimestral';

    this.planId.set(planValido);
    this.ciclo.set(cicloValido);

    await Promise.all([this.cotizar(), this.cargarSolicitudes(session.user.id)]);
    this.cargando.set(false);
  }

  async cambiarCiclo(nuevo: Ciclo) {
    if (this.ciclo() === nuevo) return;
    this.ciclo.set(nuevo);
    this.errorCotizacion.set('');
    await this.cotizar();
  }

  private async cotizar() {
    try {
      const data = await this.planService.cotizarSuscripcion(this.planId(), this.ciclo());
      this.cot.set(data);
    } catch (e: any) {
      this.errorCotizacion.set(mensajeAmigable(e, 'No se pudo calcular el precio del plan.'));
    }
  }

  private async cargarSolicitudes(userId: string) {
    const { data, error } = await this.db
      .from('suscripciones')
      .select('id, plan_id, ciclo, estado, created_at, referencia_pago')
      .eq('perfil_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);
    if (!error) {
      this.misSolicitudes.set(data ?? []);
    }
  }

  alElegirArchivo(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this.error.set('');
    if (f && !TIPOS_OK.includes(f.type)) {
      this.error.set('El comprobante debe ser una imagen (PNG, JPG, WEBP) o un PDF.');
      this.archivo.set(null);
      return;
    }
    if (f && f.size > MAX_BYTES) {
      this.error.set('El archivo supera los 5 MB.');
      this.archivo.set(null);
      return;
    }
    this.archivo.set(f);
  }

  async copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 1800);
    } catch { /* sin permiso de portapapeles */ }
  }

  abrirConfirmacion() {
    this.error.set('');
    if (this.codigo.trim().length < 6) {
      this.error.set('Ingresa el código de transacción de Binance (mínimo 6 caracteres).');
      return;
    }
    this.mostrarConfirmacion.set(true);
  }

  async enviar() {
    this.error.set('');
    const codigo = this.codigo.trim();
    if (codigo.length < 6) {
      this.error.set('Ingresa el código de transacción de Binance.');
      return;
    }

    this.enviando.set(true);
    try {
      const { data: { user } } = await this.db.auth.getUser();
      if (!user) throw new Error('Debes iniciar sesión.');

      let ruta: string | null = null;
      const f = this.archivo();
      if (f) {
        const limpio = f.name.normalize('NFD').replace(/[^\w.\-]+/g, '_').slice(-60);
        ruta = `${user.id}/${Date.now()}_${limpio}`;
        const { error: errSubida } = await this.db.storage.from('comprobantes').upload(ruta, f, { contentType: f.type });
        if (errSubida) throw new Error('No se pudo subir el comprobante: ' + errSubida.message);
      }

      try {
        await this.planService.solicitarSuscripcion({
          plan: this.planId(),
          ciclo: this.ciclo(),
          referencia: codigo,
          comprobante: ruta,
          pagador: this.pagador.trim() || null,
        });
      } catch (rpcErr: any) {
        if (ruta) await this.db.storage.from('comprobantes').remove([ruta]);
        throw rpcErr;
      }

      this.mostrarConfirmacion.set(false);
      this.enviado.set(true);
      await this.cargarSolicitudes(user.id);
    } catch (e: any) {
      this.mostrarConfirmacion.set(false);
      this.error.set(mensajeAmigable(e, 'Ocurrió un error al registrar el pago.'));
    } finally {
      this.enviando.set(false);
    }
  }
}