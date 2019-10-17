import { Component, OnInit } from '@angular/core';
import { HYTError } from 'src/app/services/errorHandler/models/models';
import { FormGroup, FormBuilder } from '@angular/forms';
import { SelectOption } from '@hyperiot/components';
import { PageStatusEnum } from '../model/pageStatusEnum';
import { RulesService, HPacket } from '@hyperiot/core';

@Component({
  selector: 'hyt-statistics-step',
  templateUrl: './statistics-step.component.html',
  styleUrls: ['./statistics-step.component.scss']
})
export class StatisticsStepComponent implements OnInit {

  currentPacket: HPacket;

  statisticsForm: FormGroup;

  PageStatus = PageStatusEnum;
  pageStatus: PageStatusEnum = PageStatusEnum.Default;

  errors: HYTError[] = [];

  algorithmOptions: SelectOption[] = [
    { value: '0', label: 'Average' },
    { value: '1', label: 'Media 2 Fields' },
    { value: '3', label: 'Media 3 Fields' },
    { value: '4', label: 'Predective' },
    { value: '5', label: 'Regression' },
    { value: '6', label: 'String' },
    { value: '7', label: 'Variance' }
  ];

  timeRangeOptions: SelectOption[] = [
    { value: '0', label: 'Hours' },
    { value: '1', label: 'Daily' },
    { value: '3', label: 'Weekly' },
    { value: '4', label: 'Monthly' },
    { value: '5', label: 'Quarterly' },
    { value: '6', label: 'Four-monthly' },
    { value: '7', label: 'Half yearly' },
    { value: '8', label: 'Annual' }
  ];

  enrichmentRules: SelectOption[] = [
    { value: JSON.stringify({ actionName: "AddCategoryRuleAction", ruleId: 0, categoryIds: null }), label: 'Categories' },
    { value: JSON.stringify({ actionName: "AddTagRuleAction", ruleId: 0, tagIds: null }), label: 'Tags' },
    { value: JSON.stringify({ actionName: "ValidateHPacketRuleAction", ruleId: 0 }), label: 'Packet' }//TODO actionName is wrong
  ];

  constructor(
    private rulesService: RulesService,
    private fb: FormBuilder
  ) { }

  ngOnInit() {
    this.statisticsForm = this.fb.group({});
    this.rulesService.findAllRuleActions('ENRICHMENT').subscribe(
      res => { }//TODO //this.enrichmentRules = res
    )
  }

  createStatistic() {

    this.errors = [];

  }

  invalid() {
    return true;
  }

  getError(field: string): string {
    return (this.errors.find(x => x.container == field)) ? this.errors.find(x => x.container == field).message : null;
  }

  enrichmentType: string = '';

  enrichmentTypeChanged(event) {
    if (event.value)
      this.enrichmentType = JSON.parse(event.value).actionName;
  }

  //Tags

  assetTags: number[] = [];

  updateAssetTag(event) {
    this.assetTags = event;
  }

  //Category

  assetCategories: number[] = [];

  updateAssetCategory(event) {
    this.assetCategories = event;
  }

  packetChanged(event) {
    this.currentPacket = event;
  }

}
