import { Component, Input } from '@angular/core';

@Component({
  selector: 'lib-form-section',
  templateUrl: './section.component.html',
  styleUrls: ['./section.component.scss'],
})
export class FormSectionComponent {
  @Input()
  title: string;

  @Input()
  text: string;

  @Input()
  readOnly: string;

  @Input()
  style: string;

  @Input()
  icon: string;

  @Input()
  helpText: string;
}
