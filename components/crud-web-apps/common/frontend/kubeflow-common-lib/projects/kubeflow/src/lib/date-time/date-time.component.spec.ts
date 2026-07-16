import { OverlayContainer } from '@angular/cdk/overlay';
import { By } from '@angular/platform-browser';
import {
  ComponentFixture,
  fakeAsync,
  TestBed,
  tick,
  waitForAsync,
} from '@angular/core/testing';

import { DateTimeComponent } from './date-time.component';
import { DateTimeModule } from './date-time.module';
import { PopoverDirective } from '../popover/popover.directive';
import { SnackBarService } from '../snack-bar/snack-bar.service';

describe('DateTimeComponent', () => {
  let component: DateTimeComponent;
  let fixture: ComponentFixture<DateTimeComponent>;
  let overlayContainerElement: HTMLElement;

  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        imports: [DateTimeModule],
        providers: [{ provide: SnackBarService, useValue: {} }],
      }).compileComponents();
    }),
  );

  beforeEach(() => {
    fixture = TestBed.createComponent(DateTimeComponent);
    component = fixture.componentInstance;
    overlayContainerElement =
      TestBed.inject(OverlayContainer).getContainerElement();
  });

  afterEach(() => {
    overlayContainerElement.innerHTML = '';
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render and remove one populated overlay across repeated hovers', fakeAsync(() => {
    const date = '2026-07-16T08:00:00Z';
    component.date = date;
    fixture.detectChanges();

    const triggerElement = fixture.debugElement.query(By.css('.truncate'));
    const popoverDirective = triggerElement.injector.get(PopoverDirective);

    for (let hoverAttempt = 0; hoverAttempt < 3; hoverAttempt++) {
      triggerElement.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
      tick(100);

      if (!popoverDirective.popoverInstance) {
        throw new Error('Date-time popover instance was not created');
      }

      expect(popoverDirective.popoverInstance.tplPortal).toBeDefined();
      expect(
        overlayContainerElement.querySelectorAll('lib-popover').length,
      ).toBe(1);

      const popoverText = overlayContainerElement.textContent;
      expect(popoverText).toContain('Local');
      expect(popoverText).toContain('UTC');
      expect(popoverText).toContain(date);

      triggerElement.nativeElement.dispatchEvent(new MouseEvent('mouseleave'));
      tick(100);
      expect(
        overlayContainerElement.querySelectorAll('.cdk-overlay-pane').length,
      ).toBe(0);
    }
  }));
});
