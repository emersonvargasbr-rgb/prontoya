import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Aviso, ToastComponent } from './toast.component';
import { IconComponent } from './icon.component';
import { SupabaseService } from '../../core/services/supabase.service';


interface CorteManual {
  id?: string;
  usuario_id: string;
  cliente: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
  fecha: string;
}

@Component({
  selector: 'app-cortes-manuales',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ToastComponent],
  template: `
    <div class="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 class="text-lg font-bold text-slate-800">Cortes y Trabajos Manuales</h2>
          <p class="text-sm text-stone-500">Registra trabajos externos o por fuera de la plataforma para llevar un control unificado.</p>
        </div>
        <button (click)="abrirModal()" class="inline-flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
          <app-icon nombre="plus" clase="w-4 h-4" /> Registrar Corte
        </button>
      </div>

      <!-- Resumen rápido -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div class="bg-teal-50 border border-teal-100 p-4 rounded-lg">
          <span class="text-xs font-semibold text-teal-600 uppercase">Total Prendas Externas</span>
          <p class="text-2xl font-bold text-teal-900">{{ totalPrendas }} un.</p>
        </div>
        <div class="bg-amber-50 border border-amber-100 p-4 rounded-lg">
          <span class="text-xs font-semibold text-amber-600 uppercase">Total Ingresos Externos</span>
          <p class="text-2xl font-bold text-amber-900">R$ {{ totalIngresos.toFixed(2) }}</p>
        </div>
      </div>

      <!-- Listado -->
      <div *ngIf="cargando()" class="text-center py-8 text-stone-400">Cargando registros...</div>
      
      <div *ngIf="!cargando() && lista.length === 0" class="text-center py-8 border-2 border-dashed border-stone-200 rounded-xl">
        <p class="text-stone-500 text-sm">No hay cortes manuales registrados todavía.</p>
      </div>

      <div *ngIf="!cargando() && lista.length > 0" class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-700">
          <thead class="bg-stone-50 text-stone-500 uppercase text-xs">
            <tr>
              <th class="p-3">Fecha</th>
              <th class="p-3">Cliente / Taller</th>
              <th class="p-3">Descripción</th>
              <th class="p-3 text-center">Cantidad</th>
              <th class="p-3 text-right">Total (R$)</th>
              <th class="p-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-100">
            <tr *ngFor="let item of lista" class="hover:bg-stone-50/50">
              <td class="p-3 whitespace-nowrap">{{ item.fecha }}</td>
              <td class="p-3 font-semibold text-slate-900">{{ item.cliente }}</td>
              <td class="p-3 text-stone-600">{{ item.descripcion }}</td>
              <td class="p-3 text-center">{{ item.cantidad }}</td>
              <td class="p-3 text-right font-bold text-teal-700">R$ {{ item.total.toFixed(2) }}</td>
              <td class="p-3 text-center">
                <button (click)="eliminar(item.id!)" class="text-rose-500 hover:text-rose-700 p-1">
                  <app-icon nombre="trash" clase="w-4 h-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Modal simple de registro -->
      <div *ngIf="modalAbierto" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
          <div class="flex justify-between items-center">
            <h3 class="font-bold text-slate-800 text-lg">Nuevo Corte Manual</h3>
            <button (click)="modalAbierto = false" class="text-stone-400 hover:text-slate-600">✕</button>
          </div>

          <div class="space-y-3">
            <div>
              <label class="block text-xs font-semibold text-stone-600 mb-1">Cliente / Tienda</label>
              <input [(ngModel)]="form.cliente" type="text" placeholder="Ej: Confecções Miller" class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-teal-600" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-stone-600 mb-1">Descripción de la prenda</label>
              <input [(ngModel)]="form.descripcion" type="text" placeholder="Ej: Remeras manga larga" class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-teal-600" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-stone-600 mb-1">Cantidad</label>
                <input [(ngModel)]="form.cantidad" type="number" min="1" class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-teal-600" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-stone-600 mb-1">Precio Unitario (R$)</label>
                <input [(ngModel)]="form.precio_unitario" type="number" step="0.01" class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-teal-600" />
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold text-stone-600 mb-1">Fecha</label>
              <input [(ngModel)]="form.fecha" type="date" class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-teal-600" />
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button (click)="modalAbierto = false" class="px-4 py-2 border border-stone-300 rounded-lg text-sm text-stone-600 hover:bg-stone-50">Cancelar</button>
            <button (click)="guardarCorte()" class="px-4 py-2 bg-teal-700 text-white rounded-lg text-sm font-semibold hover:bg-teal-800">Guardar</button>
          </div>
        </div>
      </div>

      <app-toast [aviso]="aviso()" />
    </div>
  `
})
export class CortesManualesComponent implements OnInit {
  @Input() usuarioId = '';
  @Output() totalCambio = new EventEmitter<number>();
  
  lista: CorteManual[] = [];
  cargando = signal(true);
  modalAbierto = false;
  aviso = signal<Aviso | null>(null);

  form: any = { cliente: '', descripcion: '', cantidad: 1, precio_unitario: 0, fecha: new Date().toISOString().split('T')[0] };

  constructor(private supabase: SupabaseService) {}

  async ngOnInit() {
    if (this.usuarioId) await this.cargarCortes();
  }

  get totalPrendas() { return this.lista.reduce((acc, item) => acc + Number(item.cantidad), 0); }
  get totalIngresos() { return this.lista.reduce((acc, item) => acc + Number(item.total), 0); }

  async cargarCortes() {
    this.cargando.set(true);
    const { data, error } = await this.supabase.supabase.from('cortes_manuales').select('*').eq('usuario_id', this.usuarioId).order('fecha', { ascending: false });
    if (!error && data) {
      this.lista = data;
      this.totalCambio.emit(this.totalIngresos);
    }
    this.cargando.set(false);
  }

  abrirModal() {
    this.form = { cliente: '', descripcion: '', cantidad: 1, precio_unitario: 0, fecha: new Date().toISOString().split('T')[0] };
    this.modalAbierto = true;
  }

  async guardarCorte() {
    if (!this.form.cliente || this.form.cantidad <= 0 || this.form.precio_unitario <= 0) {
      this.notificar('Completa los campos correctamente.', 'error');
      return;
    }
    const total = Number(this.form.cantidad) * Number(this.form.precio_unitario);
    const payload = { usuario_id: this.usuarioId, ...this.form, total };

    const { error } = await this.supabase.supabase.from('cortes_manuales').insert([payload]);
    if (error) {
      this.notificar('Error al guardar el corte.', 'error');
      return;
    }

    this.notificar('Corte manual registrado con éxito.');
    this.modalAbierto = false;
    await this.cargarCortes();
  }

  async eliminar(id: string) {
    if (!confirm('¿Estás seguro de eliminar este registro?')) return;
    const { error } = await this.supabase.supabase.from('cortes_manuales').delete().eq('id', id);
    if (!error) {
      this.notificar('Registro eliminado.');
      this.lista = this.lista.filter(x => x.id !== id);
      this.totalCambio.emit(this.totalIngresos);
    }
  }

  notificar(texto: string, tipo: 'ok' | 'error' = 'ok') {
    this.aviso.set({ texto, tipo });
    setTimeout(() => this.aviso.set(null), 3500);
  }
}