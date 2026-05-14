import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { PatientInvitePage } from './patient-invite.page';

describe('PatientInvitePage', () => {
  let component: PatientInvitePage;
  let fixture: ComponentFixture<PatientInvitePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PatientInvitePage],
      imports: [ReactiveFormsModule]
    }).compileComponents();

    fixture = TestBed.createComponent(PatientInvitePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize the form on init', () => {
    expect(component.inviteForm).toBeDefined();
    expect(component.inviteForm.get('email')).toBeDefined();
  });

  it('should validate email field', () => {
    const emailControl = component.inviteForm.get('email');
    emailControl?.setValue('invalid-email');
    expect(emailControl?.hasError('email')).toBeTruthy();
  });
});
