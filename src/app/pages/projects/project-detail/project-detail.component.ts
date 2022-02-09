import { EnrichmentsService } from './../../../services/enrichments/enrichments.service';
import { Component, OnInit, OnDestroy, ViewChild, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { Observable, zip, Observer, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { HprojectsService, HProject, HdevicesService, HDevice, HpacketsService, HPacket, Rule } from '@hyperiot/core';
import { TreeDataNode, HytModalService } from '@hyperiot/components';

import { HytTreeViewProjectComponent } from '@hyperiot/components/lib/hyt-tree-view-project/hyt-tree-view-project.component';
import { ProjectFormEntity } from '../project-forms/project-form-entity';
import { SaveChangesDialogComponent } from 'src/app/components/dialogs/save-changes-dialog/save-changes-dialog.component';
import { PacketEnrichmentFormComponent } from '../project-forms/packet-enrichment-form/packet-enrichment-form.component';
import { ProjectEventsFormComponent } from '../project-forms/project-events-form/project-events-form.component';
import { ProjectStatisticsFormComponent } from '../project-forms/project-statistics-form/project-statistics-form.component';
import { CdkDragEnd } from '@angular/cdk/drag-drop';
import { ChangeDetectorRef } from '@angular/core';
import { PacketFieldsFormComponent } from '../project-forms/packet-fields-form/packet-fields-form.component';
import { DashboardConfigService } from '../../dashboard/dashboard-config.service';
import { ConfirmRecordingActionComponent } from 'src/app/components/modals/confirm-recording-action/confirm-recording-action.component';
import { ProjectAlarmsFormComponent } from '../project-forms/project-alarms-form/project-alarms-form.component';

enum TreeStatusEnum {
  Ready,
  Loading,
  LoadingComplete,
  Error
}

@Component({
  selector: 'hyt-project-detail',
  templateUrl: './project-detail.component.html',
  styleUrls: ['./project-detail.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class ProjectDetailComponent implements OnInit, OnDestroy {
  @ViewChild('treeView', { static: true }) treeView: HytTreeViewProjectComponent;

  hintMessage = '';
  hintVisible = false;

  TreeStatus = TreeStatusEnum;
  treeStatus = TreeStatusEnum.Ready;

  treeData: TreeDataNode[] = [];
  currentNode;

  currentEntity: ProjectFormEntity = null;

  private focusTimeout: any = null;
  private projectId: 0;

  projectName: string;
  validationErrors: [];
  
  /**
   * variable used to determine if the treeview should be visible or not
   */
  treeViewIsOpen: boolean = false;

  /**
   * variable used to dynamically set the first part of toggle treeview button title
   */
  preTitleTreeView: string = 'Show'; /* @I18N@ */
  
  /**
   * variable used to determine if the Info/Action column should be visible or not
   */
  displayInfoAction: boolean = true;
  
  /**
   * variable used to determine basic position of draggable treeview item
   */
  dragPosition = {x: 0, y: 0};
  basicDragPosition = {x: 0, y: 25};

  areaSection: string;

  /** Subject for manage the open subscriptions */
  protected ngUnsubscribe: Subject<void> = new Subject<void>();

  defaultData = [
    {
      "data": {
          "type": "source"
      },
      "name": "Sources",
      "icon": "icon-hyt_StreamCloud_Lamp",
      "children": []
    },
    {
      "data": {
        "type": "statistics"
      },
      "name": "Statistics",
      "icon": "icon-hyt_statistics"
    },
    {
      "data": {
        "type": "events"
      },
      "name": "Events",
      "icon": "icon-hyt_event"
    },
    {
      "data": {
        "type": "tags"
      },
      "name": "Tags",
      "icon": "icon-hyt_tags"
    },
    {
      "data": {
        "type": "categories"
      },
      "name": "Categories",
      "icon": "icon-hyt_categories"
    },
    {
      "data": {
        "type": "areas"
      },
      "name": "Areas",
      "icon": "icon-hyt_areaB16"
    }
  ];

  currentPacket: number = null;
  currentDeviceName: string = '';

  constructor(
    private hProjectService: HprojectsService,
    private hDeviceService: HdevicesService,
    private packetService: HpacketsService,
    private dashboardConfigService: DashboardConfigService,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private dialog: HytModalService,
    private cdRef:ChangeDetectorRef,
    private enrichmentsService: EnrichmentsService
  ) { }

  ngOnInit() {
    
    this.projectId = this.activatedRoute.snapshot.params.projectId;
    this.refresh();
    
    this.enrichmentsService.changeDeviceName$
    .pipe(takeUntil(this.ngUnsubscribe))
    .subscribe(deviceName => {
      this.currentDeviceName = deviceName;
    });

    this.enrichmentsService.changePacket$
    .pipe(takeUntil(this.ngUnsubscribe))
    .subscribe(packetID => {
      this.currentPacket = packetID;
    });

  }

  ngOnDestroy() {
    if (this.ngUnsubscribe) {
      this.ngUnsubscribe.next();
    }
  }

  onActivate(childComponent: ProjectFormEntity) {
    
    childComponent.clickedTab.subscribe(val => {
      this.areaSection = val;
      this.toggleInfoActionColumn(childComponent);
    });


    if (childComponent.isProjectEntity) {
      
      this.toggleInfoActionColumn(childComponent);

      this.currentEntity = childComponent;

      console.log("##########this.currentEntity");
      console.log(this.currentEntity);
      this.currentEntity.unsavedChangesCallback = () => {
        return this.openSaveDialog();
      };
      this.currentEntity.entityEvent.subscribe((data) => {
        switch (data.event) {
          case 'treeview:refresh':
            this.refresh();
            break;
          case 'treeview:focus':
            this.focus(data);
            break;
          case 'treeview:update':
            this.updateNode(data);
            break;
          case 'hint:show':
            this.showHintMessage(data.message);
            break;
          case 'hint:hide':
            this.hideHintMessage();
            break;
          case 'entity:delete':
            if (data.exitRoute == 'project') {
              this.router.navigate(['/projects/' + this.projectId]);
            } else if (data.exitRoute == 'out') {
              this.router.navigate(['/projects']);
            }
            break;
        }
      });
      // handle type specific fields and methods
      if (this.currentEntity instanceof PacketEnrichmentFormComponent) {
        (this.currentEntity as PacketEnrichmentFormComponent).showCover = true;
      }
      if (this.currentEntity instanceof ProjectStatisticsFormComponent) {
        (this.currentEntity as ProjectStatisticsFormComponent).showCover = true;
      }
    }
  }

  onSaveClick() {
    this.validationErrors = [];
    this.currentEntity.save((res) => {
      if (this.currentEntity instanceof PacketEnrichmentFormComponent || this.currentEntity instanceof ProjectEventsFormComponent 
        || this.currentEntity instanceof ProjectStatisticsFormComponent || this.currentEntity instanceof ProjectAlarmsFormComponent) {
        this.currentEntity.editMode = false;
      }

      // Trigger reload topology
      if (this.currentEntity instanceof PacketEnrichmentFormComponent || this.currentEntity instanceof PacketFieldsFormComponent || this.currentEntity instanceof ProjectEventsFormComponent) {
        this.shouldUpdateTopology();
      }
    }, (err) => {
      // TODO: ...
    });
  }

  onDeleteClick() {
    this.currentEntity.openDeleteDialog(() => {
      // Trigger reload topology
      if (this.currentEntity instanceof PacketEnrichmentFormComponent || this.currentEntity instanceof PacketFieldsFormComponent 
        || this.currentEntity instanceof ProjectStatisticsFormComponent || this.currentEntity instanceof ProjectEventsFormComponent || this.currentEntity instanceof ProjectAlarmsFormComponent) {
        this.shouldUpdateTopology();
      }
    });
  }

  onCancelClick() {
    this.currentEntity.cancel();
  }

  shouldUpdateTopology() {
    this.dashboardConfigService
    .getRecordingStatus(this.projectId)
    .pipe(takeUntil(this.ngUnsubscribe))
    .subscribe(
      (res) => {
        const recordingStatus = res;
        if (recordingStatus.status === "ACTIVE") {
          this.openConfirmChangeRecordingModal(false);
        }
      },
      (error) => {
        console.error(error);
      }
    );
  }

  openConfirmChangeRecordingModal(rocordingState: boolean) {
    const modalRef = this.dialog.open(
      ConfirmRecordingActionComponent,
      {
        textBodyModal: $localize`:@@HYT_reload_topology_alert:Changes have been made to data recording configuration. To make them effective you need to restart data recording, do you want to start it now? Anyway, the data you are sending won’t be lost.`,
        dataRecordingIsOn: rocordingState,
        actionType: "restart",
        projectId: this.projectId,
      },
      false
    );
    modalRef.onClosed.subscribe(
      (result) => { },
      (error) => {
        console.error(error);
      }
    );
  }

  onSummaryMenuClick(e) {

    const entity = Object.assign({}, e.item.data);

    switch (e.action) {
      case 'edit':
        this.currentEntity.edit(entity);
        break;
      case 'duplicate':
        this.currentEntity.clone(entity);
        break;
      case 'delete':
        this.currentEntity.edit(entity, this.currentEntity.openDeleteDialog((del) => {
          this.currentEntity.editMode = false;
        }));
        break;
    }
  }

  refresh() {
    this.treeStatus = TreeStatusEnum.Loading;
    this.treeData = [];
    this.hProjectService.findHProject(+this.projectId).subscribe((p: HProject) => {

      const projectNode: TreeDataNode = {
        data: { id: p.id },
        name: p.name,
        icon: 'icon-hyt_projectRSolo',
        children: []
      };
      this.projectName = p.name;
      this.treeData.push(projectNode);
      this.treeView.setData(this.treeData);
      this.hDeviceService.findAllHDeviceByProjectId(p.id).subscribe((deviceList: HDevice[]) => {
        const sourcesNode = { // sources node
          data: { id: 0, type: 'sources' },
          name: 'Sources',
          icon: 'icon-hyt_StreamCloud_Lamp',
          children: []
        };
        if (deviceList.length !== 0) {
          projectNode.children.push(sourcesNode);
        }
        const requests: Observable<any>[] = [];
        const devices = []; // device lookup list
        deviceList.map((d) => {
          const node = {
            data: { id: d.id, type: 'device' },
            name: d.deviceName,
            icon: 'icon-hyt_device'
          };
          devices[d.id] = node;
          sourcesNode.children.push(node);
          requests.push(this.packetService.getHDevicePacketList(d.id));
        });
        zip(...requests).subscribe((packetList: Array<HPacket[]>) => {
          packetList.map((kd: HPacket[]) => {
            if (kd.length === 0) {
              return;
            }
            const d = kd[0].device;
            devices[d.id].children = kd.map((k) => {
              return {
                data: { id: k.id, type: 'packet' },
                name: k.name,
                icon: 'icon-hyt_packets',
                children: [
                  {
                    data: { id: k.id, type: 'packet-fields' },
                    name: 'Fields',
                    icon: 'icon-hyt_fields'
                  },
                  {
                    data: { id: k.id, type: 'packet-enrichments' },
                    name: 'Enrichments',
                    icon: 'icon-hyt_enrichments'
                  }
                ]
              };
            });
          });
          const statistics: TreeDataNode = {
            data: { type: 'statistics' },
            name: 'Statistics',
            icon: 'icon-hyt_statistics',
            visible: true,
            children: []
          };
          const events: TreeDataNode = {
            data: { type: 'events' },
            name: 'Events',
            icon: 'icon-hyt_event',
            visible: true,
            children: []
          };
          const alarms: TreeDataNode = {
            data: { type: 'alarms' },
            name: 'Alarms',
            icon: 'icon-hyt_notification',
            visible: true,
            children: []
          };
          // Add tags, categories and areas
          const tags: TreeDataNode = {
            data: { type: 'tags' },
            name: 'Tags',
            icon: 'icon-hyt_tags',
            visible: true,
            children: []
          };
          const categories: TreeDataNode = {
            data: { type: 'categories' },
            name: 'Categories',
            icon: 'icon-hyt_categories',
            visible: true,
            children: []
          };
          const areas: TreeDataNode = {
            data: { type: 'areas' },
            name: 'Areas',
            icon: 'icon-hyt_areaB16',
            visible: true,
            children: []
          };
          projectNode.children.push(...[statistics, events, alarms, tags, categories, areas]);
          this.treeView.setData(this.treeData);
          if (this.treeView.treeControl.dataNodes.length > 0) {
            this.treeView.treeControl.expand(this.treeView.treeControl.dataNodes[0]);
          }
          this.treeStatus = TreeStatusEnum.Ready;
          
        }, (err) => {
          this.treeStatus = TreeStatusEnum.Error;
        });
        if (requests.length === 0) {
          this.treeStatus = TreeStatusEnum.Ready;
        }
      }, (err) => {
        this.treeStatus = TreeStatusEnum.Error;
      },
      () => {
        
        if(this.treeData[0].children.length == 0){
          
          let myTreeData = [...this.treeData];
          this.defaultData.map((d) => {
            myTreeData[0]['children'].push(d)
          })
          this.treeView.setData(myTreeData);

        }
        
      }
      );
    }, (err) => {
      this.treeStatus = TreeStatusEnum.Error;
    });
    
  }

  onNodeClick(node) {
    if (node.data && node.data.type) {
      this.router.navigate(
        [{ outlets: { projectDetails: node.data.id ? [node.data.type, node.data.id] : node.data.type } }],
        { relativeTo: this.activatedRoute }
      ).then((success) => {
        if (!success && this.currentNode) {
          // reposition on last selected node if navigation is cancelled
          this.treeView.setActiveNode(this.currentNode);
        }
      });
    } else {
      this.router.navigate(
        ['./', { outlets: { projectDetails: null } }],
        { relativeTo: this.activatedRoute }
      ).then((success) => {
        if (!success && this.currentNode) {
          // reposition on last selected node if navigation is cancelled
          this.treeView.setActiveNode(this.currentNode);
        }
      });
    }
  }

  find(data: any) {
    return this.treeView
      .treeControl
      .dataNodes.find((d) => d.data.id === data.id && d.data.type === data.type);
  }

  focus(data) {
    if (this.treeStatus !== TreeStatusEnum.Ready) {
      if (this.focusTimeout !== null) {
        clearTimeout(this.focusTimeout);
      }
      this.focusTimeout = setTimeout(() => {
        this.focus(data);
      }, 100);
      return;
    }
    // refresh treeview node data
    const tc = this.treeView.treeControl;
    const node = this.currentNode = this.find(data);
    if (node) {
      this.treeView.setActiveNode(node);
      let n = node.parent;
      while (n) {
        const np = this.find(n.data);
        tc.expand(np);
        n = np.parent;
      }
    }
  }

  updateNode(data) {
    // refresh treeview node data
    const node = this.find(data);
    node.name = data.name;
    this.focus(data);
  }

  openSaveDialog(): Observable<boolean> {
    return new Observable((observer: Observer<boolean>) => {
      const dialogRef = this.dialog.open(SaveChangesDialogComponent, {
        data: { title: 'Discard changes?', message: 'There are pending changes to be saved.' }
      });
      dialogRef.onClosed.subscribe((result) => {
        if (result === 'save') {
          this.validationErrors = [];
          this.currentEntity.save((res) => {
            observer.next(true);
            observer.complete();
          }, (err) => {
            observer.next(false);
            observer.complete();
          });
        } else {
          observer.next(result === 'discard' || result === 'save');
          observer.complete();
        }
      });
    });
  }

  showHintMessage(message: string) {
    this.hintMessage = message;
    this.hintVisible = true;
  }
  hideHintMessage() {
    this.hintVisible = false;
  }

  goToProjectWizard() {
    this.router.navigateByUrl(`/project-wizard/${this.projectId}`);
  }

  goToDashboard() {
    this.router.navigate(['/dashboards'], { queryParams: { projectId: this.projectId } });
  }

  /**
   * function used to toggle display treeview project in area map
   */
  toggleTreeViewProject() {

    this.treeViewIsOpen = !this.treeViewIsOpen;

    if(this.treeViewIsOpen) {
      
      this.preTitleTreeView = 'Hide'; /* @I18N@ */
      this.dragPosition = {x: this.basicDragPosition.x, y: this.basicDragPosition.y};

    } else {

      this.preTitleTreeView = 'Show'; /* @I18N@ */

    }

  }
  
  /**
   * function used to toggle display Info/Action Column
   */
  toggleInfoActionColumn(childComponent: any) {
    
    if(
    
      (childComponent.formTemplateId.includes('areas-form') && this.areaSection == 'Tab-Sub-Area') ||
      (childComponent.formTemplateId.includes('areas-form') && this.areaSection == 'Tab-Map') ||

      (childComponent.formTemplateId.includes('areas-form') && this.areaSection == 'Tab-Info') && 
      childComponent.editMode == false ||

      childComponent.formTemplateId.includes('tag-form') ||
      childComponent.formTemplateId.includes('category-form')

    ) {

      this.displayInfoAction = false;
      this.cdRef.detectChanges();
      
    } else {

      this.displayInfoAction = true;
      this.cdRef.detectChanges();
      
    }

  }
  
  /**
   * Used to calculate the position in space and prevent the treeview from going out of bounds 
   * @param ended 
   */
  dragEnded(ended: CdkDragEnd) {
    let constLeftX = 75; /* -75 after 0 point */

    // TREEVIEW DIV POSITION X/Y
    let posY = ended.source._dragRef['_activeTransform'].y;
    let posX = ended.source._dragRef['_activeTransform'].x;

    // TREEVIEW DIV MEASURES
    let ptW = ended.source.element.nativeElement.clientWidth + 15;

    // #HYT-CONTAINER LIMIT
    let hytContainerHClient = document.getElementById('hyt-container').clientWidth;
    
    // horizontal limit beyond which it is not possible to scroll the treeview box to the right
    let horizontalLimit = hytContainerHClient - constLeftX - ptW;
    
    let dragX, dragY: number;
    
    // Verify Y position
    if(posY < -175){
      dragY = -175;
    }else{
      dragY = posY;
    }
    
    // Verify X position
    if(posX < -13){
      dragX = 0;
    }else if(posX >= horizontalLimit){
      dragX = horizontalLimit - 20;
    }else{
      dragX = posX;
    }

    this.dragPosition = { x: dragX, y: dragY }

  }

}
