import { FlashForgeDevice } from "../../lib/flashforgedriver/FlashForgeDevice";

module.exports = class Adventurer5MDevice extends FlashForgeDevice {
    constructor(...args: any) {
      super(...args);
      this.deviceName = "5m";
    }
  };