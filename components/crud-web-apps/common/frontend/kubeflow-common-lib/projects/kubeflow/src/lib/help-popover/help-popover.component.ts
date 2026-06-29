import { Component, Input } from '@angular/core';

@Component({
  selector: 'lib-help-popover',
  templateUrl: './help-popover.component.html',
  styleUrls: ['./help-popover.component.scss'],
})
export class HelpPopoverComponent {
  @Input() popoverPosition = 'below';

  @Input()
  showStatus: boolean;

  @Input()
  showDate: boolean;

  constructor() {}
}
