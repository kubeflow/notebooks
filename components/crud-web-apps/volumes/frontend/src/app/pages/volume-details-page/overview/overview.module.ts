import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OverviewComponent } from './overview.component';
import { ContentListItemModule, KubeflowModule } from 'kubeflow';
import { LinkGroupsTableModule } from './link-groups-table/link-groups-table.module';
import { MatTooltipModule } from '@angular/material/tooltip';

@NgModule({
  declarations: [OverviewComponent],
  imports: [
    CommonModule,
    KubeflowModule,
    MatTooltipModule,
    ContentListItemModule,
    LinkGroupsTableModule,
  ],
  exports: [OverviewComponent],
})
export class OverviewModule {}
