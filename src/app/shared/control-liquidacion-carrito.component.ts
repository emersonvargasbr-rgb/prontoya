import { Component, Input, OnChanges, OnInit, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../core/services/supabase.service';
import { mensajeAmigable, moneda } from '../core/utils/helpers';
import { IconComponent } from './components/icon.component';
import { Aviso, ToastComponent } from './components/toast.component';

interface ItemLiquidacion {
  id: string;
  tabla: 'sub_cortes' | 'asignaciones_funcionarios';
  descripcion_corte: string;
  cantidad_piezas: number;
  monto_total: number;
  seleccionado: boolean;
  estado_pago: string;
}

interface ValeActivo {
  id: string;
  monto: number;
  motivo: string;
  fecha: string;
  seleccionado: boolean;
}

@Component({
  selector: 'app-control-liquidacion-carrito',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ToastComponent],
  template: `
    <div class="bg-white rounded-3xl border border-stone-200 p-6 space-y-6 shadow-sm">
      <app-toast [aviso]="aviso()" />

      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 class="font-bold text-slate-900 text-base">Caja, Vales y Liquidación por Operario</h3>
          <p class="text-xs text-stone-500">Emite adelantos, gestiona vales y procesa el pago neto.</p>
        </div>

        <select [(ngModel)]="funcionarioSeleccionadoId" (change)="cargarDatosOperario()"
                class="border border-stone-300 rounded-xl px-3 py-2 text-xs font-semibold bg-white focus:outline-teal-600">
          <option value="" disabled>Seleccionar operario...</option>
          <option *ngFor="let op of equipo" [value]="op.funcionario?.id">{{ op.funcionario?.nombre_completo }}</option>
        </select>
      </div>

      <div *ngIf="!funcionarioSeleccionadoId" class="text-center py-12 border-2 border-dashed border-stone-200 rounded-2xl text-stone-400 text-xs">
        Selecciona un operario del equipo para gestionar sus vales y liquidaciones.
      </div>

      <div *ngIf="funcionarioSeleccionadoId" class="space-y-6">

        <!-- Formulario para otorgar un Vale/Adelanto -->
        <div class="bg-amber-50/60 border border-amber-200/60 p-4 rounded-2xl space-y-3">
          <h4 class="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
            <app-icon nombre="coin" clase="w-4 h-4" /> Registrar nuevo vale o adelanto
          </h4>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input [(ngModel)]="nuevoVale.monto" type="number" step="0.01" min="0" placeholder="Monto (R$)"
                   class="border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white focus:outline-teal-600">
            <input [(ngModel)]="nuevoVale.motivo" type="text" placeholder="Motivo (Ej: Adelanto pasajes / mercadería)"
                   class="border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white focus:outline-teal-600 sm:col-span-2">
          </div>
          <div class="flex justify-end">
            <button type="button" (click)="guardarVale()" [disabled]="procesando()"
                    class="bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-sm">
              Emitir Vale al Operario
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <!-- COLUMNA IZQUIERDA: Cortes / Lotes Terminados -->
          <div class="space-y-3">
            <div class="flex justify-between items-center">
              <h4 class="text-xs font-bold uppercase tracking-wider text-stone-500">1. Cortes Terminados / Por Cobrar</h4>
              <button type="button" (click)="toggleTodosCortes()" class="text-xs font-semibold text-teal-700 hover:underline">
                {{ todosCortesSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos' }}
              </button>
            </div>

            <div class="space-y-2 max-h-60 overflow-y-auto pr-1">
              <div *ngFor="let corte of cortes" class="flex items-center gap-3 p-3 rounded-2xl border border-stone-100 bg-stone-50/50 hover:bg-stone-50 transition">
                <input type="checkbox" [(ngModel)]="corte.seleccionado" class="w-4 h-4 text-teal-600 rounded border-stone-300 focus:ring-teal-500">
                <div class="min-w-0 flex-1">
                  <p class="text-xs font-bold text-slate-900 truncate">{{ corte.descripcion_corte }}</p>
                  <p class="text-[11px] text-stone-500">{{ corte.cantidad_piezas | number }} pzas</p>
                </div>
                <span class="text-xs font-bold text-teal-800">{{ moneda(corte.monto_total) }}</span>
              </div>
              <p *ngIf="cortes.length === 0" class="text-xs text-stone-400 py-4 text-center">No hay cortes terminados pendientes de pago.</p>
            </div>
          </div>

          <!-- COLUMNA DERECHA: Vales Activos a Descontar -->
          <div class="space-y-3">
            <div class="flex justify-between items-center">
              <h4 class="text-xs font-bold uppercase tracking-wider text-stone-500">2. Vales Activos a Descontar</h4>
              <button type="button" (click)="toggleTodosVales()" class="text-xs font-semibold text-rose-600 hover:underline">
                {{ todosValesSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos' }}
              </button>
            </div>

            <div class="space-y-2 max-h-60 overflow-y-auto pr-1">
              <div *ngFor="let vale of vales" class="flex items-center gap-3 p-3 rounded-2xl border border-rose-100 bg-rose-50/30 hover:bg-rose-50/60 transition">
                <input type="checkbox" [(ngModel)]="vale.seleccionado" class="w-4 h-4 text-rose-600 rounded border-stone-300 focus:ring-rose-500">

                <div class="min-w-0 flex-1">
                  <p class="text-xs font-bold text-slate-900 truncate">{{ vale.motivo }}</p>
                  <p class="text-[11px] text-stone-500">Fecha: {{ vale.fecha | date:'dd/MM/yyyy' }}</p>
                </div>

                <span class="text-xs font-bold text-rose-700">- {{ moneda(vale.monto) }}</span>

                <button type="button" (click)="eliminarVale(vale.id)" title="Eliminar vale" aria-label="Eliminar vale"
                        class="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-100/60 rounded-lg transition">
                  <app-icon nombre="trash" clase="w-4 h-4" />
                </button>
              </div>

              <p *ngIf="vales.length === 0" class="text-xs text-stone-400 py-4 text-center">No hay vales pendientes para este operario.</p>
            </div>
          </div>

        </div>

        <!-- RESUMEN INFERIOR -->
        <div class="border-t border-stone-100 pt-5 space-y-3 bg-stone-50 p-5 rounded-2xl">
          <div class="flex justify-between text-xs text-stone-600">
            <span>Subtotal cortes seleccionados:</span>
            <span class="font-semibold text-slate-900">{{ moneda(subtotalCortes) }}</span>
          </div>
          <div class="flex justify-between text-xs text-rose-600">
            <span>Total vales a descontar:</span>
            <span class="font-semibold">- {{ moneda(totalValesSeleccionados) }}</span>
          </div>
          <div class="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-stone-200">
            <span>Total Neto a Pagar en Mano:</span>
            <span class="text-teal-800 text-lg">{{ moneda(totalNetoAPagar) }}</span>
          </div>

          <button type="button" [disabled]="(subtotalCortes === 0 && totalValesSeleccionados === 0) || procesando()"
                  (click)="procesarLiquidacion()"
                  class="w-full mt-3 py-3.5 bg-slate-900 hover:bg-slate-800 disabled:bg-stone-300 text-white font-semibold text-xs rounded-2xl transition shadow-sm">
            {{ procesando() ? 'Procesando...' : 'Procesar Liquidación y Marcar como Pagado' }}
          </button>
        </div>

      </div>
    </div>
  `
})
export class ControlLiquidacionCarritoComponent implements OnInit, OnChanges {
  readonly moneda = moneda;

  @Input() oficinaId = '';
  @Input() equipo: any[] = [];

  funcionarioSeleccionadoId = '';
  cortes: ItemLiquidacion[] = [];
  vales: ValeActivo[] = [];
  procesando = signal(false);
  aviso = signal<Aviso | null>(null);

  nuevoVale = { monto: 0, motivo: '' };

  constructor(private supabase: SupabaseService) {}

  ngOnInit() {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['equipo'] && this.funcionarioSeleccionadoId) {
      const sigueEnEquipo = (this.equipo ?? []).some(
        op => (op.funcionario?.id ?? op.funcionario_id) === this.funcionarioSeleccionadoId
      );
      if (!sigueEnEquipo) {
        this.funcionarioSeleccionadoId = '';
        this.cortes = [];
        this.vales = [];
      }
    }
  }

  async cargarDatosOperario() {
    if (!this.funcionarioSeleccionadoId) return;

    try {
      const [subRes, asigRes, valesRes] = await Promise.all([
        this.supabase.supabase
          .from('sub_cortes')
          .select('id, operacion_maquina, cantidad_piezas, monto_total, monto_neto, estado_pago')
          .eq('empleador_id', this.oficinaId)
          .eq('funcionario_id', this.funcionarioSeleccionadoId)
          .eq('estado', 'Terminado')
          .neq('estado_pago', 'Pagado'),
        this.supabase.supabase
          .from('asignaciones_funcionarios')
          .select('id, descripcion_corte, operacion_maquina, cantidad_piezas, monto_total, monto_neto')
          .eq('empleador_id', this.oficinaId)
          .eq('funcionario_id', this.funcionarioSeleccionadoId)
          .eq('estado', 'Terminado'),
        this.supabase.supabase
          .from('vales_adelantos')
          .select('id, monto, motivo, fecha')
          .eq('empleador_id', this.oficinaId)
          .eq('funcionario_id', this.funcionarioSeleccionadoId)
          .eq('estado', 'Pendiente'),
      ]);

      const listaCortes: ItemLiquidacion[] = [
        ...(subRes.data ?? []).map((c: any) => ({
          id: c.id,
          tabla: 'sub_cortes' as const,
          descripcion_corte: c.operacion_maquina || 'Sub-corte de confección',
          cantidad_piezas: Number(c.cantidad_piezas || 0),
          monto_total: Number(c.monto_neto ?? c.monto_total ?? 0),
          seleccionado: true,
          estado_pago: c.estado_pago || 'Pendiente',
        })),
        ...(asigRes.data ?? []).map((a: any) => ({
          id: a.id,
          tabla: 'asignaciones_funcionarios' as const,
          descripcion_corte: a.descripcion_corte || a.operacion_maquina || 'Corte asignado',
          cantidad_piezas: Number(a.cantidad_piezas || 0),
          monto_total: Number(a.monto_neto ?? a.monto_total ?? 0),
          seleccionado: true,
          estado_pago: 'Pendiente',
        })),
      ];
      this.cortes = listaCortes;

      this.vales = (valesRes.data ?? []).map((v: any) => ({
        id: v.id,
        monto: Number(v.monto || 0),
        motivo: v.motivo,
        fecha: v.fecha,
        seleccionado: true,
      }));
    } catch (e: any) {
      console.error('Error cargando datos de liquidación:', e);
      this.notificar(mensajeAmigable(e, 'No se pudieron cargar los datos del operario.'), 'error');
    }
  }

  async guardarVale() {
    if (!this.oficinaId || !this.funcionarioSeleccionadoId || this.nuevoVale.monto <= 0 || !this.nuevoVale.motivo.trim()) {
      this.notificar('Completa operario, monto mayor a cero y motivo.', 'error');
      return;
    }

    this.procesando.set(true);
    try {
      const payload = {
        empleador_id: this.oficinaId,
        funcionario_id: this.funcionarioSeleccionadoId,
        monto: Number(this.nuevoVale.monto),
        motivo: this.nuevoVale.motivo.trim(),
        estado: 'Pendiente',
        fecha: new Date().toISOString().split('T')[0],
      };

      const { error } = await this.supabase.supabase.from('vales_adelantos').insert([payload]);
      if (error) throw error;

      this.notificar('Vale registrado con éxito.');
      this.nuevoVale = { monto: 0, motivo: '' };
      await this.cargarDatosOperario();
    } catch (e: any) {
      this.notificar(mensajeAmigable(e, 'No pudimos registrar el vale.'), 'error');
    } finally {
      this.procesando.set(false);
    }
  }

  async eliminarVale(valeId: string) {
    if (!confirm('¿Estás seguro de eliminar este vale?')) return;
    try {
      const { error } = await this.supabase.supabase
        .from('vales_adelantos')
        .delete()
        .eq('id', valeId);
      if (error) throw error;
      this.notificar('Vale eliminado correctamente.');
      await this.cargarDatosOperario();
    } catch (e: any) {
      this.notificar(mensajeAmigable(e, 'No se pudo eliminar el vale.'), 'error');
    }
  }

  get todosCortesSeleccionados() {
    return this.cortes.length > 0 && this.cortes.every(c => c.seleccionado);
  }

  toggleTodosCortes() {
    const estado = !this.todosCortesSeleccionados;
    this.cortes.forEach(c => c.seleccionado = estado);
  }

  get todosValesSeleccionados() {
    return this.vales.length > 0 && this.vales.every(v => v.seleccionado);
  }

  toggleTodosVales() {
    const estado = !this.todosValesSeleccionados;
    this.vales.forEach(v => v.seleccionado = estado);
  }

  get subtotalCortes() {
    return this.cortes.filter(c => c.seleccionado).reduce((acc, c) => acc + c.monto_total, 0);
  }

  get totalValesSeleccionados() {
    return this.vales.filter(v => v.seleccionado).reduce((acc, v) => acc + v.monto, 0);
  }

  get totalNetoAPagar() {
    const neto = this.subtotalCortes - this.totalValesSeleccionados;
    return neto > 0 ? neto : 0;
  }

  async procesarLiquidacion() {
    if (!confirm(`¿Confirmas procesar la liquidación por un neto de ${moneda(this.totalNetoAPagar)}?`)) return;

    this.procesando.set(true);
    try {
      const idsVales = this.vales.filter(v => v.seleccionado).map(v => v.id);
      const idsSubCortes = this.cortes.filter(c => c.seleccionado && c.tabla === 'sub_cortes').map(c => c.id);
      const asigSel = this.cortes.filter(c => c.seleccionado && c.tabla === 'asignaciones_funcionarios');

      if (idsVales.length > 0) {
        const { error } = await this.supabase.supabase
          .from('vales_adelantos')
          .update({ estado: 'Descontado' })
          .in('id', idsVales);
        if (error) throw error;
      }

      if (idsSubCortes.length > 0) {
        const { error } = await this.supabase.supabase
          .from('sub_cortes')
          .update({ estado_pago: 'Pagado' })
          .in('id', idsSubCortes);
        if (error) throw error;
      }

      if (asigSel.length > 0) {
        const ahora = new Date().toISOString();
        const { error } = await this.supabase.supabase
          .from('asignaciones_funcionarios')
          .update({ estado: 'Cerrado', fecha_cierre: ahora })
          .in('id', asigSel.map(a => a.id));
        if (error) throw error;
      }

      this.notificar('Liquidación procesada con éxito.');
      await this.cargarDatosOperario();
    } catch (e: any) {
      this.notificar(mensajeAmigable(e, 'No se pudo procesar la liquidación.'), 'error');
    } finally {
      this.procesando.set(false);
    }
  }

  private notificar(texto: string, tipo: 'ok' | 'error' = 'ok') {
    this.aviso.set({ texto, tipo });
    setTimeout(() => this.aviso.set(null), 3500);
  }
}
