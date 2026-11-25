import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Aviso, ToastComponent } from './toast.component';
import { IconComponent } from './icon.component';
import { SupabaseService } from '../../core/services/supabase.service';
import { mensajeAmigable, moneda } from '../../core/utils/helpers';

interface CorteManual {
  id?: string;
  usuario_id: string;
  descripcion: string;
  cantidad_piezas: number;
  monto_total: number;
  fecha: string;
  created_at?: string;
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
        <button type="button" (click)="abrirModal()" class="inline-flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
          <app-icon nombre="plus" clase="w-4 h-4" /> Registrar Corte
        </button>
      </div>

      <!-- Resumen rápido -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div class="bg-teal-50 border border-teal-100 p-4 rounded-lg">
          <span class="text-xs font-semibold text-teal-600 uppercase">Total Prendas Externas</span>
          <p class="text-2xl font-bold text-teal-900">{{ totalPrendas | number }} un.</p>
        </div>
        <div class="bg-amber-50 border border-amber-100 p-4 rounded-lg">
          <span class="text-xs font-semibold text-amber-600 uppercase">Total Ingresos Externos</span>
          <p class="text-2xl font-bold text-amber-900">{{ moneda(totalIngresos) }}</p>
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
              <th class="p-3">Descripción / Cliente</th>
              <th class="p-3 text-center">Piezas</th>
              <th class="p-3 text-right">Total (R$)</th>
              <th class="p-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-100">
            <tr *ngFor="let item of lista" class="hover:bg-stone-50/50">
              <td class="p-3 whitespace-nowrap">{{ item.fecha | date:'dd/MM/yyyy' }}</td>
              <td class="p-3 font-medium text-slate-900">{{ item.descripcion }}</td>
              <td class="p-3 text-center">{{ item.cantidad_piezas | number }}</td>
              <td class="p-3 text-right font-bold text-teal-700">{{ moneda(item.monto_total) }}</td>
              <td class="p-3 text-center">
                <button type="button" (click)="eliminar(item.id!)" aria-label="Eliminar corte" class="text-rose-500 hover:text-rose-700 p-1">
                  <app-icon nombre="trash" clase="w-4 h-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Modal simple de registro -->
      <div *ngIf="modalAbierto" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
          <div class="flex justify-between items-center">
            <h3 class="font-bold text-slate-800 text-lg">Nuevo Corte Manual</h3>
            <button type="button" (click)="modalAbierto = false" aria-label="Cerrar" class="text-stone-400 hover:text-slate-600">
              <app-icon nombre="x" clase="w-5 h-5" />
            </button>
          </div>

          <div class="space-y-3">
            <div>
              <label class="block text-xs font-semibold text-stone-600 mb-1">Cliente / Tienda (opcional)</label>
              <input [(ngModel)]="form.cliente" type="text" placeholder="Ej: Confecções Miller" class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-teal-600" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-stone-600 mb-1">Descripción de la prenda</label>
              <input [(ngModel)]="form.descripcion" type="text" placeholder="Ej: Remeras manga larga" class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-teal-600" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-stone-600 mb-1">Piezas</label>
                <input [(ngModel)]="form.cantidad_piezas" type="number" min="1" class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-teal-600" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-stone-600 mb-1">Precio Unitario (R$)</label>
                <input [(ngModel)]="form.precio_unitario" type="number" step="0.01" min="0" class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-teal-600" />
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold text-stone-600 mb-1">Fecha</label>
              <input [(ngModel)]="form.fecha" type="date" class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-teal-600" />
            </div>
            <p class="text-xs text-slate-600">
              Total calculado: <strong class="text-teal-800">{{ moneda((Number(form.cantidad_piezas) || 0) * (Number(form.precio_unitario) || 0)) }}</strong>
            </p>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button type="button" (click)="modalAbierto = false" class="px-4 py-2 border border-stone-300 rounded-lg text-sm text-stone-600 hover:bg-stone-50">Cancelar</button>
            <button type="button" (click)="guardarCorte()" [disabled]="guardando()" class="px-4 py-2 bg-teal-700 text-white rounded-lg text-sm font-semibold hover:bg-teal-800 disabled:opacity-50">
              {{ guardando() ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>

      <app-toast [aviso]="aviso()" />
    </div>
  `
})
export class CortesManualesComponent implements OnInit, OnChanges {
  readonly moneda = moneda;
  readonly Number = Number;

  @Input() oficinaId = '';
  @Output() totalCambio = new EventEmitter<number>();

  lista: CorteManual[] = [];
  cargando = signal(true);
  guardando = signal(false);
  modalAbierto = false;
  aviso = signal<Aviso | null>(null);

  form = { cliente: '', descripcion: '', cantidad_piezas: 1, precio_unitario: 0, fecha: new Date().toISOString().split('T')[0] };

  constructor(private supabase: SupabaseService) {}

  async ngOnInit() {
    await this.asegurarYCargar();
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (changes['oficinaId'] && !changes['oficinaId'].firstChange) {
      await this.asegurarYCargar();
    }
  }

  private async asegurarYCargar() {
    if (!this.oficinaId) {
      const { data: { user } } = await this.supabase.supabase.auth.getUser();
      if (user) this.oficinaId = user.id;
    }
    if (this.oficinaId) {
      await this.cargarCortes();
    } else {
      this.cargando.set(false);
    }
  }

  get totalPrendas() { return this.lista.reduce((acc, item) => acc + Number(item.cantidad_piezas || 0), 0); }
  get totalIngresos() { return this.lista.reduce((acc, item) => acc + Number(item.monto_total || 0), 0); }

  async cargarCortes() {
    if (!this.oficinaId) { this.cargando.set(false); return; }
    this.cargando.set(true);
    try {
      const { data, error } = await this.supabase.supabase
        .from('cortes_manuales')
        .select('id, usuario_id, descripcion, cantidad_piezas, monto_total, fecha, created_at')
        .eq('usuario_id', this.oficinaId)
        .order('fecha', { ascending: false });

      if (error) throw error;
      this.lista = data ?? [];
      this.totalCambio.emit(this.totalIngresos);
    } catch (e: any) {
      console.error('Error cargando cortes manuales:', e);
      this.notificar(mensajeAmigable(e, 'No se pudieron cargar los cortes manuales.'), 'error');
    } finally {
      this.cargando.set(false);
    }
  }

  abrirModal() {
    this.form = { cliente: '', descripcion: '', cantidad_piezas: 1, precio_unitario: 0, fecha: new Date().toISOString().split('T')[0] };
    this.modalAbierto = true;
  }

  async guardarCorte() {
    const piezas = Number(this.form.cantidad_piezas);
    const precioUnit = Number(this.form.precio_unitario);
    const desc = this.form.descripcion.trim();
    const cliente = this.form.cliente.trim();

    if (!this.oficinaId) {
      this.notificar('No pudimos identificar tu sesión. Recarga la página.', 'error');
      return;
    }
    if (!desc && !cliente) {
      this.notificar('Ingresa una descripción o cliente para el corte.', 'error');
      return;
    }
    if (!(piezas > 0) || !(precioUnit > 0)) {
      this.notificar('Ingresa piezas y precio unitario mayores a cero.', 'error');
      return;
    }

    const descripcionFinal = cliente ? (desc ? `${cliente} · ${desc}` : cliente) : desc;
    const montoTotal = +(piezas * precioUnit).toFixed(2);

    this.guardando.set(true);
    try {
      const { error } = await this.supabase.supabase.from('cortes_manuales').insert([{
        usuario_id: this.oficinaId,
        descripcion: descripcionFinal,
        cantidad_piezas: piezas,
        monto_total: montoTotal,
        fecha: this.form.fecha,
      }]);
      if (error) throw error;

      this.notificar('Corte manual registrado con éxito.');
      this.modalAbierto = false;
      await this.cargarCortes();
    } catch (e: any) {
      console.error('Error guardando corte manual:', e);
      this.notificar(mensajeAmigable(e, 'No pudimos guardar el corte manual.'), 'error');
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminar(id: string) {
    if (!confirm('¿Estás seguro de eliminar este registro?')) return;
    try {
      const { error } = await this.supabase.supabase.from('cortes_manuales').delete().eq('id', id);
      if (error) throw error;
      this.notificar('Registro eliminado.');
      this.lista = this.lista.filter(x => x.id !== id);
      this.totalCambio.emit(this.totalIngresos);
    } catch (e: any) {
      this.notificar(mensajeAmigable(e, 'No se pudo eliminar el registro.'), 'error');
    }
  }

  notificar(texto: string, tipo: 'ok' | 'error' = 'ok') {
    this.aviso.set({ texto, tipo });
    setTimeout(() => this.aviso.set(null), 3500);
  }
}