const fields = foundry.data.fields;

export default class ItemDescriptionData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            description: new fields.StringField({ initial: "" }),
            source: new fields.StringField({ initial: "" })
        };
    }
}
