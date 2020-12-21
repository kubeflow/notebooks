import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DetailsListComponent } from './details-list.component';
import { DetailsListModule } from './details-list.module';

describe('DetailsListComponent', () => {
  let component: DetailsListComponent;
  let fixture: ComponentFixture<DetailsListComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [DetailsListModule],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DetailsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
