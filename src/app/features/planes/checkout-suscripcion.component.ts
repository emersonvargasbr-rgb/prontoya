import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { UI } from '../../core/utils/helpers';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-checkout-suscripcion',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent],
  template: `
    <div class="min-h-[calc(100dvh-var(--header-h,4rem))] bg-stone-50 px-4 py-8 text-slate-900">
      <div class="mx-auto max-w-xl space-y-6">

        <header class="flex items-center justify-between">
          <h1 class="text-xl font-bold">Finalizar Suscripción con Binance</h1>
          <a routerLink="/planes" class="text-xs font-semibold text-teal-700 hover:underline">← Volver a planes</a>
        </header>

        <div class="rounded-2xl border border-stone-200 bg-white p-6 space-y-6 shadow-sm">
          
          <!-- Resumen del Plan con Precios en USDT Calculados -->
          <div class="border-b border-stone-100 pb-4">
            <span class="text-xs font-semibold text-amber-700 uppercase tracking-wider">Plan Seleccionado (Pago en Cripto)</span>
            <h2 class="text-lg font-bold text-slate-900 capitalize">{{ planId() }} ({{ ciclo() }})</h2>
            <p class="text-2xl font-bold text-slate-900 mt-1">
              {{ montoUsdt() }} <span class="text-sm font-normal text-stone-500">USDT / USDC</span>
            </p>
            <p *ngIf="ciclo() === 'anual'" class="text-xs font-semibold text-teal-700 mt-0.5">✨ Incluye 7% de descuento anual aplicado</p>
          </div>

          <!-- Instrucciones de Pago Binance Pay -->
          <div class="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-2">
            <h3 class="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
              <app-icon nombre="coin" clase="w-4 h-4 text-amber-600" /> Pago exclusivo por Binance Pay
            </h3>
            <p class="text-xs text-stone-600">Transfiere exactamente el monto indicado arriba mediante Binance Pay utilizando los siguientes datos:</p>
            <div class="bg-white border border-amber-300 rounded-lg p-3 text-xs font-mono text-slate-800 select-all space-y-1">
              <div>Binance Pay ID / Correo: <strong>costurapronta&#64;gmail.com</strong></div>
              <div class="text-[11px] text-amber-800">Moneda sugerida: USDT o USDC (Red Binance Pay - Sin comisiones)</div>
            </div>
          </div>

          <!-- Formulario de Validación -->
          <div class="space-y-4">
            
            <!-- Campo oculto o fijo que indica Binance -->
            <input type="hidden" [(ngModel)]="metodoPago" />

            <!-- Código de Transacción / TXID de Binance -->
            <div>
              <label class="block text-xs font-semibold text-stone-700 mb-1">
                ID de Orden / Hash de Transacción (TXID) de Binance
              </label>
              <input type="text" [(ngModel)]="codigoOperacion" placeholder="Ej: 98412039485 o Hash alfanumérico..."
                     class="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white focus:outline-teal-600 font-mono" />
              <p class="text-[10px] text-stone-500 mt-1">Ingresa el ID de la orden de tu pago en Binance para verificarlo de inmediato.</p>
            </div>

            <div>
              <label class="block text-xs font-semibold text-stone-700 mb-1">Subir Captura del Comprobante de Binance (Imagen o PDF)</label>
              <input type="file" (change)="onFileSelected($event)" accept="image/*,application/pdf"
                     class="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-50 file:text-amber-800 hover:file:bg-amber-100" />
            </div>

            <div *ngIf="error()" class="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              {{ error() }}
            </div>

            <button type="button" (click)="enviarComprobante()" [disabled]="cargando()"
                    class="w-full py-3.5 bg-slate-900 hover:bg-slate-800 disabled:bg-stone-300 text-white font-semibold text-xs rounded-xl transition shadow-sm">
              {{ cargando() ? 'Enviando solicitud...' : 'Confirmar y Enviar Pago de ' + montoUsdt() + ' USDT' }}
            </button>
          </div>

        </div>
      </div>
    </div>
  `
})
export class CheckoutSuscripcionComponent implements OnInit {
  planId = signal('');
  ciclo = signal('mensual');
  montoUsdt = signal('3.90'); // Monto calculado en USDT
  metodoPago = 'binance';
  codigoOperacion = '';
  archivoSeleccionado: File | null = null;
  cargando = signal(false);
  error = signal('');

  constructor(private route: ActivatedRoute, private router: Router, private supabaseService: SupabaseService) {}

  private get db() { return this.supabaseService.supabase; }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const plan = params['plan'] || 'basico';
      const cicloActual = params['ciclo'] || 'mensual';
      
      this.planId.set(plan);
      this.ciclo.set(cicloActual);

      // Calcular tarifa fija en USDT según el plan y ciclo con el 7% de descuento anual
      this.montoUsdt.set(this.calcularMontoUsdt(plan, cicloActual));
    });
  }

  calcularMontoUsdt(plan: string, ciclo: string): string {
    // Tarifas base mensuales en USDT (ajustadas a tus montos de referencia)
    let baseMensual = 3.90;
    
    if (plan.includes('taller') || plan.includes('elite')) {
      baseMensual = 19.90; // O el equivalente superior que manejes
    } else if (plan.includes('pro') || plan.includes('operario')) {
      baseMensual = 7.90;
    }

    if (ciclo === 'anual') {
      // 12 meses con 7% de descuento (precio * 12 * 0.93)
      const totalAnual = baseMensual * 12 * 0.93;
      return totalAnual.toFixed(2); // Retorna número con dos decimales limpios (ej: "43.52")
    }

    return baseMensual.toFixed(2);
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.archivoSeleccionado = file;
    }
  }

  async enviarComprobante() {
    this.error.set('');
    
    if (!this.codigoOperacion.trim()) {
      this.error.set('Por favor ingresa el ID de transacción o Hash (TXID) de Binance.');
      return;
    }

    this.cargando.set(true);

    try {
      const { data: { user } } = await this.db.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado.');

      let comprobanteUrl = '';

      if (this.archivoSeleccionado) {
        const fileName = `${user.id}_${Date.now()}_${this.archivoSeleccionado.name}`;
        const { error: uploadError } = await this.db.storage
          .from('comprobantes')
          .upload(fileName, this.archivoSeleccionado);

        if (!uploadError) {
          const { data: publicUrlData } = this.db.storage.from('comprobantes').getPublicUrl(fileName);
          comprobanteUrl = publicUrlData.publicUrl;
        }
      }

      const dias = this.ciclo() === 'anual' ? 365 : 30;
      const expiraEn = new Date();
      expiraEn.setDate(expiraEn.getDate() + dias);

      // Registrar la suscripción pendiente con el TXID de Binance
      const { error: insertError } = await this.db.from('suscripciones').insert([{
        perfil_id: user.id,
        plan_id: this.planId(),
        ciclo: this.ciclo(),
        estado: 'Pendiente',
        metodo_pago: 'binance',
        referencia_pago: this.codigoOperacion,
        comprobante_url: comprobanteUrl,
        expira_el: expiraEn.toISOString()
      }]);

      if (insertError) throw new Error(insertError.message);

      alert('¡Pago con Binance registrado con éxito! Tu suscripción se activará en cuanto verifiquemos el TXID.');
      this.router.navigate(['/planes']);

    } catch (e: any) {
      this.error.set(e.message || 'Ocurrió un error al registrar el pago.');
    } finally {
      this.cargando.set(false);
    }
  }
}