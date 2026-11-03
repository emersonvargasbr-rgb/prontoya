import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalConfirmacion } from './modal-confirmacion';

describe('ModalConfirmacion', () => {
  let component: ModalConfirmacion;
  let fixture: ComponentFixture<ModalConfirmacion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalConfirmacion]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModalConfirmacion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
