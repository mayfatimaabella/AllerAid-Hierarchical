import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { PatientProfilePage } from './patient-profile.page';

describe('PatientProfilePage', () => {
  let component: PatientProfilePage;
  let fixture: ComponentFixture<PatientProfilePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PatientProfilePage],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => 'test-patient-id'
              }
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PatientProfilePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load patient profile on init', () => {
    spyOn(component, 'loadPatientProfile');
    component.ngOnInit();
    expect(component.loadPatientProfile).toHaveBeenCalled();
  });

  it('should change selected segment', () => {
    component.selectedSegment = 'allergies';
    expect(component.selectedSegment).toBe('allergies');
  });
});
