import { TestBed } from '@angular/core/testing';

import { AdminAllergy } from './admin-allergy';

describe('AdminAllergy', () => {
  let service: AdminAllergy;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AdminAllergy);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
