import { Component, Output, EventEmitter, Input } from '@angular/core';

@Component({
  selector: 'lib-submit-bar',
  templateUrl: './submit-bar.component.html',
  styleUrls: ['./submit-bar.component.scss'],
})
export class SubmitBarComponent {
  @Input() createDisabled = false;
  @Input() allowYAMLEditing = true;
  @Input() isApplying = false;
  @Output() create = new EventEmitter<boolean>();
  @Output() cancel = new EventEmitter<boolean>();
  @Output() yaml = new EventEmitter<boolean>();

  constructor() {}
}
