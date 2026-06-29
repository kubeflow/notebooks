import {
  ComponentFixture,
  discardPeriodicTasks,
  fakeAsync,
  TestBed,
  tick,
} from '@angular/core/testing';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import {
  KubeflowModule,
  NamespaceService,
  PopoverModule,
  UrlsModule,
} from 'kubeflow';
import { MatTooltipModule } from '@angular/material/tooltip';
import { of, Subject } from 'rxjs';
import { VWABackendService } from 'src/app/services/backend.service';
import { EventsModule } from './events/events.module';
import { OverviewModule } from './overview/overview.module';
import { mockPvc } from './pvc-mock';
import { VolumeDetailsPageComponent } from './volume-details-page.component';
import { YamlModule } from './yaml/yaml.module';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ColumnsModule } from '../index/columns/columns.module';

const VWABackendServiceStub: Partial<VWABackendService> = {
  getPVC: () => of(mockPvc),
  getPodsUsingPVC: () => of(),
  getPVCEvents: () => of(),
};
const NamespaceServiceStub: Partial<NamespaceService> = {
  updateSelectedNamespace: () => {},
  getSelectedNamespace2: () => of(),
};
const ActivatedRouteStub: Partial<ActivatedRoute> = {
  params: of({ namespace: 'kubeflow-user', notebookName: 'asa232rstudio' }),
  queryParams: of({}),
};

describe('VolumeDetailsPageComponent', () => {
  let component: VolumeDetailsPageComponent;
  let fixture: ComponentFixture<VolumeDetailsPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VolumeDetailsPageComponent],
      providers: [
        { provide: VWABackendService, useValue: VWABackendServiceStub },
        { provide: NamespaceService, useValue: NamespaceServiceStub },
        { provide: ActivatedRoute, useValue: ActivatedRouteStub },
      ],
      imports: [
        RouterTestingModule,
        KubeflowModule,
        MatTabsModule,
        MatTooltipModule,
        PopoverModule,
        UrlsModule,
        ColumnsModule,
        OverviewModule,
        EventsModule,
        YamlModule,
        HttpClientTestingModule,
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VolumeDetailsPageComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should show only the proper tab according to query parameters', fakeAsync(() => {
    const checkActiveTabIndex = (expectedTab: string) => {
      const allTabs = ['overview', 'events', 'yaml'];
      const expectedIndex = allTabs.findIndex(v => v === expectedTab);
      expect(component.selectedTab.index).toEqual(expectedIndex);
      expect(component.selectedTab.name).toEqual(expectedTab);
    };

    const activatedRoute: ActivatedRoute = TestBed.inject(ActivatedRoute);
    const queryParams = new Subject();
    activatedRoute.queryParams = queryParams;
    fixture.detectChanges();
    tick();

    // Test events tab
    queryParams.next({ tab: 'events' });
    fixture.detectChanges();
    tick();
    checkActiveTabIndex('events');

    // Test overview tab
    queryParams.next({ tab: 'overview' });
    fixture.detectChanges();
    tick();
    checkActiveTabIndex('overview');

    // Test yaml tab
    queryParams.next({ tab: 'yaml' });
    fixture.detectChanges();
    tick();
    checkActiveTabIndex('yaml');

    discardPeriodicTasks();
  }));

  it('should switchTabs according to queryParams', fakeAsync(() => {
    const checkActiveTabIndex = (name: string) => {
      const allTabs = ['overview', 'events', 'yaml'];
      const expectedIndexOfActiveTab = allTabs.findIndex(v => v === name);
      expect(component.selectedTab.index).toEqual(expectedIndexOfActiveTab);
    };

    const activatedRoute: ActivatedRoute = TestBed.inject(ActivatedRoute);
    const queryParams = new Subject();
    activatedRoute.queryParams = queryParams;
    fixture.detectChanges();
    activatedRoute.queryParams.subscribe(params => {
      fixture.detectChanges();
      tick();
      checkActiveTabIndex(params.tab);
    });
    queryParams.next({ tab: 'events' });
    queryParams.next({ tab: 'overview' });
    queryParams.next({ tab: 'yaml' });

    discardPeriodicTasks();
  }));
});
