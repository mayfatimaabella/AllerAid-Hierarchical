import { TestBed } from '@angular/core/testing';

import { AdminDoctor } from './admin-doctor';

describe('AdminDoctor', () => {
  let service: AdminDoctor;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AdminDoctor);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
