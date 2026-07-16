import { OverlayContainer } from '@angular/cdk/overlay';
import { Component } from '@angular/core';
import {
  ComponentFixture,
  fakeAsync,
  TestBed,
  tick,
  waitForAsync,
} from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { PopoverDirective } from './popover.directive';
import { PopoverModule } from './popover.module';

@Component({
  template: `
    <button
      [libPopover]="popoverMessage"
      [libPopoverHideDelay]="100"
      [libPopoverShowDelay]="100"
    >
      Show details
    </button>
  `,
})
class PopoverHostComponent {
  popoverMessage = 'Initial details';
}

describe('PopoverDirective', () => {
  let component: PopoverHostComponent;
  let fixture: ComponentFixture<PopoverHostComponent>;
  let overlayContainerElement: HTMLElement;

  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        declarations: [PopoverHostComponent],
        imports: [PopoverModule],
      }).compileComponents();
    }),
  );

  beforeEach(() => {
    fixture = TestBed.createComponent(PopoverHostComponent);
    component = fixture.componentInstance;
    overlayContainerElement =
      TestBed.inject(OverlayContainer).getContainerElement();
    fixture.detectChanges();
  });

  afterEach(() => {
    overlayContainerElement.innerHTML = '';
  });

  it('should render and update a string message while shown', fakeAsync(() => {
    const triggerElement = fixture.debugElement.query(
      By.directive(PopoverDirective),
    );
    triggerElement.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
    tick(100);

    expect(overlayContainerElement.textContent).toContain('Initial details');

    component.popoverMessage = 'Updated details';
    fixture.detectChanges();
    tick();

    expect(overlayContainerElement.textContent).toContain('Updated details');

    triggerElement.nativeElement.dispatchEvent(new MouseEvent('mouseleave'));
    tick(100);

    expect(
      overlayContainerElement.querySelectorAll('.cdk-overlay-pane').length,
    ).toBe(0);
  }));

  it('should detach once after re-entry cancels a pending hide', fakeAsync(() => {
    const triggerElement = fixture.debugElement.query(
      By.directive(PopoverDirective),
    );
    const popoverDirective = triggerElement.injector.get(PopoverDirective);
    const detachSpy = spyOn(popoverDirective, 'detach').and.callThrough();

    triggerElement.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
    tick(100);
    triggerElement.nativeElement.dispatchEvent(new MouseEvent('mouseleave'));
    tick(50);
    triggerElement.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
    tick(100);
    triggerElement.nativeElement.dispatchEvent(new MouseEvent('mouseleave'));
    tick(100);

    expect(detachSpy).toHaveBeenCalledTimes(1);
    expect(
      overlayContainerElement.querySelectorAll('.cdk-overlay-pane').length,
    ).toBe(0);
  }));
});
