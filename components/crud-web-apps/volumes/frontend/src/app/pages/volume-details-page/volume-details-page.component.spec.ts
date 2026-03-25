import {
  ComponentFixture,
  discardPeriodicTasks,
  fakeAsync,
  flush,
  TestBed,
  tick,
} from '@angular/core/testing';
import { MatTabsModule } from '@angular/material/tabs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { KubeflowModule, NamespaceService, PollerService } from 'kubeflow';
import { of, Subject } from 'rxjs';
import { ActionsService } from 'src/app/services/actions.service';
import { VWABackendService } from 'src/app/services/backend.service';
import { EventsModule } from './events/events.module';
import { OverviewModule } from './overview/overview.module';
import { mockPvc } from './pvc-mock';
import { VolumeDetailsPageComponent } from './volume-details-page.component';
import { YamlModule } from './yaml/yaml.module';
import { HttpClientTestingModule } from '@angular/common/http/testing';

const ActionsServiceStub: Partial<ActionsService> = {
  deleteVolume: () => of(),
};
const VWABackendServiceStub: Partial<VWABackendService> = {
  getPVC: () => of(mockPvc),
  getPodsUsingPVC: () => of(),
  getPVCEvents: () => of(),
};
const NamespaceServiceStub: Partial<NamespaceService> = {
  updateSelectedNamespace: () => {},
  getSelectedNamespace2: () => of(),
};
const PollerServiceStub: Partial<PollerService> = {
  exponential: request => request,
};
const ActivatedRouteStub: Partial<ActivatedRoute> = {
  params: of({ namespace: 'kubeflow-user', pvcName: 'asa232rstudio' }),
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
        { provide: PollerService, useValue: PollerServiceStub },
        { provide: ActionsService, useValue: ActionsServiceStub },
        { provide: ActivatedRoute, useValue: ActivatedRouteStub },
      ],
      imports: [
        RouterTestingModule,
        KubeflowModule,
        MatTabsModule,
        NoopAnimationsModule,
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
    const allTabs = ['overview', 'events', 'yaml'];
    const checkActiveTab = (name: string) => {
      const tabBodies = fixture.debugElement.queryAll(
        By.css('.mat-mdc-tab-body'),
      );
      expect(tabBodies.length).toEqual(allTabs.length);

      tabBodies.forEach((tabBody, index) => {
        expect(tabBody.classes['mat-mdc-tab-body-active']).toBe(
          allTabs[index] === name,
        );
      });

      const activeTabBody = tabBodies.find(
        tabBody => tabBody.classes['mat-mdc-tab-body-active'],
      );
      expect(activeTabBody?.query(By.css(`app-${name}`))).toBeTruthy();
    };

    const activatedRoute: ActivatedRoute = TestBed.inject(ActivatedRoute);
    const queryParams = new Subject<{ tab: string }>();
    activatedRoute.queryParams = queryParams;
    const setActiveTab = (name: string) => {
      queryParams.next({ tab: name });
      fixture.detectChanges();
      tick();
      flush();
      fixture.detectChanges();
      checkActiveTab(name);
    };

    fixture.detectChanges();
    setActiveTab('events');
    setActiveTab('overview');
    setActiveTab('yaml');

    discardPeriodicTasks();
  }));

  it('should switchTabs according to queryParams', fakeAsync(() => {
    const checkActiveTabIndex = (name: string) => {
      const allTabs = ['overview', 'events', 'yaml'];
      const expectedIndexOfActiveTab = allTabs.findIndex(v => v === name);
      expect(component.selectedTab.index).toEqual(expectedIndexOfActiveTab);
    };

    const activatedRoute: ActivatedRoute = TestBed.inject(ActivatedRoute);
    const queryParams = new Subject<{ tab: string }>();
    activatedRoute.queryParams = queryParams;
    const setActiveTab = (name: string) => {
      queryParams.next({ tab: name });
      fixture.detectChanges();
      tick();
      flush();
      fixture.detectChanges();
      checkActiveTabIndex(name);
    };

    fixture.detectChanges();
    setActiveTab('events');
    setActiveTab('overview');
    setActiveTab('yaml');

    discardPeriodicTasks();
  }));
});
