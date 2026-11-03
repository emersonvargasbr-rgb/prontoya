import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OnboardingPerfil } from './onboarding-perfil';

describe('OnboardingPerfil', () => {
  let component: OnboardingPerfil;
  let fixture: ComponentFixture<OnboardingPerfil>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OnboardingPerfil]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OnboardingPerfil);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
