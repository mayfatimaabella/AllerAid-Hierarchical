import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmergencyHistoryDetailsPage } from './emergency-history-details.page';

describe('EmergencyHistoryDetailsPage', () => {
  let component: EmergencyHistoryDetailsPage;
  let fixture: ComponentFixture<EmergencyHistoryDetailsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(EmergencyHistoryDetailsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
