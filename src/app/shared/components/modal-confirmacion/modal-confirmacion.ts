import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal-confirmacion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal-confirmacion.html'
})
export class ModalConfirmacionComponent {
  @Input() isOpen: boolean = false;
  @Input() titulo: string = '¿Estás seguro?';
  @Input() mensaje: string = 'Esta acción no se puede deshacer.';
  @Input() textoBotonConfirmar: string = 'Confirmar';
  
  @Output() onConfirmar = new EventEmitter<void>();
  @Output() onCancelar = new EventEmitter<void>();

  confirmar() {
    this.onConfirmar.emit();
  }

  cancelar() {
    this.onCancelar.emit();
  }
}