import { FlashForgeDevice } from "../../lib/flashforgedriver/FlashForgeDevice";

module.exports = class Adventurer34Device extends FlashForgeDevice {
    constructor(...args: any) {
      super(...args);
      this.deviceName = "34";
    }
  };