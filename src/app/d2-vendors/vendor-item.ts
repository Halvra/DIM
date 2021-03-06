import { DestinyVendorItemDefinition, DestinyVendorSaleItemComponent, DestinyItemComponentSetOfint32, DestinyInventoryItemDefinition, DestinyItemInstanceComponent, DestinyVendorDefinition, ItemBindStatus, ItemLocation, TransferStatuses, ItemState, DestinyItemSocketEntryPlugItemDefinition } from "bungie-api-ts/destiny2";
import { D2ManifestDefinitions } from "../destiny2/d2-definitions.service";
import { equals } from 'angular';
import { makeItem } from "../inventory/store/d2-item-factory.service";
import { D2ReviewDataCache } from "../destinyTrackerApi/d2-reviewDataCache";
import { D2Item } from "../inventory/item-types";
import { InventoryBuckets } from "../inventory/inventory-buckets";
import { D2RatingData } from "../item-review/d2-dtr-api-types";

/**
 * A displayable vendor item. The only state it holds is raw responses/definitions - all
 * display properties are computed. The item itself is immutable and should be cheap to
 * construct, and relatively cheap to compare.
 *
 * This is the pattern I want to follow for our main items!
 */
// TODO: Replace with DimItem
export class VendorItem {
  static forPlugSetItem(
    defs: D2ManifestDefinitions,
    plugItemDef: DestinyItemSocketEntryPlugItemDefinition,
    reviewCache?: D2ReviewDataCache,
    canPurchase = true,
  ): VendorItem {
    return new VendorItem(
      defs,
      defs.InventoryItem.get(plugItemDef.plugItemHash),
      undefined,
      undefined,
      reviewCache ? reviewCache.getRatingData(undefined, plugItemDef.plugItemHash) : null,
      undefined,
      undefined,
      undefined,
      canPurchase
    );
  }

  static forKioskItem(
    defs: D2ManifestDefinitions,
    vendorDef: DestinyVendorDefinition,
    vendorItemDef: DestinyVendorItemDefinition,
    canPurchase: boolean,
    reviewCache?: D2ReviewDataCache
  ): VendorItem {
    return new VendorItem(
      defs,
      defs.InventoryItem.get(vendorItemDef.itemHash),
      vendorDef,
      vendorItemDef,
      reviewCache ? reviewCache.getRatingData(undefined, vendorItemDef.itemHash) : null,
      undefined,
      undefined,
      undefined,
      canPurchase
    );
  }

  static forVendorSaleItem(
    defs: D2ManifestDefinitions,
    vendorDef: DestinyVendorDefinition,
    saleItem: DestinyVendorSaleItemComponent,
    reviewCache?: D2ReviewDataCache,
    // TODO: this'll be useful for showing the move-popup details
    itemComponents?: DestinyItemComponentSetOfint32
  ): VendorItem {
    let instance;
    if (saleItem && itemComponents && itemComponents.instances && itemComponents.instances.data) {
      instance = itemComponents.instances.data[saleItem.vendorItemIndex];
    }
    const vendorItemDef = vendorDef.itemList[saleItem.vendorItemIndex];

    return new VendorItem(
      defs,
      defs.InventoryItem.get(vendorItemDef.itemHash),
      vendorDef,
      vendorItemDef,
      reviewCache ? reviewCache.getRatingData(saleItem) : null,
      saleItem,
      itemComponents,
      instance
    );
  }

  static forVendorDefinitionItem(
    defs: D2ManifestDefinitions,
    vendorDef: DestinyVendorDefinition,
    vendorItemDef: DestinyVendorItemDefinition,
    reviewCache?: D2ReviewDataCache
  ): VendorItem {
    return new VendorItem(
      defs,
      defs.InventoryItem.get(vendorItemDef.itemHash),
      vendorDef,
      vendorItemDef,
      reviewCache ? reviewCache.getRatingData(undefined, vendorItemDef.itemHash) : null
    );
  }

  canPurchase: boolean;
  private itemComponents?: DestinyItemComponentSetOfint32;
  private vendorItemDef?: DestinyVendorItemDefinition;
  private saleItem?: DestinyVendorSaleItemComponent;
  private vendorDef?: DestinyVendorDefinition;
  private inventoryItem: DestinyInventoryItemDefinition;
  private instance?: DestinyItemInstanceComponent;
  private defs: D2ManifestDefinitions;
  private reviewData: D2RatingData | null;

  constructor(
    defs: D2ManifestDefinitions,
    inventoryItem: DestinyInventoryItemDefinition,
    vendorDef?: DestinyVendorDefinition,
    vendorItemDef?: DestinyVendorItemDefinition,
    reviewData?: D2RatingData | null,
    saleItem?: DestinyVendorSaleItemComponent,
    // TODO: this'll be useful for showing the move-popup details
    itemComponents?: DestinyItemComponentSetOfint32,
    instance?: DestinyItemInstanceComponent,
    canPurchase = true,
  ) {
    this.defs = defs;
    this.vendorDef = vendorDef;
    this.vendorItemDef = vendorItemDef;
    this.saleItem = saleItem;
    this.inventoryItem = inventoryItem;
    this.canPurchase = canPurchase;
    this.itemComponents = itemComponents;
    this.reviewData = reviewData || null;
    this.instance = instance;
  }

  get key() {
    return this.saleItem ? this.saleItem.vendorItemIndex : this.inventoryItem.hash;
  }

  get itemHash() {
    return this.inventoryItem.hash;
  }

  // TODO: I'm not sold on having a bunch of property getters, vs just exposing the raw underlying stuff

  get displayProperties() {
    return this.inventoryItem.displayProperties;
  }

  /**
   * Should this item display "borderless" (vs. in a box)
   */
  get borderless() {
    return Boolean(this.inventoryItem.uiItemDisplayStyle);
  }

  /**
   * Should it display as a wide tile?
   */
  get displayTile() {
    return this.inventoryItem.uiItemDisplayStyle === 'ui_display_style_set_container';
  }

  /**
   * Should this be displayed in a vendor?
   */
  get canBeSold() {
    return (!this.saleItem || this.saleItem.failureIndexes.length === 0);
  }

  get failureStrings(): string[] {
    return this.saleItem && this.vendorDef
      ? (this.saleItem.failureIndexes || []).map((i) => this.vendorDef!.failureStrings[i])
      : [];
  }

  /**
   * What category should this be shown in?
   */
  get displayCategoryIndex() {
    return this.vendorItemDef ? this.vendorItemDef.displayCategoryIndex : undefined;
  }

  get costs() {
    return (this.saleItem && this.saleItem.costs) || [];
  }

  get primaryStat() {
    return (this.instance && this.instance.primaryStat && this.instance.primaryStat.value);
  }

  get rating(): number | null {
    if (this.reviewData) {
      return this.reviewData.overallScore;
    }

    return null;
  }

  get previewVendorHash(): number | null {
    if (this.inventoryItem.preview && this.inventoryItem.preview.previewVendorHash) {
      return this.inventoryItem.preview.previewVendorHash;
    }
    return null;
  }

  equals(other: VendorItem) {
    // Defs can be ref-compared
    return this.vendorItemDef === other.vendorItemDef &&
      this.canPurchase === other.canPurchase &&
      this.rating === other.rating &&
      // Deep equals
      equals(this.saleItem, other.saleItem);
  }

  /**
   * TODO: This is really gross, but it allows us to make enough of an item to show the move popup.
   */
  toDimItem(
    buckets: InventoryBuckets,
    reviewData: D2RatingData | null
  ): D2Item | null {
    return makeItem(
      this.defs,
      buckets,
      new Set(),
      new Set(),
      undefined,
      this.itemComponents,
      {
        itemHash: this.itemHash,
        itemInstanceId: this.saleItem ? this.saleItem.vendorItemIndex.toString() : undefined,
        quantity: this.vendorItemDef ? this.vendorItemDef.quantity : 1,
        bindStatus: ItemBindStatus.NotBound,
        location: ItemLocation.Vendor,
        bucketHash: 0,
        transferStatus: TransferStatuses.NotTransferrable,
        lockable: false,
        state: ItemState.None
      },
      undefined,
      reviewData
    );
  }
}
