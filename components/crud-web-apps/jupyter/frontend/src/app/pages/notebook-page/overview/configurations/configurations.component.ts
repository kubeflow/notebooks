import { Component, Input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Configuration } from 'src/app/types/configuration';
import { ConfigurationInfoDialogComponent } from './configuration-info-dialog/configuration-info-dialog.component';

@Component({
  selector: 'app-configurations',
  templateUrl: './configurations.component.html',
  styleUrls: ['./configurations.component.scss'],
})
export class ConfigurationsComponent {
  @Input() configurations: Configuration[];

  constructor(private dialog: MatDialog) {}

  openDialog(config: Configuration) {
    this.dialog.open(ConfigurationInfoDialogComponent, {
      data: { config },
      width: '600px',
    });
  }
}
