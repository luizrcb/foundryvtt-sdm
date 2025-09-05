import { getSlotsTaken } from '../helpers/itemUtils.mjs';
import NPCBaseDataModel from './npc-base-data.mjs';
import ItemSizeDataModel from './item-size.mjs';
import HallmarkBaseDataModel from './hallmark-base-data.mjs';

export default class SdmItemBase extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = {};

    // also known as equipped
    schema.readied = new fields.BooleanField({ initial: false });

    schema.status = new fields.StringField({
      required: false,
      nullable: true,
      blank: true,
      initial: '',
      choices: CONFIG.SDM.itemStatus,
    });

    schema.cost = new fields.NumberField({
      required: false,
      nullable: true,
      integer: true,
      initial: 0
    });

    schema.cost_frequency = new fields.StringField({
      required: false,
      nullable: true,
      blank: true,
      initial: '',
      choices: CONFIG.SDM.frequency
    });

    schema.description = new fields.HTMLField();

    schema.quantity = new fields.NumberField({
      required: true,
      integer: true,
      initial: 1,
      min: 0
    });

    schema.size = new fields.EmbeddedDataField(ItemSizeDataModel);

    schema.features = new fields.HTMLField();

    schema.attributes = new fields.EmbeddedDataField(NPCBaseDataModel);

    schema.is_hallmark = new fields.BooleanField({
      required: true,
      initial: false,
    });

    schema.hallmark = new fields.EmbeddedDataField(HallmarkBaseDataModel)

    return schema;
  }

  prepareDerivedData() {
    this.slots_taken = getSlotsTaken(this);
  }
}
