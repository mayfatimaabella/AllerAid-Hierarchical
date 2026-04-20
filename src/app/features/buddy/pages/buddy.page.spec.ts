import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BuddyPage } from './buddy.page';

describe('BuddyPage', () => {
  let component: BuddyPage;
  let fixture: ComponentFixture<BuddyPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(BuddyPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});




