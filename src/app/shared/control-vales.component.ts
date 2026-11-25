import { Component, Input, OnChanges, OnInit, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Aviso, ToastComponent } from './components/toast.component';
import { IconComponent } from './components/icon.component';
import { SupabaseService } from '../core/services/supabase.service';
import { mensajeAmigable, moneda } from '../core/utils/helpers';

interface Vale {
  id?: string;
  empleador_id?: string | null;
  funcionario_id: string;
  monto: number;
  motivo: string;
  fecha: string;
  estado?: string;
}

@Component({
  selector: 'app-control-vales',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ToastComponent],
  template: `
    <div class="bg-white rounded-xl shadow-sm border border-stone-200 p-6 space-y-6">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 class="text-lg font-bold text-slate-800">Control de Vales y Liquidación</h2>
          <p class="text-sm text-stone-500">Administra adelantos y calcula el neto a cobrar según tu período de pago.</p>
        </div>
        <button type="button" (click)="abrirModalVale()" class="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
          <app-icon nombre="plus" clase="w-4 h-4" /> Registrar Vale / Adelanto
        </button>
      </div>

      <!-- Configuración del Período de Pago -->
      <div class="bg-stone-50 border border-stone-200 p-4 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        <div>
          <label class="block text-xs font-semibold text-stone-600 mb-1">Inicio del Período</label>
          <input [(ngModel)]="periodoInicio" type="date" class="w-full bg-white border border-stone-300 rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-stone-600 mb-1">Fin del Período (Pago)</label>
          <input [(ngModel)]="periodoFin" type="date" class="w-full bg-white border border-stone-300 rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div>
          <button type="button" (click)="guardarPeriodo()" class="w-full bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold py-2 rounded-lg transition">Actualizar Ciclo</button>
        </div>
      </div>

      <!-- Tarjetas de Resumen Financiero -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="bg-teal-50 border border-teal-100 p-4 rounded-xl">
          <span class="text-xs font-semibold text-teal-600 uppercase">Total Producido (Ganancias)</span>
          <p class="text-2xl font-bold text-teal-900">{{ moneda(totalGanado) }}</p>
        </div>
        <div class="bg-rose-50 border border-rose-100 p-4 rounded-xl">
          <span class="text-xs font-semibold text-rose-600 uppercase">Total Vales Retirados</span>
          <p class="text-2xl font-bold text-rose-900">- {{ moneda(totalVales) }}</p>
        </div>
        <div class="bg-slate-900 text-white p-4 rounded-xl shadow-sm">
          <span class="text-xs font-semibold text-slate-400 uppercase">Líquido a Cobrar (Neto)</span>
          <p class="text-2xl font-bold text-teal-400">{{ moneda(Math.max(0, totalGanado - totalVales)) }}</p>
        </div>
      </div>

      <!-- Historial de Vales -->
      <div>
        <h3 class="font-semibold text-slate-800 mb-3 text-sm">Historial de Adelantos (Vales) en este período</h3>
        <div *ngIf="cargando()" class="text-center py-6 text-stone-400 text-sm">Cargando vales...</div>
        <div *ngIf="!cargando() && valesFiltrados.length === 0" class="text-center py-6 border border-dashed border-stone-200 rounded-lg text-stone-400 text-sm">
          No hay vales registrados en este ciclo.
        </div>
        <div *ngIf="!cargando() && valesFiltrados.length > 0" class="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden">
          <div *ngFor="let vale of valesFiltrados" class="p-3 flex justify-between items-center hover:bg-stone-50">
            <div>
              <p class="font-semibold text-slate-800 text-sm">
                {{ moneda(vale.monto) }}
                <span class="text-stone-500 font-normal text-xs ml-2">({{ vale.motivo }})</span>
                <span *ngIf="vale.estado" class="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                      [ngClass]="vale.estado === 'Descontado' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-800'">{{ vale.estado }}</span>
              </p>
              <span class="text-xs text-stone-400">Fecha: {{ vale.fecha | date:'dd/MM/yyyy' }}</span>
            </div>
            <button type="button" (click)="eliminarVale(vale.id!)" class="text-rose-500 hover:text-rose-700 text-xs font-semibold">Eliminar</button>
          </div>
        </div>
      </div>

      <!-- Modal Registrar Vale -->
      <div *ngIf="modalValeAbierto" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div class="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
          <div class="flex justify-between items-center">
            <h3 class="font-bold text-slate-800 text-base">Registrar Nuevo Vale</h3>
            <button type="button" (click)="modalValeAbierto = false" aria-label="Cerrar" class="text-stone-400 hover:text-slate-600">
              <app-icon nombre="x" clase="w-5 h-5" />
            </button>
          </div>
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-semibold text-stone-600 mb-1">Monto (R$)</label>
              <input [(ngModel)]="formVale.monto" type="number" step="0.01" min="0" class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-teal-600" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-stone-600 mb-1">Motivo / Concepto</label>
              <input [(ngModel)]="formVale.motivo" type="text" placeholder="Ej: Adelanto para mercado" class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-teal-600" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-stone-600 mb-1">Fecha</label>
              <input [(ngModel)]="formVale.fecha" type="date" class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-teal-600" />
            </div>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" (click)="modalValeAbierto = false" class="px-4 py-2 border border-stone-300 rounded-lg text-sm text-stone-600">Cancelar</button>
            <button type="button" (click)="guardarVale()" [disabled]="guardando()" class="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50">
              {{ guardando() ? 'Guardando...' : 'Guardar Vale' }}
            </button>
          </div>
        </div>
      </div>

      <app-toast [aviso]="aviso()" />
    </div>
  `
})
export class ControlValesComponent implements OnInit, OnChanges {
  readonly moneda = moneda;
  readonly Math = Math;

  @Input() usuarioId = '';
  @Input() totalGanado = 0;

  periodoInicio: string;
  periodoFin: string;
  listaVales: Vale[] = [];
  cargando = signal(true);
  guardando = signal(false);
  modalValeAbierto = false;
  aviso = signal<Aviso | null>(null);

  formVale = { monto: 0, motivo: '', fecha: new Date().toISOString().split('T')[0] };

  constructor(private supabase: SupabaseService) {
    const hoy = new Date();
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    this.periodoInicio = inicio.toISOString().split('T')[0];
    this.periodoFin = hoy.toISOString().split('T')[0];
  }

  async ngOnInit() {
    await this.asegurarYCargar();
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (changes['usuarioId'] && !changes['usuarioId'].firstChange) {
      await this.asegurarYCargar();
    }
  }

  private async asegurarYCargar() {
    if (!this.usuarioId) {
      const { data: { user } } = await this.supabase.supabase.auth.getUser();
      if (user) this.usuarioId = user.id;
    }
    if (this.usuarioId) {
      await this.cargarVales();
    } else {
      this.cargando.set(false);
    }
  }

  get valesFiltrados(): Vale[] {
    return this.listaVales.filter(v => {
      if (this.periodoInicio && v.fecha < this.periodoInicio) return false;
      if (this.periodoFin && v.fecha > this.periodoFin) return false;
      return true;
    });
  }

  get totalVales() {
    return this.valesFiltrados.reduce((acc, v) => acc + Number(v.monto || 0), 0);
  }

  async cargarVales() {
    if (!this.usuarioId) { this.cargando.set(false); return; }
    this.cargando.set(true);
    try {
      const { data, error } = await this.supabase.supabase
        .from('vales_adelantos')
        .select('id, empleador_id, funcionario_id, monto, motivo, fecha, estado')
        .eq('funcionario_id', this.usuarioId)
        .order('fecha', { ascending: false });
      if (error) throw error;
      this.listaVales = data ?? [];
    } catch (e: any) {
      console.error('Error cargando vales:', e);
      this.notificar(mensajeAmigable(e, 'No se pudieron cargar los vales.'), 'error');
    } finally {
      this.cargando.set(false);
    }
  }

  abrirModalVale() {
    this.formVale = { monto: 0, motivo: '', fecha: new Date().toISOString().split('T')[0] };
    this.modalValeAbierto = true;
  }

  async guardarVale() {
    if (!this.usuarioId) {
      this.notificar('No pudimos identificar tu sesión.', 'error');
      return;
    }
    if (Number(this.formVale.monto) <= 0 || !this.formVale.motivo.trim()) {
      this.notificar('Ingresa un monto válido y un motivo.', 'error');
      return;
    }

    this.guardando.set(true);
    try {
      const payload = {
        empleador_id: this.usuarioId,
        funcionario_id: this.usuarioId,
        monto: Number(this.formVale.monto),
        motivo: this.formVale.motivo.trim(),
        fecha: this.formVale.fecha,
        estado: 'Pendiente',
      };
      const { error } = await this.supabase.supabase.from('vales_adelantos').insert([payload]);
      if (error) throw error;
      this.notificar('Vale registrado correctamente.');
      this.modalValeAbierto = false;
      await this.cargarVales();
    } catch (e: any) {
      this.notificar(mensajeAmigable(e, 'No pudimos guardar el vale.'), 'error');
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminarVale(id: string) {
    if (!confirm('¿Eliminar este registro de vale?')) return;
    try {
      const { error } = await this.supabase.supabase.from('vales_adelantos').delete().eq('id', id);
      if (error) throw error;
      this.notificar('Vale eliminado.');
      this.listaVales = this.listaVales.filter(v => v.id !== id);
    } catch (e: any) {
      this.notificar(mensajeAmigable(e, 'No se pudo eliminar el vale.'), 'error');
    }
  }

  guardarPeriodo() {
    this.notificar('Ciclo de liquidación actualizado.');
  }

  notificar(texto: string, tipo: 'ok' | 'error' = 'ok') {
    this.aviso.set({ texto, tipo });
    setTimeout(() => this.aviso.set(null), 3500);
  }
}
