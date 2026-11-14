import { Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Aviso, ToastComponent } from './components/toast.component';
import { IconComponent } from './components/icon.component';
import { SupabaseService } from '../core/services/supabase.service';

interface Vale {
  id?: string;
  usuario_id: string;
  monto: number;
  motivo: string;
  fecha: string;
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
        <button (click)="abrirModalVale()" class="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
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
          <button (click)="guardarPeriodo()" class="w-full bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold py-2 rounded-lg transition">Actualizar Ciclo</button>
        </div>
      </div>

      <!-- Tarjetas de Resumen Financiero -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="bg-teal-50 border border-teal-100 p-4 rounded-xl">
          <span class="text-xs font-semibold text-teal-600 uppercase">Total Producido (Ganancias)</span>
          <p class="text-2xl font-bold text-teal-900">R$ {{ totalGanado.toFixed(2) }}</p>
        </div>
        <div class="bg-rose-50 border border-rose-100 p-4 rounded-xl">
          <span class="text-xs font-semibold text-rose-600 uppercase">Total Vales Retirados</span>
          <p class="text-2xl font-bold text-rose-900">- R$ {{ totalVales.toFixed(2) }}</p>
        </div>
        <div class="bg-slate-900 text-white p-4 rounded-xl shadow-sm">
          <span class="text-xs font-semibold text-slate-400 uppercase">Líquido a Cobrar (Neto)</span>
          <p class="text-2xl font-bold text-teal-400">R$ {{ (totalGanado - totalVales).toFixed(2) }}</p>
        </div>
      </div>

      <!-- Historial de Vales -->
      <div>
        <h3 class="font-semibold text-slate-800 mb-3 text-sm">Historial de Adelantos (Vales) en este período</h3>
        <div *ngIf="listaVales.length === 0" class="text-center py-6 border border-dashed border-stone-200 rounded-lg text-stone-400 text-sm">
          No hay vales registrados en este ciclo.
        </div>
        <div *ngIf="listaVales.length > 0" class="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden">
          <div *ngFor="let vale of listaVales" class="p-3 flex justify-between items-center hover:bg-stone-50">
            <div>
              <p class="font-semibold text-slate-800 text-sm">R$ {{ vale.monto.toFixed(2) }} <span class="text-stone-500 font-normal text-xs ml-2">({{ vale.motivo }})</span></p>
              <span class="text-xs text-stone-400">Fecha: {{ vale.fecha }}</span>
            </div>
            <button (click)="eliminarVale(vale.id!)" class="text-rose-500 hover:text-rose-700 text-xs font-semibold">Eliminar</button>
          </div>
        </div>
      </div>

      <!-- Modal Registrar Vale -->
      <div *ngIf="modalValeAbierto" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
          <div class="flex justify-between items-center">
            <h3 class="font-bold text-slate-800 text-base">Registrar Nuevo Vale</h3>
            <button (click)="modalValeAbierto = false" class="text-stone-400 hover:text-slate-600">✕</button>
          </div>
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-semibold text-stone-600 mb-1">Monto (R$)</label>
              <input [(ngModel)]="formVale.monto" type="number" step="0.01" class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-teal-600" />
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
            <button (click)="modalValeAbierto = false" class="px-4 py-2 border border-stone-300 rounded-lg text-sm text-stone-600">Cancelar</button>
            <button (click)="guardarVale()" class="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700">Guardar Vale</button>
          </div>
        </div>
      </div>

      <app-toast [aviso]="aviso()" />
    </div>
  `
})
export class ControlValesComponent implements OnInit {
  @Input() usuarioId = '';
  @Input() totalGanado = 0; // Recibe la suma de app + cortes manuales

  periodoInicio = '2026-08-08';
  periodoFin = '2026-09-08';
  listaVales: Vale[] = [];
  modalValeAbierto = false;
  aviso = signal<Aviso | null>(null);

  formVale = { monto: 0, motivo: '', fecha: new Date().toISOString().split('T')[0] };

  constructor(private supabase: SupabaseService) {}

  async ngOnInit() {
    if (this.usuarioId) await this.cargarVales();
  }

  get totalVales() {
    return this.listaVales.reduce((acc, v) => acc + Number(v.monto), 0);
  }

  async cargarVales() {
    const { data, error } = await this.supabase.supabase.from('vales_adelantos').select('*').eq('usuario_id', this.usuarioId);
    if (!error && data) this.listaVales = data;
  }

  abrirModalVale() {
    this.formVale = { monto: 0, motivo: '', fecha: new Date().toISOString().split('T')[0] };
    this.modalValeAbierto = true;
  }

  async guardarVale() {
    if (this.formVale.monto <= 0 || !this.formVale.motivo) {
      this.notificar('Ingresa un monto válido y un motivo.', 'error');
      return;
    }
    const payload = { usuario_id: this.usuarioId, ...this.formVale };
    const { error } = await this.supabase.supabase.from('vales_adelantos').insert([payload]);
    if (error) {
      this.notificar('Error al guardar el vale.', 'error');
      return;
    }
    this.notificar('Vale registrado correctamente.');
    this.modalValeAbierto = false;
    await this.cargarVales();
  }

  async eliminarVale(id: string) {
    if (!confirm('¿Eliminar este registro de vale?')) return;
    const { error } = await this.supabase.supabase.from('vales_adelantos').delete().eq('id', id);
    if (!error) {
      this.notificar('Vale eliminado.');
      this.listaVales = this.listaVales.filter(v => v.id !== id);
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