import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';

@Component({
  selector: 'app-form-advanced-options',
  templateUrl: './form-advanced-options.component.html',
  styleUrls: ['./form-advanced-options.component.scss'],
})
export class FormAdvancedOptionsComponent {
  @Input() parentForm: FormGroup;
}
