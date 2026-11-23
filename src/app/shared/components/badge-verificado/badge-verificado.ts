import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon.component';
import { PLAN_ESTILO, PLANES, PlanId, planVigente } from '../../../core/utils/planes';

/**
 * Sello del perfil. Muestra lo que realmente está comprobado, sin exagerar:
 *
 *   plan vigente + documento verificado  ->  sello de color según el plan ("Verificado Plus")
 *   sólo documento verificado            ->  marca gris discreta ("CPF validado" / "CNPJ verificado")
 *   nada                                 ->  no pinta nada
 *
 * Uso:  <app-badge-verificado [perfil]="perfil()" />
 *       <app-badge-verificado [perfil]="p" [mostrarTexto]="true" />
 *
 * Reemplaza a los archivos .html, .css y .spec anteriores de badge-verificado: bórralos.
 */
@Component({
  selector: 'app-badge-verificado',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <ng-container *ngIf="estado() as e">
      <span *ngIf="e.tipo === 'plan'" class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
            [ngClass]="e.fondo" [attr.title]="e.titulo">
        <app-icon nombre="verified" clase="w-3.5 h-3.5" />
        <span *ngIf="mostrarTexto">{{ e.texto }}</span>
        <span *ngIf="!mostrarTexto" class="sr-only">{{ e.texto }}</span>
      </span>

      <span *ngIf="e.tipo === 'documento'" class="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500" [attr.title]="e.titulo">
        <app-icon nombre="check" clase="w-3.5 h-3.5" />
        <span *ngIf="mostrarTexto">{{ e.texto }}</span>
        <span *ngIf="!mostrarTexto" class="sr-only">{{ e.texto }}</span>
      </span>
    </ng-container>
  `,
})
export class BadgeVerificadoComponent {
  @Input() mostrarTexto = false;

  private perfilSig = signal<any>(null);
  @Input() set perfil(v: any) { this.perfilSig.set(v); }

  estado = computed(() => {
    const p = this.perfilSig();
    if (!p) return null;

    const plan: PlanId | null = planVigente(p.plan, p.plan_vigente_hasta);
    if (plan) {
      const nombre = PLANES.find(x => x.id === plan)?.nombre ?? plan;
      return {
        tipo: 'plan' as const,
        fondo: PLAN_ESTILO[plan].fondo,
        texto: `Verificado ${nombre}`,
        titulo: `Cuenta verificada, plan ${nombre}`,
      };
    }

    if (!p.documento_verificado) return null;   // sin plan y sin documento verificado: sin sello
    const cpf = p.documento_tipo === 'cpf';
    return {
      tipo: 'documento' as const,
      fondo: '',
      // un CPF sólo se valida (dígitos y unicidad); no afirmamos que sea la identidad de la persona
      texto: cpf ? 'CPF validado' : 'CNPJ verificado',
      titulo: cpf ? 'CPF válido y único en la plataforma' : 'CNPJ activo en la Receita Federal',
    };
  });
}