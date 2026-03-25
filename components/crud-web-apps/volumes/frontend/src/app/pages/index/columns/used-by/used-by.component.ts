import { Component } from '@angular/core';
import { TableColumnComponent } from 'kubeflow/lib/resource-table/component-value/component-value.component';

@Component({
  selector: 'app-used-by',
  templateUrl: './used-by.component.html',
  styleUrls: ['./used-by.component.scss'],
})
export class UsedByComponent implements TableColumnComponent {
  public data: any;

  set element(data: any) {
    this.data = data;
  }
  get element() {
    return this.data;
  }

  get pvcName() {
    return this.element.name;
  }

  getUrlItem(nb: string, element: any) {
    return {
      name: nb,
      url: `/jupyter/notebook/details/${element.namespace}/${nb}`,
    };
  }
}
