import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmergencyLogsPage } from './emergency-logs.page';

describe('EmergencyLogsPage', () => {
  let component: EmergencyLogsPage;
  let fixture: ComponentFixture<EmergencyLogsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(EmergencyLogsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
