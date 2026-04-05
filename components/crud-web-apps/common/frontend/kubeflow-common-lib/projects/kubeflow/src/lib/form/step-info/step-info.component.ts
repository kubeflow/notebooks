import { Component, Input, HostBinding } from '@angular/core';

@Component({
  selector: 'lib-step-info',
  templateUrl: './step-info.component.html',
  styleUrls: ['./step-info.component.scss'],
})
export class StepInfoComponent {
  @Input() header: string;
  @HostBinding('class.lib-step-info') selfClass = true;

  constructor() {}
}
