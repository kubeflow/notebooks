import { Component, Input } from '@angular/core';

@Component({
  selector: 'lib-content-list-item',
  templateUrl: './content-list-item.component.html',
  styleUrls: ['./content-list-item.component.scss'],
})
export class ContentListItemComponent {
  @Input() key: string;
  @Input() keyTooltip: string;
  @Input() topDivider = false;
  @Input() bottomDivider = true;
  @Input() keyMinWidth = '250px';
  @Input() loadErrorMsg = 'Resources not available';

  constructor() {}
}
